import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import ConfirmBox from '../components/ConfirmBox';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = { user: any; onLogout: () => void };

export default function HomeScreen({ user, onLogout }: Props): React.ReactElement {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.name || 'User'}</Text>
      <Text>Role: {user?.role}</Text>
      <View style={{ marginTop: 20 }}>
        <Button title="Logout" onPress={() => setShowLogoutConfirm(true)} />
      </View>
      <ConfirmBox
        visible={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to logout?"
        danger={false}
        confirmLabel="Logout"
        cancelLabel="Cancel"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          try {
            if (typeof onLogout === 'function') return onLogout();
            try {
              await AsyncStorage.removeItem('token');
            } catch (er) {}
          } catch (e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcome: { fontSize: 22, marginBottom: 8 },
});
