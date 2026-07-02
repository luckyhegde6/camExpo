import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Switch, Modal, Image, ActivityIndicator, ScrollView, SafeAreaView, Platform } from 'react-native';
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
  const [resolution, setResolution] = useState(7); // default SVGA
  const [isSyncing, setIsSyncing] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [streamKey, setStreamKey] = useState(0); // key to force reload stream WebView

  const streamUrl = `http://${ip}:81/stream`;

  // Fetch current settings on mount
  useEffect(() => {
    const syncStatus = async () => {
      setIsSyncing(true);
      try {
        const response = await fetch(`http://${ip}/status`);
        if (response.ok) {
          const data = await response.json();
          setFlash(data.flash);
          setResolution(data.framesize);
        }
      } catch (e) {
        console.warn('Could not sync status with camera:', e);
      } finally {
        setIsSyncing(false);
      }
    };
    
    syncStatus();
  }, [ip]);

  const toggleFlash = async () => {
    const nextVal = !flash;
    setFlash(nextVal); // Optimistic UI update
    
    try {
      const response = await fetch(`http://${ip}/control?var=flash&val=${nextVal ? 1 : 0}`);
      if (!response.ok) {
        setFlash(flash); // Revert on failure
      }
    } catch (e) {
      console.warn('Flash control request failed:', e);
      setFlash(flash); // Revert
    }
  };

  const changeResolution = async (resValue: number) => {
    setResolution(resValue);
    try {
      const response = await fetch(`http://${ip}/control?var=framesize&val=${resValue}`);
      if (response.ok) {
        // Force reload the stream webview to load the new resolution feed
        setStreamKey(prev => prev + 1);
      } else {
        console.warn('Failed to update camera resolution');
      }
    } catch (e) {
      console.warn('Resolution control request failed:', e);
    }
  };

  const handleCapture = () => {
    setIsCapturing(true);
    // Use timestamp to prevent caching of capture URL
    setSnapshotUrl(`http://${ip}/capture?t=${Date.now()}`);
  };

  const handleRefreshStream = () => {
    setStreamKey(prev => prev + 1);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header Bar */}
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

        {/* Video Viewport Container */}
        <View style={[styles.videoWrapper, { backgroundColor: '#000', borderColor: theme.backgroundSelected }]}>
          <WebView 
            key={streamKey}
            source={{ uri: streamUrl }}
            style={styles.webview}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Action Controls Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} 
            onPress={handleCapture}
          >
            <Text style={styles.actionBtnEmoji}>📸</Text>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Capture Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} 
            onPress={handleRefreshStream}
          >
            <Text style={styles.actionBtnEmoji}>🔄</Text>
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>

        {/* Controller Settings Dashboard */}
        <View style={[styles.dashboard, { backgroundColor: theme.backgroundElement }]}>
          
          {/* Flashlight LED switch */}
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Onboard Flashlight</Text>
              <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Toggle the white flash LED</Text>
            </View>
            <Switch
              value={flash}
              onValueChange={toggleFlash}
              trackColor={{ false: '#767577', true: '#34C759' }}
              thumbColor={flash ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.divider} />

          {/* Camera Resolution selectors */}
          <View style={styles.resolutionContainer}>
            <Text style={[styles.settingTitle, { color: theme.text, marginBottom: Spacing.two }]}>
              Camera Stream Resolution
            </Text>
            <View style={styles.grid}>
              {RESOLUTIONS.map((res) => {
                const isSelected = resolution === res.value;
                return (
                  <TouchableOpacity
                    key={res.value}
                    style={[
                      styles.resItem,
                      { 
                        backgroundColor: isSelected ? '#007AFF' : theme.backgroundSelected,
                        borderColor: isSelected ? '#007AFF' : 'transparent'
                      }
                    ]}
                    onPress={() => changeResolution(res.value)}
                  >
                    <Text style={[
                      styles.resItemText,
                      { color: isSelected ? '#fff' : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }
                    ]}>
                      {res.label.split(' ')[0]}
                    </Text>
                    <Text style={[
                      styles.resItemSub,
                      { color: isSelected ? 'rgba(255,255,255,0.7)' : theme.textSecondary }
                    ]}>
                      {res.label.match(/\(([^)]+)\)/)?.[1] || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </View>

        {/* Info Footer */}
        <Text style={[styles.ipFooter, { color: theme.textSecondary }]}>
          Streaming via: {streamUrl}
        </Text>

        {/* Snapshot Modal */}
        <Modal visible={!!snapshotUrl} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Photo Captured</Text>
                <TouchableOpacity onPress={() => setSnapshotUrl(null)}>
                  <Text style={[styles.modalCloseIcon, { color: theme.text }]}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalImageContainer}>
                {isCapturing && (
                  <ActivityIndicator size="large" color="#007AFF" style={styles.modalLoader} />
                )}
                <Image
                  source={{ uri: snapshotUrl || '' }}
                  style={styles.modalImage}
                  onLoadEnd={() => setIsCapturing(false)}
                  resizeMode="contain"
                />
              </View>

              <TouchableOpacity 
                style={[styles.modalCloseBtn, { backgroundColor: '#007AFF' }]}
                onPress={() => setSnapshotUrl(null)}
              >
                <Text style={styles.modalCloseBtnText}>Close Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  backButton: {
    paddingVertical: Spacing.one,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusDotContainer: {
    width: 30,
    alignItems: 'flex-end',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtnEmoji: {
    fontSize: 18,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dashboard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: Spacing.three,
  },
  resolutionContainer: {
    paddingVertical: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  resItem: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  resItemText: {
    fontSize: 14,
  },
  resItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  ipFooter: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.six,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    width: '100%',
    maxWidth: 550,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 5,
  },
  modalImageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.four,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalLoader: {
    position: 'absolute',
    zIndex: 10,
  },
  modalCloseBtn: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
