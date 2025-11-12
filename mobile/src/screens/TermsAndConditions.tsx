import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { onClose?: () => void };

export default function TermsAndConditions({ onClose }: Props): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Terms & Conditions</Text>
        <TouchableOpacity onPress={() => onClose && onClose()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <Text style={styles.paragraph}>
        These Terms and Conditions govern your use of the Society Karbhar mobile application. Please
        read them carefully. By using the app you agree to be bound by these terms. This is
        placeholder text — replace with your real terms.
      </Text>

      <Text style={styles.sectionTitle}>1. Use of Service</Text>
      <Text style={styles.paragraph}>
        You may use the service only in compliance with applicable laws and the terms contained
        herein.
      </Text>

      <Text style={styles.sectionTitle}>2. Account</Text>
      <Text style={styles.paragraph}>
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activities that occur under your account.
      </Text>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: { padding: 6, borderRadius: 6 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 20, color: '#333' },
});
