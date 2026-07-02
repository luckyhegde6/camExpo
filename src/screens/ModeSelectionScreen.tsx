import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useTheme } from '../hooks/use-theme';
import { Spacing } from '../constants/theme';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: 'ip' | 'standalone') => void;
}

export default function ModeSelectionScreen({ onSelectMode }: ModeSelectionScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.background === '#000000' ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        
        {/* Title Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>ESP32-CAM Viewer</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select how you would like to connect to your camera
          </Text>
        </View>

        {/* Mode Cards */}
        <View style={styles.cardsContainer}>
          
          {/* IP Mode Card */}
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} 
            onPress={() => onSelectMode('ip')}
            activeOpacity={0.85}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconEmoji}>🌐</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Network Mode (IP Address)</Text>
              <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                Stream and control your camera over your local Wi-Fi router or the internet. Requires entering the camera's IPv4 address.
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>RECOMMENDED</Text>
            </View>
          </TouchableOpacity>

          {/* Standalone Mode Card */}
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} 
            onPress={() => onSelectMode('standalone')}
            activeOpacity={0.85}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconEmoji}>📡</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Standalone Mode (Direct AP)</Text>
              <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                Connect directly to the camera's self-hosted Wi-Fi hotspot (ESP32-CAM-AP) when no local network is available. Also includes BLE provisioning.
              </Text>
            </View>
          </TouchableOpacity>

        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Ensure your ESP32-CAM is powered by a stable 5V 2A supply to prevent network dropout or reset.
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'space-between',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginTop: Spacing.six,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
  },
  cardsContainer: {
    gap: Spacing.four,
    marginVertical: Spacing.six,
  },
  card: {
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      },
    }),
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.four,
  },
  iconEmoji: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: '#007AFF',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footer: {
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Spacing.four,
  },
});
