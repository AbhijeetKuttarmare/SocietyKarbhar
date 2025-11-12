import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { onClose?: () => void };

export default function AboutUs({ onClose }: Props): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>About Us</Text>
        <TouchableOpacity onPress={() => onClose && onClose()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>VR Data Solution Pvt. Ltd.</Text>
        <Text style={styles.paragraphLeft}>
          <Text style={{ fontWeight: '700' }}>VR Data Solution Pvt. Ltd.</Text> is a professional
          service provider based in Nagpur, Maharashtra, dedicated to delivering reliable,
          efficient, and high-quality business solutions.
        </Text>

        <Text style={styles.subHeading}>Our Address</Text>
        <Text style={styles.paragraphLeft}>
          Vijayshailya Complex, Mangalmurti Square,
          {'\n'}First Floor, Nagpur – 440022
        </Text>

        <Text style={styles.subHeading}>What we do</Text>
        <Text style={styles.paragraphLeft}>
          We specialize in a wide range of services including Data Entry, BPO Operations, Staffing
          Solutions, IT Services, and Digital Solutions. Our approach focuses on end-to-end support
          that enhances productivity and simplifies operations for our clients.
        </Text>

        <Text style={styles.subHeading}>Our mission</Text>
        <Text style={styles.paragraphLeft}>
          Our mission is to empower businesses by providing end-to-end support that improves
          productivity and simplifies operations. With a client-first approach and a focus on
          quality, we ensure accuracy, transparency, and timely delivery in every project.
        </Text>

        <Text style={styles.subHeading}>Our Core Team</Text>
        <View style={styles.teamList}>
          <Text style={styles.teamItem}>
            <Text style={styles.teamName}>Mr. Mohit Pote</Text> – Operations Head
          </Text>
          <Text style={styles.teamItem}>
            <Text style={styles.teamName}>Mr. Abhijeet Kuttarmare</Text> – Technical & Business
            Development Head
          </Text>
          <Text style={styles.teamItem}>
            <Text style={styles.teamName}>Ms. Rakshanda Somkuwar</Text> – HR & Training Head
          </Text>
        </View>

        <Text style={styles.paragraphLeft}>
          Together, our leadership team brings a wealth of experience, technical knowledge, and
          dedication to delivering innovative and scalable solutions tailored to our clients’ needs.
        </Text>

        <Text style={styles.paragraphLeft}>
          At <Text style={{ fontWeight: '700' }}>VR Data Solution Pvt. Ltd.</Text>, we believe in
          building long-term relationships through trust, commitment, and performance excellence.
        </Text>
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', alignItems: 'center' },
  logo: { width: 140, height: 140, marginBottom: 12 },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: { padding: 6, borderRadius: 6 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  heading: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: '#0f172a' },
  subHeading: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  paragraphLeft: { fontSize: 14, lineHeight: 20, color: '#333', textAlign: 'left' },
  teamList: { marginTop: 8, marginBottom: 8 },
  teamItem: { fontSize: 14, lineHeight: 20, color: '#333', marginBottom: 6 },
  teamName: { fontWeight: '700' },
});
