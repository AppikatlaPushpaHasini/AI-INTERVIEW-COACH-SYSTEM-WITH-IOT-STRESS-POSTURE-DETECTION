const DEFAULT_INTERVAL_MS = Math.max(1000, Number(process.env.IOT_SIM_INTERVAL_MS) || 5000);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function pickPhase(elapsedSeconds) {
  const cycleSeconds = elapsedSeconds % 180;

  if (cycleSeconds < 45) {
    return {
      targetBpm: 74,
      bpmVariance: 4,
      movementBase: 14,
      movementVariance: 8,
      pitchBias: 2,
      rollBias: 1
    };
  }

  if (cycleSeconds < 105) {
    return {
      targetBpm: 89,
      bpmVariance: 6,
      movementBase: 34,
      movementVariance: 14,
      pitchBias: 7,
      rollBias: 5
    };
  }

  if (cycleSeconds < 140) {
    return {
      targetBpm: 106,
      bpmVariance: 8,
      movementBase: 58,
      movementVariance: 18,
      pitchBias: 10,
      rollBias: 8
    };
  }

  return {
    targetBpm: 82,
    bpmVariance: 5,
    movementBase: 24,
    movementVariance: 10,
    pitchBias: 4,
    rollBias: 3
  };
}

class IoTSimulatorModel {
  constructor(options = {}) {
    this.intervalMs = Math.max(1000, Number(options.intervalMs) || DEFAULT_INTERVAL_MS);
    this.deviceId = String(options.deviceId || "esp32-pulse-mpu6050").trim() || "esp32-pulse-mpu6050";
    this.deviceLabel = String(options.deviceLabel || "ESP32 Pulse + MPU6050").trim() || "ESP32 Pulse + MPU6050";
    this.deviceType = String(options.deviceType || "ESP32").trim() || "ESP32";
    this.source = String(options.source || "esp32-simulator").trim() || "esp32-simulator";
    this.firmwareVersion = String(options.firmwareVersion || "1.0.0-sim").trim() || "1.0.0-sim";
    this.startedAt = Date.now();
    this.sampleCount = 0;
    this.lastBpm = 76;
    this.lastPitch = 1.8;
    this.lastRoll = 0.9;
    this.lastMovement = 16;
    this.lastSignal = 2180;
    this.lastSignalStrength = 82;
  }

  nextPayload() {
    this.sampleCount += 1;
    const elapsedSeconds = (Date.now() - this.startedAt) / 1000;
    const phase = pickPhase(elapsedSeconds);
    const motionPulse = Math.sin((elapsedSeconds / 8) * Math.PI * 2);
    const posturePulse = Math.sin((elapsedSeconds / 13) * Math.PI * 2);

    const bpm = clamp(
      round((this.lastBpm * 0.72) + (phase.targetBpm * 0.28) + randomBetween(-phase.bpmVariance, phase.bpmVariance), 1),
      63,
      122
    );
    const ibiMs = Math.round(60000 / bpm);
    const movementScore = clamp(
      round((this.lastMovement * 0.55) + (phase.movementBase * 0.45) + (motionPulse * 8) + randomBetween(-phase.movementVariance, phase.movementVariance), 1),
      4,
      92
    );
    const pitch = clamp(
      round((this.lastPitch * 0.5) + (phase.pitchBias * 0.5) + (posturePulse * 5.5) + randomBetween(-2.2, 2.2), 2),
      -18,
      26
    );
    const roll = clamp(
      round((this.lastRoll * 0.5) + (phase.rollBias * 0.5) + (posturePulse * 4.2) + randomBetween(-1.8, 1.8), 2),
      -16,
      21
    );
    const posture =
      movementScore >= 70 ? "Guided" :
      (Math.abs(pitch) <= 18 && Math.abs(roll) <= 14 ? "Good" : "Adjust");
    const stress =
      bpm >= 103 || movementScore >= 62 ? "High" :
      (bpm >= 86 || movementScore >= 34 ? "Moderate" : "Calm");
    const signalStrength = clamp(
      Math.round((this.lastSignalStrength * 0.65) + 30 + ((122 - bpm) * 0.5) + randomBetween(0, 16)),
      58,
      96
    );
    const pulseSignal = clamp(
      Math.round((this.lastSignal * 0.45) + 2050 + (Math.sin((elapsedSeconds / 1.1) * Math.PI * 2) * 340) + randomBetween(-120, 120)),
      1620,
      2975
    );
    const accelX = round(Math.sin(elapsedSeconds / 3.8) * 0.08 + (roll / 60), 3);
    const accelY = round(Math.cos(elapsedSeconds / 4.6) * 0.07 + (pitch / 55), 3);
    const accelZ = round(0.98 + Math.sin(elapsedSeconds / 5.2) * 0.06, 3);
    const gyroX = round((movementScore / 12) + randomBetween(-3.2, 3.2), 2);
    const gyroY = round((movementScore / 14) + randomBetween(-3, 3), 2);
    const gyroZ = round((movementScore / 16) + randomBetween(-2.8, 2.8), 2);
    const temperatureC = round(30.4 + Math.sin(elapsedSeconds / 17) * 1.1 + randomBetween(-0.2, 0.2), 2);
    const summary = stress === "High"
      ? `Heart rate is elevated at ${Math.round(bpm)} BPM. Slow your breathing and keep still.`
      : posture === "Adjust"
        ? `Posture drift detected with pitch ${round(pitch, 1)} deg and roll ${round(roll, 1)} deg.`
        : `Live sensor feed is stable at ${Math.round(bpm)} BPM with ${posture.toLowerCase()} posture.`;

    this.lastBpm = bpm;
    this.lastPitch = pitch;
    this.lastRoll = roll;
    this.lastMovement = movementScore;
    this.lastSignal = pulseSignal;
    this.lastSignalStrength = signalStrength;

    return {
      deviceId: this.deviceId,
      deviceLabel: this.deviceLabel,
      deviceType: this.deviceType,
      firmwareVersion: this.firmwareVersion,
      source: this.source,
      sampleRateMs: this.intervalMs,
      uptimeSeconds: Math.floor(elapsedSeconds),
      wifiRssi: -48,
      heartRateBpm: bpm,
      pulseSignal,
      ibiMs,
      signalStrength,
      contactDetected: true,
      temperatureC,
      summary,
      pulse: {
        bpm,
        raw: pulseSignal,
        ibiMs,
        signalStrength,
        signalQuality: signalStrength >= 75 ? "good" : "fair",
        contactDetected: true
      },
      motion: {
        temperatureC,
        pitch,
        roll,
        movementScore,
        movementLevel: movementScore >= 70 ? "intense" : movementScore >= 40 ? "active" : "steady",
        fallDetected: false,
        posture,
        accel: {
          x: accelX,
          y: accelY,
          z: accelZ
        },
        gyro: {
          x: gyroX,
          y: gyroY,
          z: gyroZ
        }
      },
      derived: {
        stress,
        posture,
        postureDetail:
          posture === "Good"
            ? "Head angle and body movement look stable."
            : posture === "Guided"
              ? "Movement is elevated. Hold the board steady and sit upright."
              : `Pitch ${round(pitch, 1)} deg, roll ${round(roll, 1)} deg. Re-center your upper body.`,
        signalStrength,
        movementScore,
        pitch,
        roll
      }
    };
  }
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  IoTSimulatorModel
};
