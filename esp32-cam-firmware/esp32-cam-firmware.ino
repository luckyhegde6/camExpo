#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "sdkconfig.h"

// ── Wi-Fi credentials ──────────────────────────────────
#define WIFI_SSID "wifissidhere"
#define WIFI_PASSWORD "passhere"

// Flash LED GPIO (GPIO 4 on AI-Thinker boards)
#define FLASH_GPIO_NUM 4

// ── BLE provisioning (only compiled when WIFI_SSID is not defined) ──
#ifndef WIFI_SSID
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
String receivedCredentials = "";

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; }
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        receivedCredentials = rxValue;
        Serial.println("Received: " + receivedCredentials);
      }
    }
};
#endif // !WIFI_SSID

// Select camera model
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// MJPEG stream boundary
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t camera_httpd = NULL;
httpd_handle_t stream_httpd = NULL;

// ── HTTP handlers ──────────────────────────────────────

static esp_err_t status_handler(httpd_req_t *req) {
  sensor_t *s = esp_camera_sensor_get();
  if (!s) {
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  char json[512];
  snprintf(json, sizeof(json),
    "{"
    "\"flash\":%s,"
    "\"framesize\":%u,"
    "\"quality\":%u,"
    "\"brightness\":%d,"
    "\"contrast\":%d,"
    "\"saturation\":%d,"
    "\"sharpness\":%d,"
    "\"hmirror\":%u,"
    "\"vflip\":%u,"
    "\"ae_level\":%d,"
    "\"awb\":%u,"
    "\"agc\":%u,"
    "\"aec\":%u,"
    "\"special_effect\":%u,"
    "\"wb_mode\":%u"
    "}",
    digitalRead(FLASH_GPIO_NUM) ? "true" : "false",
    s->status.framesize,
    s->status.quality,
    s->status.brightness,
    s->status.contrast,
    s->status.saturation,
    s->status.sharpness,
    s->status.hmirror,
    s->status.vflip,
    s->status.ae_level,
    s->status.awb,
    s->status.agc,
    s->status.aec,
    s->status.special_effect,
    s->status.wb_mode
  );
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json, strlen(json));
}

static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[128];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  httpd_resp_set_hdr(req, "Connection", "close");

  int64_t last_frame = esp_timer_get_time();

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      log_e("Camera capture failed");
      res = ESP_FAIL;
      break;
    }
    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    if (res != ESP_OK) { esp_camera_fb_return(fb); break; }

    size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, _jpg_buf_len);
    res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res != ESP_OK) { esp_camera_fb_return(fb); break; }

    res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    esp_camera_fb_return(fb);
    _jpg_buf = NULL;
    if (res != ESP_OK) break;

    int64_t frame_time = esp_timer_get_time() - last_frame;
    last_frame = esp_timer_get_time();
    int32_t frame_ms = frame_time / 1000;
    if (frame_ms < 50) delay(50 - frame_ms);
  }

  return res;
}

static esp_err_t cmd_handler(httpd_req_t *req) {
  char buf[256];
  if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) != ESP_OK) {
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }
  char var[32] = {0}, val[32] = {0};
  httpd_query_key_value(buf, "var", var, sizeof(var));
  httpd_query_key_value(buf, "val", val, sizeof(val));

  sensor_t *s = esp_camera_sensor_get();
  int res = 0;

  if (!strcmp(var, "flash")) {
    digitalWrite(FLASH_GPIO_NUM, atoi(val) ? HIGH : LOW);
  } else if (!strcmp(var, "framesize") && s) {
    res = s->set_framesize(s, (framesize_t)atoi(val));
  } else if (!strcmp(var, "quality") && s) {
    res = s->set_quality(s, atoi(val));
  } else if (!strcmp(var, "contrast") && s) {
    res = s->set_contrast(s, atoi(val));
  } else if (!strcmp(var, "brightness") && s) {
    res = s->set_brightness(s, atoi(val));
  } else if (!strcmp(var, "saturation") && s) {
    res = s->set_saturation(s, atoi(val));
  } else if (!strcmp(var, "sharpness") && s) {
    res = s->set_sharpness(s, atoi(val));
  } else if (!strcmp(var, "hmirror") && s) {
    res = s->set_hmirror(s, atoi(val));
  } else if (!strcmp(var, "vflip") && s) {
    res = s->set_vflip(s, atoi(val));
  } else if (!strcmp(var, "ae_level") && s) {
    res = s->set_ae_level(s, atoi(val));
  } else if (!strcmp(var, "awb") && s) {
    res = s->set_whitebal(s, atoi(val));
  } else if (!strcmp(var, "agc") && s) {
    res = s->set_gain_ctrl(s, atoi(val));
  } else if (!strcmp(var, "aec") && s) {
    res = s->set_exposure_ctrl(s, atoi(val));
  } else if (!strcmp(var, "special_effect") && s) {
    res = s->set_special_effect(s, atoi(val));
  } else if (!strcmp(var, "wb_mode") && s) {
    res = s->set_wb_mode(s, atoi(val));
  } else {
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  if (res < 0) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, "OK", 2);
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.lru_purge_enable = true;

  httpd_uri_t status_uri = {
    .uri = "/status", .method = HTTP_GET, .handler = status_handler, .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
    , .is_websocket = true, .handle_ws_control_frames = false, .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t capture_uri = {
    .uri = "/capture", .method = HTTP_GET, .handler = capture_handler, .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
    , .is_websocket = true, .handle_ws_control_frames = false, .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t cmd_uri = {
    .uri = "/control", .method = HTTP_GET, .handler = cmd_handler, .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
    , .is_websocket = true, .handle_ws_control_frames = false, .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t stream_uri = {
    .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
    , .is_websocket = true, .handle_ws_control_frames = false, .supported_subprotocol = NULL
#endif
  };

  Serial.printf("Starting web server on port: '%u'\n", config.server_port);
  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &status_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &cmd_uri);
  } else {
    Serial.println("Failed to start camera HTTP server");
  }

  config.server_port += 1;
  config.ctrl_port += 1;
  Serial.printf("Starting stream server on port: '%u'\n", config.server_port);
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  } else {
    Serial.println("Failed to start stream HTTP server");
  }
}

// ── SoftAP + BLE mode ──────────────────────────────────

void startSoftAP() {
  WiFi.softAP("ESP32-CAM-AP", "");
  Serial.println("SoftAP started: ESP32-CAM-AP (no password)");
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
  if (!MDNS.begin("esp32cam")) {
    Serial.println("mDNS failed");
  } else {
    Serial.println("mDNS: esp32cam.local");
  }
  startCameraServer();
}

#ifndef WIFI_SSID
void setupBLE() {
  BLEDevice::init("ESP32-CAM-SETUP");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ  |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY|
    BLECharacteristic::PROPERTY_INDICATE
  );
  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  Serial.println("BLE advertising as ESP32-CAM-SETUP");
}
#endif // !WIFI_SSID

// ── Camera init (separated so it can run after WiFi connects) ──

static bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0  = Y2_GPIO_NUM;
  config.pin_d1  = Y3_GPIO_NUM;
  config.pin_d2  = Y4_GPIO_NUM;
  config.pin_d3  = Y5_GPIO_NUM;
  config.pin_d4  = Y6_GPIO_NUM;
  config.pin_d5  = Y7_GPIO_NUM;
  config.pin_d6  = Y8_GPIO_NUM;
  config.pin_d7  = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_CIF;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }

  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  return true;
}

// Drain any residual frames from the camera (clears FB-OVF condition)
static void drainCameraFrames() {
  for (int i = 0; i < 4; i++) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    else break;
    delay(10);
  }
}

// ── setup() ───────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  bool wifiConnected = false;

#ifdef WIFI_SSID
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP: ");
    Serial.println(WiFi.localIP());

    if (initCamera()) {
      drainCameraFrames();
    }

    if (!MDNS.begin("esp32cam")) {
      Serial.println("mDNS failed");
    } else {
      Serial.println("mDNS: esp32cam.local");
    }
    startCameraServer();
    wifiConnected = true;
  } else {
    Serial.println("Failed to connect. Falling back to SoftAP mode.");
  }
#endif

  if (!wifiConnected) {
    initCamera();
    drainCameraFrames();
    startSoftAP();
#ifndef WIFI_SSID
    setupBLE();
#endif
  }
}

// ── loop() ────────────────────────────────────────────

void loop() {
#ifndef WIFI_SSID
  if (receivedCredentials.indexOf(";") > 0 && WiFi.status() != WL_CONNECTED) {
    int sep = receivedCredentials.indexOf(";");
    String ssid = receivedCredentials.substring(0, sep);
    String pass = receivedCredentials.substring(sep + 1);
    Serial.println("Connecting via BLE credentials to: " + ssid);
    WiFi.begin(ssid.c_str(), pass.c_str());
    for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
      delay(500); Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("WiFi connected, IP: ");
      Serial.println(WiFi.localIP());
      WiFi.softAPdisconnect(true);
      if (!MDNS.begin("esp32cam")) Serial.println("mDNS failed");
      else Serial.println("mDNS: esp32cam.local");
      startCameraServer();
      BLEDevice::deinit(false);
    } else {
      Serial.println("WiFi connection failed. Retry.");
    }
    receivedCredentials = "";
  }

  if (BLEDevice::getInitialized()) {
    if (!deviceConnected && oldDeviceConnected) {
      delay(500);
      pServer->startAdvertising();
      Serial.println("BLE re-advertising");
      oldDeviceConnected = deviceConnected;
    }
    if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
    }
  }
#endif

  delay(100);
}
