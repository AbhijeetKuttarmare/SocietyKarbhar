import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import ProfileCard from '../components/ProfileCard';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { notify } from '../services/notifier';

type Props = {
  user?: any;
  onBack?: () => void;
  onNavigate?: (route: 'AboutUs' | 'PrivacyPolicy' | 'TermsAndConditions') => void;
};

export default function SuperadminProfile({ user, onBack, onNavigate }: Props) {
  const name = (user && (user.name || user.full_name)) || '';
  const phone = (user && (user.phone || user.mobile_number || user.mobile)) || '';
  const avatar = (user && (user.avatar || user.image || user.image_url)) || undefined;

  const openLink = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        notify({ type: 'warning', message: 'Cannot open link' });
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      notify({ type: 'error', message: 'Failed to open link' });
    }
  };

  const appVersion =
    (Constants as any).manifest?.version || (Constants as any).expoConfig?.version || '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ width: '100%', maxWidth: 720 }}>
        <ProfileCard
          name={name}
          phone={phone}
          imageUri={avatar}
          onEdit={() => notify({ type: 'info', message: 'Edit profile not implemented' })}
          onCall={(p) => {
            try {
              Linking.openURL(`tel:${p}`);
            } catch (e) {
              notify({ type: 'error', message: 'Cannot make call' });
            }
          }}
        />

        <Text style={styles.sectionTitle}>App information</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => (onNavigate ? onNavigate('PrivacyPolicy') : openLink('https://example.com/privacy'))}
          accessibilityRole="button"
        >
          <View style={styles.leftRow}>
            <Feather name="lock" size={18} color="#111" />
            <Text style={styles.rowText}>Privacy Policy</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => (onNavigate ? onNavigate('TermsAndConditions') : openLink('https://example.com/terms'))}
          accessibilityRole="button"
        >
          <View style={styles.leftRow}>
            <MaterialIcons name="gavel" size={18} color="#111" />
            <Text style={styles.rowText}>Terms & Conditions</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => (onNavigate ? onNavigate('AboutUs') : openLink('https://example.com/about'))}
          accessibilityRole="button"
        >
          <View style={styles.leftRow}>
            <Feather name="info" size={18} color="#111" />
            <Text style={styles.rowText}>About Us</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.leftRow}>
            <Feather name="info" size={18} color="#111" />
            <Text style={styles.rowText}>App version</Text>
          </View>
          <Text style={{ color: '#6b7280' }}>{appVersion}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 8, color: '#111' },
  row: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leftRow: { flexDirection: 'row', alignItems: 'center' },
  rowText: { marginLeft: 12, fontSize: 15, color: '#111' },
});
