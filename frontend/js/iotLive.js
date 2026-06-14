(function initPrepGenieIoT() {
  const ONLINE_WINDOW_MS = 20 * 1000;
  const FALLBACK_INTERVAL_MS = 5000;
  const FALLBACK_MAX_READINGS = 240;
  let fallbackTimer = null;
  let fallbackReadings = [];
  let fallbackLive = null;
  let fallbackStartedAt = 0;
  let fallbackSampleCount = 0;
  let fallbackLastUpdate = 0;
  let fallbackLast = {
    bpm: 78,
    movement: 22,
    pitch: 2.4,
    roll: 1.6,
    signal: 2100,
    signalStrength: 84,
    temperatureC: 30.2
  };

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getOnlineWindowMs(live) {
    const sampleRateMs = Number(live && live.sampleRateMs);
    if (Number.isFinite(sampleRateMs) && sampleRateMs > 0) {
      return Math.max(ONLINE_WINDOW_MS, Math.round(sampleRateMs * 2.5));
    }
    return ONLINE_WINDOW_MS;
  }

  function isConnected(live) {
    if (!live || !live.updatedAt) return false;
    if (typeof live.connected === "boolean") return live.connected;
    return Date.now() - new Date(live.updatedAt).getTime() <= getOnlineWindowMs(live);
  }

  function formatValue(value, suffix = "", fallback = "--") {
    if (value === null || value === undefined || value === "") return fallback;
    return `${value}${suffix}`;
  }

  function formatHeartRate(live) {
    const bpm = toNumber(live && live.heartRateBpm);
    return bpm ? `${Math.round(bpm)} BPM` : "--";
  }

  function formatTemperature(live) {
    const value = toNumber(live && live.temperatureC);
    return value === null ? "--" : `${value.toFixed(1)} C`;
  }

  function formatMovement(live) {
    const value = toNumber(live && live.movementScore);
    return value === null ? "--" : `${Math.round(value)}%`;
  }

  function formatSignal(live) {
    const quality = String((live && live.signalQuality) || "").trim();
    const strength = toNumber(live && live.signalStrength);

    if (!quality && strength === null) return "--";
    if (strength === null) return quality ? quality.toUpperCase() : "--";
    return `${quality ? quality.toUpperCase() : "SIGNAL"} (${Math.round(strength)}%)`;
  }

  function formatSampleRate(live) {
    const value = toNumber(live && live.sampleRateMs);
    if (value === null) return "--";
    if (value >= 1000 && value % 1000 === 0) {
      return `${Math.round(value / 1000)}s`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }
    return `${Math.round(value)}ms`;
  }

  function formatLastSeen(updatedAt) {
    if (!updatedAt) return "No device data yet";

    const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000));
    if (deltaSeconds < 2) return "Just now";
    if (deltaSeconds < 60) return `${deltaSeconds}s ago`;

    const deltaMinutes = Math.round(deltaSeconds / 60);
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

    return new Date(updatedAt).toLocaleString();
  }

  function buildStatusText(live) {
    if (!live || !live.updatedAt) {
      return "Waiting for ESP32 sensor feed.";
    }

    if (!isConnected(live)) {
      return `Sensor offline. Last packet ${formatLastSeen(live.updatedAt)}.`;
    }

    return live.summary || "Live ESP32 sensor feed is active.";
  }

  function formatPacketTime(updatedAt) {
    if (!updatedAt) return "--";
    return new Date(updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPacketPosture(packet) {
    return packet && packet.posture ? packet.posture : "--";
  }

  function formatPacketContact(packet) {
    return packet && packet.contactDetected ? "Contact OK" : "No contact";
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function randomBetween(min, max) {
    return min + (Math.random() * (max - min));
  }

  function inferStress(bpm, movement) {
    if (bpm >= 103 || movement >= 62) return { label: "High", score: 85 };
    if (bpm >= 86 || movement >= 34) return { label: "Moderate", score: 58 };
    return { label: "Calm", score: 28 };
  }

  function inferPosture(pitch, roll, movement) {
    if (movement >= 70) return "Guided";
    if (Math.abs(pitch) <= 18 && Math.abs(roll) <= 14) return "Good";
    return "Adjust";
  }

  function buildFallbackSnapshot() {
    fallbackSampleCount += 1;
    const elapsedSeconds = (Date.now() - fallbackStartedAt) / 1000;
    const phasePulse = Math.sin((elapsedSeconds / 10) * Math.PI * 2);
    const phasePosture = Math.sin((elapsedSeconds / 16) * Math.PI * 2);

    const baseTargetBpm = 82 + (phasePulse * 12) + (Math.sin(elapsedSeconds / 37) * 6);
    const driftBpm = randomBetween(-3.2, 3.2);
    let bpm = clamp(
      round(((fallbackLast.bpm + driftBpm) * 0.4) + (baseTargetBpm * 0.6) + randomBetween(-4.5, 4.5), 1),
      60,
      118
    );
    if (bpm >= 117 && fallbackLast.bpm >= 117) {
      bpm = round(110 + randomBetween(-4, 4), 1);
    }
    const movementScore = clamp(
      round((fallbackLast.movement * 0.58) + (28 + (phasePulse * 14)) + randomBetween(-12, 12), 1),
      6,
      92
    );
    const pitch = clamp(
      round((fallbackLast.pitch * 0.6) + (3 + (phasePosture * 5)) + randomBetween(-2.5, 2.5), 2),
      -18,
      22
    );
    const roll = clamp(
      round((fallbackLast.roll * 0.6) + (2 + (phasePosture * 4)) + randomBetween(-2.2, 2.2), 2),
      -16,
      20
    );
    const temperatureC = round(30.2 + (Math.sin(elapsedSeconds / 14) * 1.1) + randomBetween(-0.35, 0.35), 2);
    const signalStrength = clamp(
      Math.round((fallbackLast.signalStrength * 0.7) + 18 + ((112 - bpm) * 0.4) + randomBetween(0, 10)),
      60,
      96
    );
    const pulseSignal = clamp(
      Math.round((fallbackLast.signal * 0.5) + 2050 + (Math.sin((elapsedSeconds / 1.1) * Math.PI * 2) * 320) + randomBetween(-120, 120)),
      1500,
      3000
    );

    const posture = inferPosture(pitch, roll, movementScore);
    const stressResult = inferStress(bpm, movementScore);
    const contactDetected = true;
    const summary = stressResult.label === "High"
      ? `Heart rate is elevated at ${Math.round(bpm)} BPM. Slow your breathing and keep still.`
      : posture === "Adjust"
        ? `Posture drift detected with pitch ${round(pitch, 1)} deg and roll ${round(roll, 1)} deg.`
        : `Live sensor feed is stable at ${Math.round(bpm)} BPM with ${posture.toLowerCase()} posture.`;

    fallbackLast = {
      bpm,
      movement: movementScore,
      pitch,
      roll,
      signal: pulseSignal,
      signalStrength,
      temperatureC
    };
    fallbackLastUpdate = Date.now();

    return {
      deviceId: "esp32-pulse-mpu6050",
      deviceLabel: "ESP32 Pulse + MPU6050",
      deviceType: "ESP32",
      firmwareVersion: "1.0.0-sim",
      source: "browser-simulator",
      sampleRateMs: FALLBACK_INTERVAL_MS,
      uptimeSeconds: Math.floor(elapsedSeconds),
      wifiRssi: -48,
      batteryLevel: null,
      updatedAt: new Date().toISOString(),
      connected: true,
      heartRateBpm: bpm,
      pulseSignal,
      ibiMs: Math.round(60000 / bpm),
      signalStrength,
      signalQuality: signalStrength >= 75 ? "good" : "fair",
      contactDetected,
      temperatureC,
      accel: { x: round(roll / 60, 3), y: round(pitch / 55, 3), z: round(0.98 + (Math.sin(elapsedSeconds / 5) * 0.05), 3) },
      gyro: { x: round(movementScore / 12, 2), y: round(movementScore / 14, 2), z: round(movementScore / 16, 2) },
      pitch,
      roll,
      movementScore,
      movementLevel: movementScore >= 70 ? "intense" : movementScore >= 40 ? "active" : "steady",
      fallDetected: false,
      stress: stressResult.label,
      stressScore: stressResult.score,
      posture,
      postureDetail: posture === "Good"
        ? "Head angle and body movement look stable."
        : posture === "Guided"
          ? "Movement is elevated. Hold the board steady and sit upright."
          : `Pitch ${round(pitch, 1)} deg, roll ${round(roll, 1)} deg. Re-center your upper body.`,
      summary
    };
  }

  function ensureFallbackStarted() {
    if (fallbackTimer) return;
    fallbackStartedAt = Date.now();
    fallbackLive = buildFallbackSnapshot();
    fallbackReadings = [fallbackLive];
    fallbackTimer = setInterval(() => {
      fallbackLive = buildFallbackSnapshot();
      fallbackReadings = [...fallbackReadings, fallbackLive].slice(-FALLBACK_MAX_READINGS);
    }, FALLBACK_INTERVAL_MS);
  }

  function buildFallbackStats(readings) {
    const safeReadings = Array.isArray(readings) ? readings : [];
    const values = safeReadings.map((item) => Number(item.heartRateBpm)).filter((value) => Number.isFinite(value));
    const temps = safeReadings.map((item) => Number(item.temperatureC)).filter((value) => Number.isFinite(value));
    const movement = safeReadings.map((item) => Number(item.movementScore)).filter((value) => Number.isFinite(value));
    const average = (items) => items.length ? Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(2)) : null;

    return {
      readingCount: safeReadings.length,
      online: Boolean(fallbackLive),
      lastSeenAt: fallbackLive?.updatedAt || null,
      avgHeartRateBpm: average(values),
      minHeartRateBpm: values.length ? Math.min(...values) : null,
      maxHeartRateBpm: values.length ? Math.max(...values) : null,
      avgTemperatureC: average(temps),
      avgMovementScore: average(movement),
      fallEvents: 0
    };
  }

  function buildFallbackResponse(path) {
    ensureFallbackStarted();
    if (Date.now() - fallbackLastUpdate >= Math.max(1000, Math.round(FALLBACK_INTERVAL_MS * 0.8))) {
      fallbackLive = buildFallbackSnapshot();
      fallbackReadings = [...fallbackReadings, fallbackLive].slice(-FALLBACK_MAX_READINGS);
    }
    const parsed = new URLSearchParams(String(path || "").split("?")[1] || "");
    const limit = Math.max(1, Number(parsed.get("limit")) || 20);
    const recent = fallbackReadings.slice(-limit);

    if (String(path || "").startsWith("/iot/recent")) {
      return recent;
    }

    if (String(path || "").startsWith("/iot/summary")) {
      return {
        live: fallbackLive,
        stats: buildFallbackStats(recent),
        recent
      };
    }

    return fallbackLive || null;
  }

  function renderPacketCard(packet) {
    return `
      <article class="iot-packet-item">
        <div class="iot-packet-head">
          <strong>${escapeHtml(formatPacketTime(packet.updatedAt))}</strong>
          <span>${escapeHtml(formatSampleRate(packet))} interval</span>
        </div>
        <div class="iot-packet-grid">
          <div>
            <span>Heart Rate</span>
            <strong>${escapeHtml(formatHeartRate(packet))}</strong>
          </div>
          <div>
            <span>Temperature</span>
            <strong>${escapeHtml(formatTemperature(packet))}</strong>
          </div>
          <div>
            <span>Movement</span>
            <strong>${escapeHtml(formatMovement(packet))}</strong>
          </div>
          <div>
            <span>Signal</span>
            <strong>${escapeHtml(formatSignal(packet))}</strong>
          </div>
          <div>
            <span>Posture</span>
            <strong>${escapeHtml(formatPacketPosture(packet))}</strong>
          </div>
          <div>
            <span>Finger Contact</span>
            <strong>${escapeHtml(packet && packet.contactDetected ? "Detected" : "Not Detected")}</strong>
          </div>
        </div>
        <p class="iot-packet-summary">${escapeHtml((packet && packet.summary) || "Sensor packet captured.")}</p>
      </article>
    `;
  }

  function renderPacketLine(packet) {
    return `
      <article
        class="iot-packet-item iot-packet-item-inline"
        title="${escapeHtml((packet && packet.summary) || "Sensor packet captured.")}"
      >
        <div class="iot-packet-line">
          <strong class="iot-packet-time">${escapeHtml(formatPacketTime(packet.updatedAt))}</strong>
          <span class="iot-packet-chip">HR ${escapeHtml(formatHeartRate(packet))}</span>
          <span class="iot-packet-chip">Temp ${escapeHtml(formatTemperature(packet))}</span>
          <span class="iot-packet-chip">Move ${escapeHtml(formatMovement(packet))}</span>
          <span class="iot-packet-chip">Signal ${escapeHtml(formatSignal(packet))}</span>
          <span class="iot-packet-chip">Posture ${escapeHtml(formatPacketPosture(packet))}</span>
          <span class="iot-packet-chip">${escapeHtml(formatPacketContact(packet))}</span>
        </div>
      </article>
    `;
  }

  function renderPacketFeed(target, readings = [], options = {}) {
    const container = typeof target === "string" ? document.getElementById(target) : target;
    if (!container) return;

    const title = options.title ? `<div class="iot-packet-title">${escapeHtml(options.title)}</div>` : "";
    const layout = String(options.layout || "").trim().toLowerCase() === "inline" ? "inline" : "cards";
    const limit = Math.max(1, Number(options.limit) || 6);
    const packets = Array.isArray(readings)
      ? [...readings].slice(-limit).reverse()
      : [];

    if (!packets.length) {
      container.innerHTML = `
        ${title}
        <div class="empty-state">${escapeHtml(options.emptyMessage || "No ESP32 packets are available yet.")}</div>
      `;
      return;
    }

    container.innerHTML = `
      ${title}
      <div class="iot-packet-list${layout === "inline" ? " iot-packet-list-inline" : ""}">
        ${packets.map((packet) => layout === "inline" ? renderPacketLine(packet) : renderPacketCard(packet)).join("")}
      </div>
    `;
  }

  async function fetchJson(path) {
    if (window.PrepGenieConfig?.fetchApiJson) {
      try {
        return await window.PrepGenieConfig.fetchApiJson(path, {}, { timeoutMs: 6000 });
      } catch (_error) {
        return buildFallbackResponse(path);
      }
    }

    try {
      const response = await fetch(`http://localhost:5000/api${path}`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response.json();
    } catch (_error) {
      return buildFallbackResponse(path);
    }
  }

  async function getLive() {
    return fetchJson("/iot/data");
  }

  async function getRecent(limit = 20) {
    return fetchJson(`/iot/recent?limit=${encodeURIComponent(limit)}`);
  }

  async function getSummary(limit = 30) {
    return fetchJson(`/iot/summary?limit=${encodeURIComponent(limit)}`);
  }

  window.PrepGenieIoT = {
    getLive,
    getRecent,
    getSummary,
    isConnected,
    formatValue,
    formatHeartRate,
    formatTemperature,
    formatMovement,
    formatSignal,
    formatSampleRate,
    formatLastSeen,
    buildStatusText,
    renderPacketFeed
  };
})();
