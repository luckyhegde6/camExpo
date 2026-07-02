import * as Network from 'expo-network';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const CAMERA_PORT = 80;
const STATUS_ENDPOINT = '/status';
const SCAN_TIMEOUT_MS = 2000;
const CONCURRENCY = 20;

function parseSubnet(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.`;
}

async function testIp(targetIp: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    const response = await fetch(`http://${targetIp}:${CAMERA_PORT}${STATUS_ENDPOINT}`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (response.ok) return targetIp;
    const text = await response.text();
    if (/esp32|camera/i.test(text)) return targetIp;
    return null;
  } catch {
    return null;
  }
}

async function scanSubnet(subnetPrefix: string, onProgress?: (scanned: number, total: number) => void): Promise<string[]> {
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${subnetPrefix}${i}`);
  }

  const total = ips.length;
  let scanned = 0;
  const found: string[] = [];

  for (let start = 0; start < total; start += CONCURRENCY) {
    const batch = ips.slice(start, start + CONCURRENCY);
    const results = await Promise.all(
      batch.map(ip => testIp(ip).then(result => {
        scanned++;
        onProgress?.(scanned, total);
        return result;
      }))
    );
    for (const ip of results) {
      if (ip) found.push(ip);
    }
    if (found.length > 0) break;
  }

  return found;
}

async function discoverViaApi(
  preferredIp?: string,
  onProgress?: (scanned: number, total: number) => void
): Promise<string[]> {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    const devServer = hostUri || (Platform.OS === 'android' ? '10.0.2.2:8081' : 'localhost:8081');
    const baseUrl = `http://${devServer}`;
    const params = preferredIp ? `?preferred=${preferredIp}` : '';
    onProgress?.(0, 1);
    const res = await fetch(`${baseUrl}/api/discover${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    onProgress?.(1, 1);
    return data.cameras || [];
  } catch (e) {
    console.log('Server-side discovery unavailable:', e);
    return [];
  }
}

export async function discoverEsp32Ip(
  preferredIp?: string,
  onProgress?: (scanned: number, total: number) => void
): Promise<string | null> {
  if (preferredIp) {
    const result = await testIp(preferredIp);
    if (result) return result;
  }

  const allFound: string[] = [];

  try {
    const deviceIp = await Network.getIpAddressAsync();
    console.log('Device IP is:', deviceIp);

    if (Platform.OS === 'android' && deviceIp.startsWith('10.0.2.')) {
      console.log('Emulator detected, trying server-side scan first...');
      const serverFound = await discoverViaApi(preferredIp, onProgress);
      if (serverFound.length > 0) {
        console.log('Server-side discovery found:', serverFound);
        allFound.push(...serverFound);
        return serverFound[0];
      }
    }

    if (deviceIp && deviceIp !== '0.0.0.0') {
      const subnet = parseSubnet(deviceIp);
      if (subnet) {
        console.log(`Scanning subnet ${subnet}0/24...`);
        const found = await scanSubnet(subnet, onProgress);
        if (found.length > 0) {
          allFound.push(...found);
          return found[0];
        }
      }
    }

    const commonSubnets = ['192.168.1.', '192.168.0.', '10.0.0.', '172.16.0.'];
    for (const subnet of commonSubnets) {
      if (subnet === parseSubnet(deviceIp)) continue;
      console.log(`Scanning fallback subnet ${subnet}0/24...`);
      const found = await scanSubnet(subnet, onProgress);
      if (found.length > 0) {
        allFound.push(...found);
        return found[0];
      }
    }

    return null;
  } catch (error) {
    console.error('Error during network discovery:', error);
    return null;
  }
}

export async function quickTestCamera(ip: string): Promise<boolean> {
  const result = await testIp(ip);
  return result !== null;
}
