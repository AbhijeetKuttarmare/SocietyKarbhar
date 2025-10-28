import React from 'react';
import { View, Text } from 'react-native';

export default function LogsScreen() {
  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Logs</Text>
      <Text>Activity logs will appear here (placeholder).</Text>
    </View>
  );
}
