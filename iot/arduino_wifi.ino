#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  delay(1200);
  Serial.println("Deprecated placeholder sketch.");
  Serial.println("Use iot/esp32_advanced/esp32_advanced.ino for the real Wi-Fi firmware.");
  Serial.println("Use iot/esp32_basic/esp32_basic.ino for the serial hardware test.");
}

void loop() {
  delay(1500);
}
