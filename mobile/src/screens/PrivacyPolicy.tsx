import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { onClose?: () => void };

export default function PrivacyPolicy({ onClose }: Props): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Privacy Policy</Text>
        <TouchableOpacity onPress={() => onClose && onClose()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <Text style={styles.paragraph}>
        We value your privacy. This Privacy Policy explains how we collect, use and disclose
        information when you use the Society Karbhar app. Replace this placeholder with your full
        privacy policy.
      </Text>

      <Text style={styles.sectionTitle}>Information Collection</Text>
      <Text style={styles.paragraph}>
        We may collect personal information such as name, phone number and other details necessary
        to provide the service.
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
