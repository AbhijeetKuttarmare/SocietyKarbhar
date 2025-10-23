import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthHeader, setToken } from './src/services/api';
import LoginScreen from './src/screens/LoginScreen';
import SuperadminScreen from './src/screens/SuperadminScreen';
import AdminScreen from './src/screens/AdminScreen';
import OwnerScreen from './src/screens/OwnerScreen';
import TenantScreen from './src/screens/TenantScreen';

export default function App(): JSX.Element {
  const [user, setUser] = useState<any | null>(null);

  const [restored, setRestored] = useState(false);

  useEffect(()=>{
    // restore user and token from AsyncStorage so hot reloads / refreshes keep the session
    (async ()=>{
      try{
        const raw = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('token');
        if(token) setAuthHeader(token);
        if(raw){
          const parsed = JSON.parse(raw);
          setUser(parsed);
        }
      }catch(e){ console.warn('restore user failed', e); }
      setRestored(true);
    })();
  }, []);

  async function handleLogin(u:any){
    try{
      // u should include token (LoginScreen passes token in onLogin)
      if(u?.token){
        await setToken(u.token);
        setAuthHeader(u.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(u));
      setUser(u);
    }catch(e){ console.warn('handleLogin failed', e); setUser(u); }
  }

  async function handleLogout(){
    try{
      await setToken('');
      await AsyncStorage.removeItem('user');
    }catch(e){ console.warn('logout cleanup failed', e); }
    setUser(null);
  }

  if(!restored){
    // while restoring session from storage, avoid rendering login to prevent flicker/logout
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {!user ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        (() => {
          const role = user?.role;
          if (role === 'superadmin') return <SuperadminScreen user={user} onLogout={handleLogout} />;
          if (role === 'admin') return <AdminScreen user={user} onLogout={handleLogout} />;
          if (role === 'owner') return <OwnerScreen user={user} onLogout={handleLogout} />;
          if (role === 'tenant') return <TenantScreen user={user} onLogout={handleLogout} />;
          return <TenantScreen user={user} onLogout={handleLogout} />;
        })()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }
});
