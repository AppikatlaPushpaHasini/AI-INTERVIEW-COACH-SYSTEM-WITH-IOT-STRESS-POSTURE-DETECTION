#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <math.h>

// Update these three values before uploading to the ESP32.
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *BACKEND_URL = "http://10.179.127.192:5000/api/iot/data";

const int PULSE_PIN = 34;
const uint8_t MPU6050_ADDRESS = 0x68;
const unsigned long PULSE_SAMPLE_INTERVAL_MS = 10;
const unsigned long UPLOAD_INTERVAL_MS = 5000;
const size_t PULSE_WINDOW_SIZE = 100;
const size_t BPM_WINDOW_SIZE = 6;

struct PulseState {
  int samples[PULSE_WINDOW_SIZE];
  size_t sampleIndex = 0;
  size_t sampleCount = 0;
  bool beatLatched = false;
  bool contactDetected = false;
  unsigned long lastBeatAt = 0;
  unsigned long ibis[BPM_WINDOW_SIZE] = {0};
  size_t ibiIndex = 0;
  size_t ibiCount = 0;
  float bpm = 0.0f;
  int raw = 0;
  int signalStrength = 0;
  int signalMin = 0;
  int signalMax = 0;
  int signalAvg = 0;
};

struct MotionState {
  float ax = 0.0f;
  float ay = 0.0f;
  float az = 0.0f;
  float gx = 0.0f;
  float gy = 0.0f;
  float gz = 0.0f;
  float temperatureC = 0.0f;
  float pitch = 0.0f;
  float roll = 0.0f;
  float movementScore = 0.0f;
  bool fallDetected = false;
};

PulseState pulseState;
MotionState motionState;
unsigned long lastPulseSampleAt = 0;
unsigned long lastUploadAt = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  unsigned long startedAt = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected yet. The sketch will keep retrying.");
  }
}

void writeMpuRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU6050_ADDRESS);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool readMpuBytes(uint8_t reg, uint8_t count, uint8_t *buffer) {
  Wire.beginTransmission(MPU6050_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  const uint8_t received = Wire.requestFrom(MPU6050_ADDRESS, count, true);
  if (received != count) {
    return false;
  }

  for (uint8_t i = 0; i < count; i++) {
    buffer[i] = Wire.read();
  }

  return true;
}

bool initMpu6050() {
  uint8_t whoAmI = 0;

  Wire.beginTransmission(MPU6050_ADDRESS);
  Wire.write(0x75);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  if (Wire.requestFrom(MPU6050_ADDRESS, (uint8_t)1, true) != 1) {
    return false;
  }

  whoAmI = Wire.read();
  if (whoAmI != 0x68) {
    return false;
  }

  writeMpuRegister(0x6B, 0x00);
  writeMpuRegister(0x1C, 0x00);
  writeMpuRegister(0x1B, 0x00);
  delay(100);
  return true;
}

float averageIbi() {
  if (pulseState.ibiCount == 0) {
    return 0.0f;
  }

  unsigned long total = 0;
  for (size_t i = 0; i < pulseState.ibiCount; i++) {
    total += pulseState.ibis[i];
  }

  return (float)total / (float)pulseState.ibiCount;
}

void updatePulseDetection(int rawValue, unsigned long now) {
  pulseState.raw = rawValue;
  pulseState.samples[pulseState.sampleIndex] = rawValue;
  pulseState.sampleIndex = (pulseState.sampleIndex + 1) % PULSE_WINDOW_SIZE;
  if (pulseState.sampleCount < PULSE_WINDOW_SIZE) {
    pulseState.sampleCount++;
  }

  int minimum = 4095;
  int maximum = 0;
  long total = 0;

  for (size_t i = 0; i < pulseState.sampleCount; i++) {
    const int sample = pulseState.samples[i];
    if (sample < minimum) minimum = sample;
    if (sample > maximum) maximum = sample;
    total += sample;
  }

  pulseState.signalMin = minimum;
  pulseState.signalMax = maximum;
  pulseState.signalAvg = pulseState.sampleCount ? (int)(total / (long)pulseState.sampleCount) : rawValue;

  const int amplitude = maximum - minimum;
  pulseState.contactDetected = amplitude > 18;
  pulseState.signalStrength = constrain(map(amplitude, 18, 600, 10, 100), 0, 100);

  const int thresholdHigh = minimum + (int)(amplitude * 0.68f);
  const int thresholdLow = minimum + (int)(amplitude * 0.45f);

  if (!pulseState.contactDetected) {
    pulseState.beatLatched = false;
    pulseState.bpm = 0.0f;
    return;
  }

  if (!pulseState.beatLatched && rawValue >= thresholdHigh && (now - pulseState.lastBeatAt) > 320) {
    pulseState.beatLatched = true;

    if (pulseState.lastBeatAt > 0) {
      const unsigned long ibi = now - pulseState.lastBeatAt;
      if (ibi >= 300 && ibi <= 2000) {
        pulseState.ibis[pulseState.ibiIndex] = ibi;
        pulseState.ibiIndex = (pulseState.ibiIndex + 1) % BPM_WINDOW_SIZE;
        if (pulseState.ibiCount < BPM_WINDOW_SIZE) {
          pulseState.ibiCount++;
        }

        const float ibiAverage = averageIbi();
        if (ibiAverage > 0.0f) {
          pulseState.bpm = 60000.0f / ibiAverage;
        }
      }
    }

    pulseState.lastBeatAt = now;
  }

  if (pulseState.beatLatched && rawValue <= thresholdLow) {
    pulseState.beatLatched = false;
  }
}

bool readMotion(MotionState &state) {
  uint8_t buffer[14];
  if (!readMpuBytes(0x3B, 14, buffer)) {
    return false;
  }

  const int16_t axRaw = (buffer[0] << 8) | buffer[1];
  const int16_t ayRaw = (buffer[2] << 8) | buffer[3];
  const int16_t azRaw = (buffer[4] << 8) | buffer[5];
  const int16_t tempRaw = (buffer[6] << 8) | buffer[7];
  const int16_t gxRaw = (buffer[8] << 8) | buffer[9];
  const int16_t gyRaw = (buffer[10] << 8) | buffer[11];
  const int16_t gzRaw = (buffer[12] << 8) | buffer[13];

  state.ax = axRaw / 16384.0f;
  state.ay = ayRaw / 16384.0f;
  state.az = azRaw / 16384.0f;
  state.temperatureC = (tempRaw / 340.0f) + 36.53f;
  state.gx = gxRaw / 131.0f;
  state.gy = gyRaw / 131.0f;
  state.gz = gzRaw / 131.0f;

  state.pitch = atan2f(state.ay, sqrtf((state.ax * state.ax) + (state.az * state.az))) * 180.0f / PI;
  state.roll = atan2f(-state.ax, state.az) * 180.0f / PI;

  const float accelMagnitude = sqrtf((state.ax * state.ax) + (state.ay * state.ay) + (state.az * state.az));
  const float gyroMagnitude = sqrtf((state.gx * state.gx) + (state.gy * state.gy) + (state.gz * state.gz));
  state.movementScore = constrain((fabsf(accelMagnitude - 1.0f) * 70.0f) + (gyroMagnitude / 4.0f), 0.0f, 100.0f);
  state.fallDetected = state.movementScore >= 92.0f;

  return true;
}

String postureLabelFromMotion(const MotionState &state) {
  if (fabsf(state.pitch) <= 18.0f && fabsf(state.roll) <= 14.0f && state.movementScore <= 45.0f) {
    return "Good";
  }

  if (state.movementScore >= 70.0f) {
    return "Guided";
  }

  return "Adjust";
}

String postureDetailFromMotion(const MotionState &state, const String &posture) {
  if (posture == "Good") {
    return "Board angle is stable and movement is controlled.";
  }

  if (posture == "Guided") {
    return "Movement is elevated. Keep the board fixed and sit more steadily.";
  }

  return "Pitch " + String(state.pitch, 1) + " deg, roll " + String(state.roll, 1) + " deg. Re-center your posture.";
}

String stressLabelFromState(float bpm, const MotionState &state, bool contactDetected) {
  if (!contactDetected || bpm <= 0.0f) {
    return "Unknown";
  }

  if (bpm >= 108.0f || state.movementScore >= 75.0f) {
    return "High";
  }

  if (bpm >= 88.0f || state.movementScore >= 45.0f) {
    return "Moderate";
  }

  return "Calm";
}

String signalQualityFromPulse() {
  if (!pulseState.contactDetected) {
    return "poor";
  }

  if (pulseState.signalStrength >= 75) {
    return "good";
  }

  if (pulseState.signalStrength >= 45) {
    return "fair";
  }

  return "poor";
}

String jsonNumberOrNull(float value, uint8_t decimals) {
  if (isnan(value)) {
    return "null";
  }
  return String((double)value, (unsigned int)decimals);
}

String jsonIntegerOrNull(long value, bool available) {
  if (!available) {
    return "null";
  }
  return String(value);
}

String buildPayload() {
  const String posture = postureLabelFromMotion(motionState);
  const String postureDetail = postureDetailFromMotion(motionState, posture);
  const String stress = stressLabelFromState(pulseState.bpm, motionState, pulseState.contactDetected);
  const String signalQuality = signalQualityFromPulse();
  const String summary = !pulseState.contactDetected
    ? "Pulse contact is weak. Keep one finger gently on the sensor."
    : (stress == "High"
      ? "Heart rate is elevated. Slow your breathing and stay still."
      : (posture == "Adjust"
        ? "Posture drift detected from the MPU6050 orientation."
        : "Sensor feed is stable and streaming normally."));
  const unsigned long ibiAverage = pulseState.ibiCount ? (unsigned long)averageIbi() : 0;

  String json = "{";
  json += "\"deviceId\":\"esp32-pulse-mpu6050\",";
  json += "\"deviceLabel\":\"ESP32 Pulse + MPU6050\",";
  json += "\"deviceType\":\"ESP32\",";
  json += "\"firmwareVersion\":\"1.0.0\",";
  json += "\"source\":\"esp32\",";
  json += "\"sampleRateMs\":" + String(UPLOAD_INTERVAL_MS) + ",";
  json += "\"uptimeSeconds\":" + String(millis() / 1000UL) + ",";
  json += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"heartRateBpm\":" + jsonNumberOrNull(pulseState.contactDetected ? pulseState.bpm : NAN, 1) + ",";
  json += "\"pulseSignal\":" + jsonIntegerOrNull(pulseState.raw, true) + ",";
  json += "\"ibiMs\":" + jsonIntegerOrNull((long)ibiAverage, pulseState.ibiCount > 0) + ",";
  json += "\"signalStrength\":" + String(pulseState.signalStrength) + ",";
  json += "\"contactDetected\":" + String(pulseState.contactDetected ? "true" : "false") + ",";
  json += "\"temperatureC\":" + jsonNumberOrNull(motionState.temperatureC, 2) + ",";
  json += "\"summary\":\"" + summary + "\",";
  json += "\"pulse\":{";
  json += "\"bpm\":" + jsonNumberOrNull(pulseState.contactDetected ? pulseState.bpm : NAN, 1) + ",";
  json += "\"raw\":" + String(pulseState.raw) + ",";
  json += "\"ibiMs\":" + jsonIntegerOrNull((long)ibiAverage, pulseState.ibiCount > 0) + ",";
  json += "\"signalStrength\":" + String(pulseState.signalStrength) + ",";
  json += "\"signalQuality\":\"" + signalQuality + "\",";
  json += "\"contactDetected\":" + String(pulseState.contactDetected ? "true" : "false");
  json += "},";
  json += "\"motion\":{";
  json += "\"temperatureC\":" + jsonNumberOrNull(motionState.temperatureC, 2) + ",";
  json += "\"pitch\":" + jsonNumberOrNull(motionState.pitch, 2) + ",";
  json += "\"roll\":" + jsonNumberOrNull(motionState.roll, 2) + ",";
  json += "\"movementScore\":" + jsonNumberOrNull(motionState.movementScore, 1) + ",";
  json += "\"fallDetected\":" + String(motionState.fallDetected ? "true" : "false") + ",";
  json += "\"posture\":\"" + posture + "\",";
  json += "\"accel\":{";
  json += "\"x\":" + jsonNumberOrNull(motionState.ax, 3) + ",";
  json += "\"y\":" + jsonNumberOrNull(motionState.ay, 3) + ",";
  json += "\"z\":" + jsonNumberOrNull(motionState.az, 3);
  json += "},";
  json += "\"gyro\":{";
  json += "\"x\":" + jsonNumberOrNull(motionState.gx, 2) + ",";
  json += "\"y\":" + jsonNumberOrNull(motionState.gy, 2) + ",";
  json += "\"z\":" + jsonNumberOrNull(motionState.gz, 2);
  json += "}";
  json += "},";
  json += "\"derived\":{";
  json += "\"stress\":\"" + stress + "\",";
  json += "\"posture\":\"" + posture + "\",";
  json += "\"postureDetail\":\"" + postureDetail + "\",";
  json += "\"signalStrength\":" + String(pulseState.signalStrength) + ",";
  json += "\"movementScore\":" + jsonNumberOrNull(motionState.movementScore, 1) + ",";
  json += "\"pitch\":" + jsonNumberOrNull(motionState.pitch, 2) + ",";
  json += "\"roll\":" + jsonNumberOrNull(motionState.roll, 2);
  json += "}";
  json += "}";

  return json;
}

void sendToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      return;
    }
  }

  const String payload = buildPayload();
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  const int responseCode = http.POST(payload);

  Serial.print("Upload response: ");
  Serial.println(responseCode);
  if (responseCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.println("Failed to send sensor packet to backend.");
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  Wire.begin(21, 22);

  Serial.println("Starting ESP32 pulse + MPU6050 telemetry");
  if (initMpu6050()) {
    Serial.println("MPU6050 initialized");
  } else {
    Serial.println("MPU6050 not detected. Check SDA/SCL wiring.");
  }

  connectWiFi();
}

void loop() {
  const unsigned long now = millis();

  if (now - lastPulseSampleAt >= PULSE_SAMPLE_INTERVAL_MS) {
    lastPulseSampleAt = now;
    updatePulseDetection(analogRead(PULSE_PIN), now);
    readMotion(motionState);
  }

  if (now - lastUploadAt >= UPLOAD_INTERVAL_MS) {
    lastUploadAt = now;

    Serial.print("BPM=");
    Serial.print(pulseState.bpm, 1);
    Serial.print(" | Raw=");
    Serial.print(pulseState.raw);
    Serial.print(" | Strength=");
    Serial.print(pulseState.signalStrength);
    Serial.print(" | Pitch=");
    Serial.print(motionState.pitch, 1);
    Serial.print(" | Roll=");
    Serial.print(motionState.roll, 1);
    Serial.print(" | Move=");
    Serial.println(motionState.movementScore, 1);

    sendToBackend();
  }
}
