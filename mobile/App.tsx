import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as Font from 'expo-font';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthHeader, setToken } from './src/services/api';
import LoginScreen from './src/screens/LoginScreen';
import SuperadminScreen from './src/screens/SuperadminScreen';
import AdminScreen from './src/screens/AdminScreen';
import OwnerScreen from './src/screens/OwnerScreen';
import TenantScreen from './src/screens/TenantScreen';
import SecurityGuardScreen from './src/screens/SecurityGuardScreen';
import CCTVScreen from './src/screens/CCTVScreen';
import BottomTab from './src/components/BottomTab';
import { BottomTabProvider, BottomTabContext } from './src/contexts/BottomTabContext';

export default function App() {
  const [user, setUser] = useState<any | null>(null);

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // restore user and token from AsyncStorage so hot reloads / refreshes keep the session
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('token');
        if (token) setAuthHeader(token);
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser(parsed);
          // Refresh user from server to ensure associations (society/adminSocieties) are up-to-date
          // This helps when admin assigns an owner/tenant to a society and the user's stored profile is stale
          try {
            const r = await api.get('/user/me');
            if (r && r.data && r.data.user) {
              await AsyncStorage.setItem('user', JSON.stringify(r.data.user));
              setUser(r.data.user);
            }
          } catch (e) {
            // ignore refresh errors (network/offline) and continue using cached user
          }
        }
      } catch (e) {
        console.warn('restore user failed', e);
      }
      setRestored(true);
    })();
  }, []);

  async function handleLogin(u: any) {
    try {
      // u should include token (LoginScreen passes token in onLogin)
      if (u?.token) {
        await setToken(u.token);
        setAuthHeader(u.token);
      }
      await AsyncStorage.setItem('user', JSON.stringify(u));
      setUser(u);
    } catch (e) {
      console.warn('handleLogin failed', e);
      setUser(u);
    }
  }

  async function handleLogout() {
    try {
      await setToken('');
      await AsyncStorage.removeItem('user');
    } catch (e) {
      console.warn('logout cleanup failed', e);
    }
    setUser(null);
  }

  if (!restored) {
    // while restoring session from storage, avoid rendering login to prevent flicker/logout
    return <SafeAreaView style={styles.container} />;
  }

  return (
    <SafeAreaProvider>
      <BottomTabProvider>
        <SafeAreaView style={styles.container}>
          {!user ? (
            <LoginScreen onLogin={handleLogin} />
          ) : (
            (() => {
              const role = user?.role;
              if (role === 'superadmin')
                return <SuperadminScreen user={user} onLogout={handleLogout} />;
              if (role === 'admin')
                return <AdminScreen user={user} onLogout={handleLogout} setUser={setUser} />;
              if (role === 'security_guard')
                return <SecurityGuardScreen user={user} onLogout={handleLogout} />;
              if (role === 'owner') return <OwnerScreen user={user} onLogout={handleLogout} />;
              if (role === 'tenant') return <TenantScreen user={user} onLogout={handleLogout} />;
              return <TenantScreen user={user} onLogout={handleLogout} />;
            })()
          )}
          {/* Global bottom tab - fixed across all screens. Owner has an inline bottom bar
        inside OwnerScreen, so avoid rendering the global bar for owners to prevent
        duplicate / overlapping tabs. */}
          {user && user.role !== 'owner' ? <BottomTabWrapper user={user} /> : null}
        </SafeAreaView>
      </BottomTabProvider>
    </SafeAreaProvider>
  );
}

// Small wrapper resolves tab items based on user role and syncs with context
function BottomTabWrapper({ user }: { user: any }) {
  const ctx = React.useContext(BottomTabContext);
  // Build bottom items per-role so role-specific screens (e.g. Superadmin)
  // receive the keys they expect.
  let items: any[] = [];
  if (user && user.role === 'superadmin') {
    items = [
      { key: 'home', label: 'Dashboard', icon: 'home' },
      { key: 'societies', label: 'Societies', icon: 'business' },
      { key: 'admins', label: 'Admins', icon: 'people' },
      { key: 'profile', label: 'Profile', icon: 'person' },
    ];
  } else {
    items.push({ key: 'home', label: 'Home', icon: 'home' });
    items.push({ key: 'helplines', label: 'Helplines', icon: 'call' });
    // Role-specific tabs
    if (user && user.role === 'security_guard') {
      // override items for guard
      items = [
        { key: 'home', label: 'Home', icon: 'home' },
        { key: 'scan', label: 'Scan', icon: 'qr-code' },
        { key: 'cctv', label: 'CCTV', icon: 'videocam' },
        { key: 'directory', label: 'Directory', icon: 'business' },
        { key: 'profile', label: 'Profile', icon: 'person' },
      ];
      return <BottomTab activeKey={ctx.activeKey} onChange={ctx.setActiveKey} items={items} />;
    }
    // Admin users get a dedicated 'Users' tab
    if (user && user.role === 'admin') {
      // admin internal tab key is 'cameras' (AdminScreen maps this -> cameras tab)
      items.push({ key: 'cameras', label: 'CCTV', icon: 'videocam' });
      items.push({ key: 'users', label: 'Users', icon: 'people' });
    }
    // Tenant-specific tab
    if (user && user.role === 'tenant') {
      items.push({ key: 'tenants', label: 'My Owner', icon: 'people' });
    }
    items.push({ key: 'bills', label: 'Bills', icon: 'receipt' });
    items.push({ key: 'profile', label: 'Profile', icon: 'person' });
  }

  return <BottomTab activeKey={ctx.activeKey} onChange={ctx.setActiveKey} items={items} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  debugHeader: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debugText: { fontSize: 12, color: '#333' },
  debugIcons: { flexDirection: 'row', gap: 12 },
});
