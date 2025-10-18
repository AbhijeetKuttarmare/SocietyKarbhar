import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

type Props = { user: any; onLogout: () => void };

export default function TenantScreen({ user, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tenant Dashboard</Text>
      <Text>View agreements and raise complaints.</Text>
      <View style={{ marginTop: 20 }}>
        <Button title="Logout" onPress={onLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 24 }, title: { fontSize: 22, fontWeight: '700' } });
