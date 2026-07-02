import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ModeSelectionScreen from '../screens/ModeSelectionScreen';
import DiscoveryScreen from '../screens/DiscoveryScreen';
import StreamScreen from '../screens/StreamScreen';

export default function Index() {
  const [mode, setMode] = useState<'select' | 'ip' | 'standalone'>('select');
  const [cameraIp, setCameraIp] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {cameraIp ? (
        <StreamScreen 
          ip={cameraIp} 
          onDisconnect={() => {
            setCameraIp(null);
            setMode('select');
          }} 
        />
      ) : mode === 'select' ? (
        <ModeSelectionScreen onSelectMode={(selected) => setMode(selected)} />
      ) : (
        <DiscoveryScreen 
          mode={mode} 
          onDiscovered={(ip) => setCameraIp(ip)} 
          onBack={() => setMode('select')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
