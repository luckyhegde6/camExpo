import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Platform, SafeAreaView } from 'react-native';
import BleService from '../services/BleService';
import { discoverEsp32Ip, quickTestCamera } from '../services/NetworkDiscovery';
import { useTheme } from '../hooks/use-theme';
import { Spacing } from '../constants/theme';

interface DiscoveryScreenProps {
  mode: 'ip' | 'standalone';
  onDiscovered: (ip: string) => void;
  onBack: () => void;
}

const IP_STORAGE_KEY = 'esp32_cam_saved_ip';

export default function DiscoveryScreen({ mode, onDiscovered, onBack }: DiscoveryScreenProps) {
  const theme = useTheme();
  
  // Safe AsyncStorage/LocalStorage helper
  const getSavedIp = (): string => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(IP_STORAGE_KEY) || 'esp32cam.local';
      }
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return 'esp32cam.local';
  };

  const saveIp = (targetIp: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(IP_STORAGE_KEY, targetIp);
      }
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  };

  const [ip, setIp] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Idle');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showBleConfig, setShowBleConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 0 });
  const [discoveredCameras, setDiscoveredCameras] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'ip') {
      setIp(getSavedIp());
    } else {
      setIp('192.168.4.1'); // Default SoftAP IP
    }
  }, [mode]);

  const testCameraConnection = async (targetIp: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500); // 3.5 sec timeout
      
      const response = await fetch(`http://${targetIp}/status`, { signal: controller.signal });
      clearTimeout(id);
      return response.ok;
    } catch (e) {
      console.log('Connection test failed:', e);
      return false;
    }
  };

  const handleIpConnect = async () => {
    if (!ip.trim()) return;
    setIsConnecting(true);
    setStatus(`Connecting to http://${ip}...`);

    const formattedIp = ip.trim().replace(/^https?:\/\//, '');
    const isReachable = await testCameraConnection(formattedIp);

    if (isReachable) {
      saveIp(formattedIp);
      setStatus('Connected!');
      setIsConnecting(false);
      onDiscovered(formattedIp);
    } else {
      setStatus('Could not connect to camera. Make sure the camera is powered on and your phone is on the same network.');
      setIsConnecting(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setDiscoveredCameras([]);
    setScanProgress({ scanned: 0, total: 254 });
    setStatus('Scanning local network for ESP32-CAM...');

    const foundIp = await discoverEsp32Ip(ip.trim() || undefined, (scanned, total) => {
      setScanProgress({ scanned, total });
      setStatus(`Scanning... ${scanned}/${total}`);
    });

    if (foundIp) {
      setDiscoveredCameras([foundIp]);
      setIp(foundIp);
      setStatus(`Found camera at ${foundIp}! Tap "Connect to Stream".`);
    } else {
      setStatus('No ESP32-CAM found on the network. Check power & connection, or enter IP manually above.');
    }
    setIsScanning(false);
  };

  const handlePair = async () => {
    setIsConnecting(true);
    setStatus('Scanning for ESP32-CAM BLE service...');
    
    BleService.scanAndConnect(async (device) => {
      setStatus(`Connected to ${device.name}. Sending Wi-Fi credentials...`);
      const success = await BleService.sendCredentials(ssid, password);
      
      if (success) {
        setStatus('Credentials sent! Waiting for ESP32 to connect to your network...');
        
        // Wait for connection
        setTimeout(async () => {
          setStatus('Searching for camera local IP...');
          const discoveredIp = await discoverEsp32Ip();
          if (discoveredIp) {
            setStatus('Camera found on network!');
            setIsConnecting(false);
            onDiscovered(discoveredIp);
          } else {
            setStatus('Credentials sent successfully, but could not resolve the IP. Please check your router or enter the IP manually.');
            setIsConnecting(false);
          }
        }, 6000);
      } else {
        setStatus('Failed to send credentials over BLE. Ensure you are close to the camera.');
        setIsConnecting(false);
      }
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={[styles.backButtonText, { color: theme.text }]}>← Change Mode</Text>
        </TouchableOpacity>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>
          {mode === 'ip' ? 'Network IP Setup' : 'Direct Connection'}
        </Text>

        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {mode === 'ip' 
            ? 'Connect via Wi-Fi Network or Internet' 
            : 'Connect directly to the camera’s Access Point'}
        </Text>

        {mode === 'ip' ? (
          /* NETWORK IP MODE SCREEN */
          <View style={styles.card}>
            <Text style={[styles.label, { color: theme.text }]}>IPv4 Address or Hostname</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.backgroundElement, 
                borderColor: theme.backgroundSelected,
                color: theme.text 
              }]}
              placeholder="e.g. 192.168.1.100 or esp32cam.local"
              placeholderTextColor={theme.textSecondary}
              value={ip}
              onChangeText={setIp}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#007AFF' }]} 
              onPress={handleIpConnect}
              disabled={isConnecting || !ip}
            >
              <Text style={styles.buttonText}>Connect to Stream</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.outlineButton, { borderColor: theme.backgroundSelected }]}
              onPress={handleScan}
              disabled={isScanning || isConnecting}
            >
              <Text style={[styles.outlineButtonText, { color: theme.text }]}>
                {isScanning ? `Scanning (${scanProgress.scanned}/${scanProgress.total})` : discoveredCameras.length > 0 ? 'Scan Again' : 'Scan Network'}
              </Text>
            </TouchableOpacity>

            {discoveredCameras.length > 0 && (
              <View style={styles.discoveredSection}>
                <Text style={[styles.discoveredTitle, { color: theme.text }]}>Discovered Cameras</Text>
                {discoveredCameras.map((camIp) => (
                  <TouchableOpacity
                    key={camIp}
                    style={[styles.cameraItem, { backgroundColor: theme.backgroundElement, borderColor: camIp === ip ? '#007AFF' : theme.backgroundSelected }]}
                    onPress={() => setIp(camIp)}
                  >
                    <View>
                      <Text style={[styles.cameraIp, { color: theme.text }]}>{camIp}</Text>
                      <Text style={[styles.cameraStatus, { color: theme.textSecondary }]}>
                        {camIp === ip ? 'Selected' : 'Tap to select'}
                      </Text>
                    </View>
                    {camIp === ip && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.tipContainer}>
              <Text style={[styles.tipTitle, { color: theme.text }]}>💡 Quick Tip</Text>
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Ensure the camera is powered up and connected to the same Wi-Fi router. The default hostname is usually <Text style={styles.codeText}>esp32cam.local</Text>.
              </Text>
            </View>
          </View>
        ) : (
          /* STANDALONE AP MODE SCREEN */
          <View style={styles.card}>
            
            <View style={styles.instructionsContainer}>
              <Text style={[styles.instructionStep, { color: theme.text }]}>
                1. Open your phone's Wi-Fi Settings.
              </Text>
              <Text style={[styles.instructionStep, { color: theme.text }]}>
                2. Connect to the network: <Text style={styles.highlightText}>ESP32-CAM-AP</Text> (No Password).
              </Text>
              <Text style={[styles.instructionStep, { color: theme.text }]}>
                3. Return here and tap Connect.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#34C759' }]} 
              onPress={handleIpConnect}
              disabled={isConnecting}
            >
              <Text style={styles.buttonText}>Connect Direct</Text>
            </TouchableOpacity>

            {/* BLE Toggle Button */}
            <TouchableOpacity 
              style={[styles.outlineButton, { borderColor: theme.backgroundSelected }]}
              onPress={() => setShowBleConfig(!showBleConfig)}
            >
              <Text style={[styles.outlineButtonText, { color: theme.text }]}>
                {showBleConfig ? 'Hide Wi-Fi Provisioner' : 'Configure Camera Wi-Fi (BLE)'}
              </Text>
            </TouchableOpacity>

            {showBleConfig && (
              <View style={styles.bleForm}>
                <Text style={[styles.bleTitle, { color: theme.text }]}>Wi-Fi Setup over Bluetooth</Text>
                <Text style={[styles.bleSubtitle, { color: theme.textSecondary }]}>
                  Send your Wi-Fi credentials to make the ESP32 connect to your home router.
                </Text>

                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.backgroundElement, 
                    borderColor: theme.backgroundSelected,
                    color: theme.text 
                  }]}
                  placeholder="Router SSID"
                  placeholderTextColor={theme.textSecondary}
                  value={ssid}
                  onChangeText={setSsid}
                />
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.backgroundElement, 
                    borderColor: theme.backgroundSelected,
                    color: theme.text 
                  }]}
                  placeholder="Router Password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: '#5856D6' }]} 
                  onPress={handlePair}
                  disabled={isConnecting || !ssid || !password}
                >
                  <Text style={styles.buttonText}>Pair & Connect Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Status display */}
        {status !== 'Idle' && (
          <View style={[styles.statusContainer, { backgroundColor: theme.backgroundElement }]}>
            {isConnecting && <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 10 }} />}
            <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: Spacing.four,
    paddingTop: Spacing.six,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    marginBottom: Spacing.four,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: Spacing.five,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  input: {
    borderWidth: 1.5,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  button: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineButton: {
    borderWidth: 1.5,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.three,
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  instructionsContainer: {
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  instructionStep: {
    fontSize: 16,
    lineHeight: 22,
  },
  highlightText: {
    fontWeight: 'bold',
    color: '#34C759',
  },
  tipContainer: {
    marginTop: Spacing.five,
    padding: Spacing.three,
    backgroundColor: 'rgba(255, 204, 0, 0.08)',
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.2)',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    fontWeight: 'bold',
  },
  bleForm: {
    marginTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: Spacing.four,
  },
  bleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  bleSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.four,
    lineHeight: 17,
  },
  discoveredSection: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  discoveredTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  cameraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  cameraIp: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  cameraStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  checkMark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: Spacing.five,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
  },
});
