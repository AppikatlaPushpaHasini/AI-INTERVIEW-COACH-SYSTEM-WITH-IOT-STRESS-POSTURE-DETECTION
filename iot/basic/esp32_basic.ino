#include <Arduino.h>
#include <Wire.h>

const int PULSE_PIN = 34;
const uint8_t MPU6050_ADDRESS = 0x68;
const unsigned long SAMPLE_INTERVAL_MS = 20;

unsigned long lastSampleAt = 0;

void writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU6050_ADDRESS);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool readBytes(uint8_t reg, uint8_t count, uint8_t *buffer) {
  Wire.beginTransmission(MPU6050_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  uint8_t received = Wire.requestFrom(MPU6050_ADDRESS, count, true);
  if (received != count) {
    return false;
  }

  for (uint8_t i = 0; i < count; i++) {
    buffer[i] = Wire.read();
  }

  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  analogReadResolution(12);
  Wire.begin(21, 22);
  writeRegister(0x6B, 0x00);

  Serial.println("ESP32 basic hardware test started");
  Serial.println("Reading pulse sensor and MPU6050 over Serial Monitor");
}

void loop() {
  const unsigned long now = millis();
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS) {
    return;
  }

  lastSampleAt = now;

  const int pulseRaw = analogRead(PULSE_PIN);
  uint8_t buffer[14];

  if (!readBytes(0x3B, 14, buffer)) {
    Serial.println("MPU6050 read failed");
    delay(200);
    return;
  }

  const int16_t axRaw = (buffer[0] << 8) | buffer[1];
  const int16_t ayRaw = (buffer[2] << 8) | buffer[3];
  const int16_t azRaw = (buffer[4] << 8) | buffer[5];
  const int16_t tempRaw = (buffer[6] << 8) | buffer[7];
  const int16_t gxRaw = (buffer[8] << 8) | buffer[9];
  const int16_t gyRaw = (buffer[10] << 8) | buffer[11];
  const int16_t gzRaw = (buffer[12] << 8) | buffer[13];

  const float ax = axRaw / 16384.0f;
  const float ay = ayRaw / 16384.0f;
  const float az = azRaw / 16384.0f;
  const float temperatureC = (tempRaw / 340.0f) + 36.53f;
  const float gx = gxRaw / 131.0f;
  const float gy = gyRaw / 131.0f;
  const float gz = gzRaw / 131.0f;

  Serial.print("PulseRaw=");
  Serial.print(pulseRaw);
  Serial.print(" | Accel=");
  Serial.print(ax, 3);
  Serial.print(",");
  Serial.print(ay, 3);
  Serial.print(",");
  Serial.print(az, 3);
  Serial.print(" | Gyro=");
  Serial.print(gx, 2);
  Serial.print(",");
  Serial.print(gy, 2);
  Serial.print(",");
  Serial.print(gz, 2);
  Serial.print(" | TempC=");
  Serial.println(temperatureC, 2);
}
