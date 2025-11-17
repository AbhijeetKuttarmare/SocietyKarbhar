import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { notify } from '../services/notifier';

type Props = {
  onNavigate?: (route: 'AboutUs' | 'PrivacyPolicy' | 'TermsAndConditions') => void;
  navigation?: any;
};

export default function AppInfoSection({ onNavigate, navigation }: Props) {
  const appVersion =
    (Constants as any).manifest?.version || (Constants as any).expoConfig?.version || '1.0.0';

  const handlePress = (
    route: 'AboutUs' | 'PrivacyPolicy' | 'TermsAndConditions',
    message: string
  ) => {
    try {
      notify({ type: 'info', message });
    } catch (e) {}

    if (onNavigate) {
      onNavigate(route);
    } else if (navigation && navigation.navigate) {
      try {
        navigation.navigate(route);
      } catch (e) {
        console.warn('Navigation failed:', e);
      }
    }
  };

  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>App Info</Text>

      <TouchableOpacity
        style={styles.infoItem}
        onPress={() => handlePress('AboutUs', 'Opening About Us...')}
      >
        <View style={styles.infoIcon}>
          <Ionicons name="information-circle" size={20} color="#fff" />
        </View>
        <Text style={styles.infoText}>About Us</Text>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.infoItem}
        onPress={() => handlePress('PrivacyPolicy', 'Opening Privacy Policy...')}
      >
        <View style={[styles.infoIcon, { backgroundColor: '#fb7185' }]}>
          <Ionicons name="lock-closed" size={18} color="#fff" />
        </View>
        <Text style={styles.infoText}>Privacy Policy</Text>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.infoItem}
        onPress={() => handlePress('TermsAndConditions', 'Opening Terms & Conditions...')}
      >
        <View style={[styles.infoIcon, { backgroundColor: '#06b6d4' }]}>
          <Ionicons name="document-text" size={18} color="#fff" />
        </View>
        <Text style={styles.infoText}>Terms & Conditions</Text>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  infoSection: {
    marginTop: 18,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
