import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Switch, Modal, Image, ActivityIndicator, ScrollView, SafeAreaView, Platform, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
function getMediaLibrary(): typeof import('expo-media-library') | null {
  try { return require('expo-media-library'); } catch { return null; }
}
import { File, Paths } from 'expo-file-system';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/use-theme';
import { Spacing } from '../constants/theme';

interface StreamScreenProps {
  ip: string;
  onDisconnect: () => void;
}

const RESOLUTIONS = [
  { label: 'UXGA (1600x1200)', value: 10 },
  { label: 'SVGA (800x600)', value: 7 },
  { label: 'VGA (640x480)', value: 6 },
  { label: 'CIF (400x296)', value: 5 },
];

export default function StreamScreen({ ip, onDisconnect }: StreamScreenProps) {
  const theme = useTheme();

  const [flash, setFlash] = useState(false);
  const [resolution, setResolution] = useState(7);
  const [hmirror, setHmirror] = useState(0);
  const [vflip, setVflip] = useState(0);
  const [quality, setQuality] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [timestamp, setTimestamp] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInterval, setRecordingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [zoom, setZoom] = useState(0);

  const streamUrl = `http://${ip}:81/stream`;

  useEffect(() => {
    const syncStatus = async () => {
      setIsSyncing(true);
      try {
        const response = await fetch(`http://${ip}/status`);
        if (response.ok) {
          const data = await response.json();
          setFlash(data.flash);
          setResolution(data.framesize);
          if (data.hmirror !== undefined) setHmirror(data.hmirror);
          if (data.vflip !== undefined) setVflip(data.vflip);
          if (data.quality !== undefined) setQuality(data.quality);
        }
      } catch (e) {
        console.warn('Could not sync status with camera:', e);
      } finally {
        setIsSyncing(false);
      }
    };
    syncStatus();
  }, [ip]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimestamp(now.toLocaleString());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
    getMediaLibrary()?.requestPermissionsAsync();
  }, []);

  const sendControl = async (varName: string, val: number | string, optimisticSetter?: (v: any) => void, optimisticVal?: any) => {
    if (optimisticSetter && optimisticVal !== undefined) optimisticSetter(optimisticVal);
    try {
      const response = await fetch(`http://${ip}/control?var=${varName}&val=${val}`);
      if (!response.ok && optimisticSetter) {
        if (varName === 'flash') setFlash(flash);
        else if (varName === 'hmirror') setHmirror(hmirror);
        else if (varName === 'vflip') setVflip(vflip);
      }
    } catch (e) {
      console.warn(`Control ${varName} failed:`, e);
      if (optimisticSetter) {
        if (varName === 'flash') setFlash(flash);
        else if (varName === 'hmirror') setHmirror(hmirror);
        else if (varName === 'vflip') setVflip(vflip);
      }
    }
  };

  const toggleFlash = () => sendControl('flash', flash ? 0 : 1, setFlash, !flash);

  const toggleHmirror = () => sendControl('hmirror', hmirror ? 0 : 1, setHmirror, hmirror ? 0 : 1);

  const toggleVflip = () => sendControl('vflip', vflip ? 0 : 1, setVflip, vflip ? 0 : 1);

  const changeResolution = async (resValue: number) => {
    setResolution(resValue);
    try {
      await fetch(`http://${ip}/control?var=framesize&val=${resValue}`);
      setStreamKey(prev => prev + 1);
    } catch (e) {
      console.warn('Resolution control failed:', e);
    }
  };

  const changeQuality = async (val: number) => {
    setQuality(val);
    try {
      await fetch(`http://${ip}/control?var=quality&val=${val}`);
    } catch (e) {
      console.warn('Quality control failed:', e);
    }
  };

  const changeZoom = (val: number) => {
    setZoom(val);
    const framesizes = [10, 7, 6, 5, 4];
    const idx = Math.min(val, framesizes.length - 1);
    changeResolution(framesizes[idx]);
  };

  const saveToDevice = async (file: File) => {
    setSaving(true);
    try {
      const mediaLib = getMediaLibrary();
      if (!mediaLib) { Alert.alert('Save Failed', 'Media library not available'); setSaving(false); return; }
      const asset = await mediaLib.createAssetAsync(file.uri);
      Alert.alert('Saved', `Photo saved to gallery:\n${asset.filename}`);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const dest = new File(Paths.cache, `ESP32_CAM_${Date.now()}.jpg`);
      await File.downloadFileAsync(`http://${ip}/capture?t=${Date.now()}`, dest, { idempotent: true });
      const mediaLib = getMediaLibrary();
      if (!mediaLib) { Alert.alert('Save Failed', 'Media library not available'); setSaving(false); return; }
      const perm = await mediaLib.requestPermissionsAsync();
      if (perm.granted) {
        await saveToDevice(dest);
      } else {
        Alert.alert('Saved', `Photo saved to cache:\n${dest.uri}`);
      }
    } catch (e: any) {
      Alert.alert('Capture Failed', e.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recordingInterval) clearInterval(recordingInterval);
      setRecordingInterval(null);
      setIsRecording(false);
      Alert.alert('Recording Stopped', 'Frames saved to device gallery.');
      return;
    }
    setIsRecording(true);
    const interval = setInterval(async () => {
      try {
        const dest = new File(Paths.cache, `ESP32_REC_${Date.now()}.jpg`);
        await File.downloadFileAsync(`http://${ip}/capture?t=${Date.now()}`, dest, { idempotent: true });
      } catch (e) {
        console.warn('Recording frame failed:', e);
      }
    }, 1000);
    setRecordingInterval(interval);
  };

  const handleRefreshStream = () => {
    setStreamKey(prev => prev + 1);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onDisconnect}>
            <Text style={[styles.backButtonText, { color: theme.text }]}>← Disconnect</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>ESP32 Live</Text>
          <View style={styles.statusDotContainer}>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <View style={styles.activeDot} />
            )}
          </View>
        </View>

        {/* Stream + Overlay info */}
        <View style={[styles.videoWrapper, { backgroundColor: '#000', borderColor: theme.backgroundSelected }]}>
          <WebView
            key={streamKey}
            source={{ uri: streamUrl }}
            style={styles.webview}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.overlayTop}>
            <Text style={styles.overlayText}>{timestamp}</Text>
            {location && (
              <Text style={styles.overlayText}>
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </Text>
            )}
            <Text style={styles.overlayText}>IP: {ip}</Text>
          </View>
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} onPress={handleCapture}>
            <Text style={styles.actionBtnEmoji}>📸</Text>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Capture</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} onPress={handleRefreshStream}>
            <Text style={styles.actionBtnEmoji}>🔄</Text>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isRecording ? '#FF3B30' : theme.backgroundElement }]} onPress={toggleRecording}>
            <Text style={styles.actionBtnEmoji}>⏺</Text>
            <Text style={[styles.actionBtnText, { color: isRecording ? '#fff' : theme.text }]}>{isRecording ? 'Stop' : 'Record'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => setShowSettings(!showSettings)}>
            <Text style={styles.actionBtnEmoji}>⚙️</Text>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Saving indicator */}
        {saving && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: Spacing.two }} />}

        {/* Collapsible Settings */}
        {showSettings && (
          <View style={[styles.dashboard, { backgroundColor: theme.backgroundElement }]}>

            {/* Flash */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Flashlight</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>White flash LED</Text>
              </View>
              <Switch value={flash} onValueChange={toggleFlash} trackColor={{ false: '#767577', true: '#34C759' }} thumbColor={flash ? '#fff' : '#f4f3f4'} />
            </View>
            <View style={styles.divider} />

            {/* H-Mirror */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Horizontal Mirror</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Flip image left-right</Text>
              </View>
              <Switch value={!!hmirror} onValueChange={toggleHmirror} trackColor={{ false: '#767577', true: '#007AFF' }} thumbColor={hmirror ? '#fff' : '#f4f3f4'} />
            </View>
            <View style={styles.divider} />

            {/* V-Flip */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Vertical Flip</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Flip image upside-down</Text>
              </View>
              <Switch value={!!vflip} onValueChange={toggleVflip} trackColor={{ false: '#767577', true: '#007AFF' }} thumbColor={vflip ? '#fff' : '#f4f3f4'} />
            </View>
            <View style={styles.divider} />

            {/* Quality */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>JPEG Quality</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Lower = smaller, faster</Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.text }]}>{quality}</Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>High</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: 10 }}
                minimumValue={6}
                maximumValue={15}
                step={1}
                value={quality}
                onSlidingComplete={changeQuality}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#767577"
                thumbTintColor="#007AFF"
              />
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>Low</Text>
            </View>
            <View style={styles.divider} />

            {/* Resolution */}
            <View style={styles.resolutionContainer}>
              <Text style={[styles.settingTitle, { color: theme.text, marginBottom: Spacing.two }]}>Resolution</Text>
              <View style={styles.grid}>
                {RESOLUTIONS.map((res) => {
                  const isSelected = resolution === res.value;
                  return (
                    <TouchableOpacity
                      key={res.value}
                      style={[styles.resItem, { backgroundColor: isSelected ? '#007AFF' : theme.backgroundSelected, borderColor: isSelected ? '#007AFF' : 'transparent' }]}
                      onPress={() => changeResolution(res.value)}
                    >
                      <Text style={[styles.resItemText, { color: isSelected ? '#fff' : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }]}>{res.label.split(' ')[0]}</Text>
                      <Text style={[styles.resItemSub, { color: isSelected ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>{res.label.match(/\(([^)]+)\)/)?.[1] || ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.divider} />

            {/* Digital Zoom */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Digital Zoom</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Crop to lower resolution</Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.text }]}>{zoom}x</Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>1x</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: 10 }}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={zoom}
                onSlidingComplete={changeZoom}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#767577"
                thumbTintColor="#007AFF"
              />
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>4x</Text>
            </View>

          </View>
        )}

        <Text style={[styles.ipFooter, { color: theme.textSecondary }]}>Streaming via: {streamUrl}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: Spacing.four, maxWidth: 800, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.two, marginBottom: Spacing.three,
  },
  backButton: { paddingVertical: Spacing.one },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  statusDotContainer: { width: 30, alignItems: 'flex-end' },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759' },
  videoWrapper: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.three, overflow: 'hidden',
    borderWidth: 1, marginBottom: Spacing.four, position: 'relative',
  },
  webview: { width: '100%', height: '100%', backgroundColor: '#000' },
  overlayTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4,
  },
  overlayText: { color: '#fff', fontSize: 11, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  recBadge: {
    position: 'absolute', top: 4, right: 4,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 4 },
  recText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four },
  actionBtn: {
    flex: 1, paddingVertical: Spacing.two, borderRadius: Spacing.three,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.one,
  },
  actionBtnEmoji: { fontSize: 16 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  dashboard: { borderRadius: Spacing.four, padding: Spacing.four, marginBottom: Spacing.four },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  settingTitle: { fontSize: 15, fontWeight: 'bold' },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  settingValue: { fontSize: 15, fontWeight: '600', fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  sliderLabel: { fontSize: 12, width: 35, textAlign: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: Spacing.two },
  resolutionContainer: { paddingVertical: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  resItem: { flex: 1, minWidth: '45%', padding: Spacing.two, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  resItemText: { fontSize: 14 },
  resItemSub: { fontSize: 11, marginTop: 2 },
  ipFooter: { fontSize: 12, textAlign: 'center', marginBottom: Spacing.six },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  modalContent: { width: '100%', maxWidth: 550, borderRadius: Spacing.four, padding: Spacing.four, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.four },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalCloseIcon: { fontSize: 20, fontWeight: 'bold', padding: 5 },
  modalImageContainer: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000', borderRadius: Spacing.three, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', marginBottom: Spacing.four },
  modalImage: { width: '100%', height: '100%' },
  modalLoader: { position: 'absolute', zIndex: 10 },
  modalCloseBtn: { width: '100%', padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
