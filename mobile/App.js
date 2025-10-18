// Re-export the TypeScript App entry so editors/packagers that look for App.js still work.
module.exports = require('./App.tsx');
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App(): JSX.Element {
  const [user, setUser] = useState<any | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <HomeScreen user={user} onLogout={() => setUser(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }
});
