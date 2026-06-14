function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function firstFinite(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const text = cleanText(value).toLowerCase();
  if (["true", "yes", "1", "online", "connected"].includes(text)) return true;
  if (["false", "no", "0", "offline", "disconnected"].includes(text)) return false;
  return fallback;
}

function normalizePosture(value) {
  const posture = cleanText(value).toLowerCase();
  if (posture === "good") return "Good";
  if (posture === "adjust" || posture === "bad") return "Adjust";
  if (posture === "guided") return "Guided";
  if (posture === "unavailable") return "Unavailable";
  if (posture === "checking" || posture === "unknown") return "Checking";
  return "";
}

function normalizeStressLabel(value) {
  const stress = cleanText(value).toLowerCase();
  if (stress === "high") return "High";
  if (stress === "moderate" || stress === "medium") return "Moderate";
  if (stress === "calm" || stress === "low") return "Calm";
  return "";
}

function inferMovementScore({ accelX, accelY, accelZ, gyroX, gyroY, gyroZ }) {
  const accelMagnitude = [accelX, accelY, accelZ].every(Number.isFinite)
    ? Math.sqrt((accelX * accelX) + (accelY * accelY) + (accelZ * accelZ))
    : 1;
  const gyroMagnitude = [gyroX, gyroY, gyroZ].every(Number.isFinite)
    ? Math.sqrt((gyroX * gyroX) + (gyroY * gyroY) + (gyroZ * gyroZ))
    : 0;

  const accelDelta = Math.max(0, Math.abs(accelMagnitude - 1) * 40);
  const gyroDelta = Math.min(100, gyroMagnitude / 4);
  return roundNumber(clamp((accelDelta * 0.55) + (gyroDelta * 0.45), 0, 100), 1);
}

function describeMovement(score) {
  if (!Number.isFinite(score)) return "steady";
  if (score >= 70) return "intense";
  if (score >= 40) return "active";
  return "steady";
}

function inferPosture({ pitch, roll, movementScore, providedPosture }) {
  if (providedPosture) return providedPosture;
  if (!Number.isFinite(pitch) && !Number.isFinite(roll)) return "Checking";

  const absPitch = Math.abs(Number(pitch) || 0);
  const absRoll = Math.abs(Number(roll) || 0);
  const movement = Number(movementScore) || 0;

  if (absPitch <= 18 && absRoll <= 14 && movement <= 45) return "Good";
  if (movement >= 70) return "Guided";
  return "Adjust";
}

function inferPostureDetail(posture, pitch, roll) {
  if (posture === "Good") {
    return "Head angle and body movement look stable.";
  }

  if (posture === "Guided") {
    return "Movement is elevated. Hold the board steady and sit upright.";
  }

  if (posture === "Adjust") {
    return `Pitch ${roundNumber(pitch || 0, 1)} deg, roll ${roundNumber(roll || 0, 1)} deg. Re-center your upper body.`;
  }

  return "Waiting for stable MPU6050 orientation data.";
}

function inferStress(heartRateBpm, movementScore, providedStressLabel) {
  if (providedStressLabel) {
    const score = providedStressLabel === "High" ? 85 : providedStressLabel === "Moderate" ? 58 : 28;
    return { label: providedStressLabel, score };
  }

  const heartRate = Number(heartRateBpm) || 0;
  const movement = Number(movementScore) || 0;
  const score = clamp(
    Math.round((heartRate ? heartRate * 0.6 : 0) + (movement * 0.4) - 22),
    5,
    98
  );

  if (score >= 72 || heartRate >= 108) {
    return { label: "High", score };
  }

  if (score >= 45 || heartRate >= 88) {
    return { label: "Moderate", score };
  }

  return { label: "Calm", score };
}

function inferSignalQuality(signalStrength, contactDetected) {
  if (!contactDetected) return "poor";
  if ((Number(signalStrength) || 0) >= 75) return "good";
  if ((Number(signalStrength) || 0) >= 45) return "fair";
  return "poor";
}

function buildSummary(stress, posture, bpm, fallDetected, contactDetected) {
  if (!contactDetected) {
    return "Pulse sensor contact is weak. Keep your finger steady on the sensor.";
  }

  if (fallDetected) {
    return "Sudden movement detected. Check the board placement and sensor stability.";
  }

  if (stress === "High") {
    return `Heart rate is elevated at ${bpm || "--"} BPM. Slow your breathing and hold your posture.`;
  }

  if (posture === "Adjust") {
    return "Sensor data suggests posture drift. Sit upright and keep the board fixed.";
  }

  return `Live sensor feed is stable at ${bpm || "--"} BPM with ${posture.toLowerCase()} posture.`;
}

function emptySnapshot() {
  return {
    connected: false,
    deviceId: "",
    deviceLabel: "",
    updatedAt: null,
    heartRateBpm: null,
    pulseSignal: null,
    ibiMs: null,
    signalStrength: null,
    signalQuality: "poor",
    contactDetected: false,
    temperatureC: null,
    accel: { x: null, y: null, z: null },
    gyro: { x: null, y: null, z: null },
    pitch: null,
    roll: null,
    movementScore: null,
    movementLevel: "steady",
    fallDetected: false,
    stress: "Unknown",
    stressScore: 0,
    posture: "Checking",
    postureDetail: "Waiting for ESP32 sensor data.",
    summary: "Connect the ESP32 device to start streaming live pulse and motion data."
  };
}

function normalizePayload(body) {
  const payload = body && typeof body === "object" ? body : {};
  const pulse = payload.pulse && typeof payload.pulse === "object" ? payload.pulse : {};
  const motion = payload.motion && typeof payload.motion === "object" ? payload.motion : {};
  const accel = motion.accel && typeof motion.accel === "object" ? motion.accel : {};
  const gyro = motion.gyro && typeof motion.gyro === "object" ? motion.gyro : {};
  const derived = payload.derived && typeof payload.derived === "object" ? payload.derived : {};

  const heartRateBpm = roundNumber(
    clamp(firstFinite(payload.heartRateBpm, payload.heartRate, payload.bpm, pulse.bpm) || 0, 0, 220),
    1
  );
  const pulseSignal = roundNumber(
    clamp(firstFinite(payload.pulseSignal, payload.rawPulse, payload.signal, pulse.raw) || 0, 0, 4095),
    0
  );
  const ibiMs = roundNumber(
    clamp(firstFinite(payload.ibiMs, payload.ibi, pulse.ibiMs) || 0, 0, 3000),
    0
  );
  const signalStrength = roundNumber(
    clamp(firstFinite(payload.signalStrength, pulse.signalStrength, derived.signalStrength) || 0, 0, 100),
    0
  );
  const contactDetected = normalizeBoolean(
    payload.contactDetected,
    normalizeBoolean(pulse.contactDetected, Boolean(heartRateBpm || pulseSignal > 60))
  );

  const accelX = roundNumber(firstFinite(payload.accelX, accel.x, payload.ax), 3);
  const accelY = roundNumber(firstFinite(payload.accelY, accel.y, payload.ay), 3);
  const accelZ = roundNumber(firstFinite(payload.accelZ, accel.z, payload.az), 3);
  const gyroX = roundNumber(firstFinite(payload.gyroX, gyro.x, payload.gx), 2);
  const gyroY = roundNumber(firstFinite(payload.gyroY, gyro.y, payload.gy), 2);
  const gyroZ = roundNumber(firstFinite(payload.gyroZ, gyro.z, payload.gz), 2);
  const pitch = roundNumber(firstFinite(payload.pitch, motion.pitch, derived.pitch), 2);
  const roll = roundNumber(firstFinite(payload.roll, motion.roll, derived.roll), 2);
  const temperatureC = roundNumber(
    firstFinite(payload.temperatureC, payload.temperature, motion.temperatureC, motion.temperature),
    2
  );
  const wifiRssiValue = firstFinite(payload.wifiRssi, payload.rssi);
  const batteryLevelValue = firstFinite(payload.batteryLevel);
  const movementScore = roundNumber(
    clamp(
      firstFinite(payload.movementScore, motion.movementScore, derived.movementScore) ||
        inferMovementScore({ accelX, accelY, accelZ, gyroX, gyroY, gyroZ }),
      0,
      100
    ),
    1
  );
  const movementLevel = cleanText(payload.movementLevel || motion.movementLevel) || describeMovement(movementScore);
  const fallDetected = normalizeBoolean(
    payload.fallDetected,
    normalizeBoolean(motion.fallDetected, (Number(movementScore) || 0) >= 92)
  );
  const providedPosture = normalizePosture(payload.posture || motion.posture || derived.posture);
  const posture = inferPosture({ pitch, roll, movementScore, providedPosture });
  const postureDetail = cleanText(payload.postureDetail || derived.postureDetail) || inferPostureDetail(posture, pitch, roll);
  const stressResult = inferStress(
    heartRateBpm,
    movementScore,
    normalizeStressLabel(payload.stress || derived.stress)
  );

  return {
    deviceId: cleanText(payload.deviceId) || "esp32-pulse-mpu6050",
    deviceLabel: cleanText(payload.deviceLabel) || "ESP32 Pulse + MPU6050",
    deviceType: cleanText(payload.deviceType) || "ESP32",
    firmwareVersion: cleanText(payload.firmwareVersion) || "1.0.0",
    source: cleanText(payload.source) || "esp32",
    sampleRateMs: roundNumber(clamp(firstFinite(payload.sampleRateMs, payload.intervalMs) || 5000, 250, 60000), 0),
    uptimeSeconds: roundNumber(clamp(firstFinite(payload.uptimeSeconds, payload.uptime) || 0, 0, 99999999), 0),
    wifiRssi: wifiRssiValue === null ? null : roundNumber(clamp(wifiRssiValue, -120, 0), 0),
    batteryLevel: batteryLevelValue === null ? null : roundNumber(clamp(batteryLevelValue, 0, 100), 0),
    updatedAt: new Date().toISOString(),
    connected: true,
    heartRateBpm: contactDetected && heartRateBpm > 0 ? heartRateBpm : null,
    pulseSignal: pulseSignal > 0 ? pulseSignal : null,
    ibiMs: ibiMs > 0 ? ibiMs : null,
    signalStrength: signalStrength,
    signalQuality: inferSignalQuality(signalStrength, contactDetected),
    contactDetected,
    temperatureC,
    accel: {
      x: accelX,
      y: accelY,
      z: accelZ
    },
    gyro: {
      x: gyroX,
      y: gyroY,
      z: gyroZ
    },
    pitch,
    roll,
    movementScore,
    movementLevel,
    fallDetected,
    stress: stressResult.label,
    stressScore: stressResult.score,
    posture,
    postureDetail,
    summary: cleanText(payload.summary) || buildSummary(stressResult.label, posture, heartRateBpm, fallDetected, contactDetected),
    pulse: {
      bpm: contactDetected && heartRateBpm > 0 ? heartRateBpm : null,
      raw: pulseSignal > 0 ? pulseSignal : null,
      ibiMs: ibiMs > 0 ? ibiMs : null,
      signalStrength,
      signalQuality: inferSignalQuality(signalStrength, contactDetected),
      contactDetected
    },
    motion: {
      accel: {
        x: accelX,
        y: accelY,
        z: accelZ
      },
      gyro: {
        x: gyroX,
        y: gyroY,
        z: gyroZ
      },
      temperatureC,
      pitch,
      roll,
      movementScore,
      movementLevel,
      fallDetected,
      posture
    }
  };
}

module.exports = {
  emptySnapshot,
  normalizePayload
};
