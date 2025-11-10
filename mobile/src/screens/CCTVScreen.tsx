import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = { user?: any; navigation?: any };

export default function CCTVScreen({ user, navigation }: Props) {
  // Placeholder camera list. Replace with actual feeds or API integration.
  const cameras = [
    { id: 'cam-1', name: 'Main Gate', thumbnail: null },
    { id: 'cam-2', name: 'Lobby', thumbnail: null },
    { id: 'cam-3', name: 'Compound', thumbnail: null },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CCTV</Text>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {cameras.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.card}
            onPress={() => {
              // Placeholder action: navigate to a detailed view or open live stream
              if (navigation && navigation.navigate) {
                try {
                  navigation.navigate('CCTVDetail', { cameraId: c.id });
                } catch (e) {}
              }
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.thumb}>
                <Ionicons name="camera" size={28} color="#374151" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.sub}>Tap to view live stream</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', padding: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontWeight: '700' },
  sub: { color: '#6b7280', fontSize: 12 },
});
