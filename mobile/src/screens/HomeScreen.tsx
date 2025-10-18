import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

type Props = { user: any; onLogout: () => void };

export default function HomeScreen({ user, onLogout }: Props): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.name || 'User'}</Text>
      <Text>Role: {user?.role}</Text>
      <View style={{ marginTop: 20 }}>
        <Button title="Logout" onPress={onLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcome: { fontSize: 22, marginBottom: 8 }
});
