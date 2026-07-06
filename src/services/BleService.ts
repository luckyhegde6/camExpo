import { BleManager, Device } from 'react-native-ble-plx';

class BleService {
  manager: BleManager | null = null;
  connectedDevice: Device | null = null;

  private ensureManager(): BleManager | null {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch {
        return null;
      }
    }
    return this.manager;
  }

  async scanAndConnect(onDeviceFound: (device: Device) => void) {
    const manager = this.ensureManager();
    if (!manager) return;
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }
      if (device?.name === 'ESP32-CAM-SETUP') {
        manager.stopDeviceScan();
        onDeviceFound(device);
        this.connectToDevice(device);
      }
    });
  }

  async connectToDevice(device: Device) {
    try {
      const connected = await device.connect();
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = discovered;
      console.log('Connected and discovered services');
    } catch (e) {
      console.error('Connection error:', e);
    }
  }

  async sendCredentials(ssid: string, pass: string) {
    if (!this.connectedDevice) return false;
    try {
      const payload = `${ssid};${pass}`;
      // In a real app you might use base64 encoding depending on the characteristic
      const base64Payload = btoa(payload); 
      // Replace with actual Service/Characteristic UUIDs from ESP32
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
        'beb5483e-36e1-4688-b7f5-ea07361b26a8',
        base64Payload
      );
      return true;
    } catch (e) {
      console.error('Failed to send credentials:', e);
      return false;
    }
  }

  destroy() {
    if (this.manager) {
      this.manager.destroy();
    }
  }
}

export default new BleService();
