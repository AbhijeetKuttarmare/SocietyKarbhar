import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SuperadminScreen from './src/screens/SuperadminScreen';
import AdminScreen from './src/screens/AdminScreen';
import OwnerScreen from './src/screens/OwnerScreen';
import TenantScreen from './src/screens/TenantScreen';

export default function App(): JSX.Element {
  const [user, setUser] = useState<any | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        (() => {
          const role = user?.role;
          if (role === 'superadmin') return <SuperadminScreen user={user} onLogout={() => setUser(null)} />;
          if (role === 'admin') return <AdminScreen user={user} onLogout={() => setUser(null)} />;
          if (role === 'owner') return <OwnerScreen user={user} onLogout={() => setUser(null)} />;
          if (role === 'tenant') return <TenantScreen user={user} onLogout={() => setUser(null)} />;
          return <TenantScreen user={user} onLogout={() => setUser(null)} />;
        })()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }
});
