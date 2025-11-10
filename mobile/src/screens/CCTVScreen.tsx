import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabContext } from '../contexts/BottomTabContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = { user?: any; navigation?: any; cameras?: any[]; loading?: boolean };

export default function CCTVScreen({ user, navigation, cameras, loading }: Props) {
  // Placeholder camera list. Replace with actual feeds or API integration.
  // If parent passed cameras, use them; otherwise use defaults
  const defaultCams = [
    { id: 'cam-1', name: 'Main Gate', thumbnail: null },
    { id: 'cam-2', name: 'Lobby', thumbnail: null },
    { id: 'cam-3', name: 'Compound', thumbnail: null },
  ];
  // Use default cameras only when parent did not pass a cameras prop (undefined/null).
  // If parent passes an empty array, show the "No cameras configured" message instead
  // so admins know there are no configured cameras (instead of showing dummies).
  const cams = Array.isArray(cameras) ? cameras : defaultCams;
  const bottomTab = useContext(BottomTabContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CCTV</Text>

      {/* Floating add camera button (top-right) - show only for admins */}
      {user && (user.role === 'admin' || user?.isAdmin) ? (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={async () => {
            try {
              // Set a flag so the Admin Cameras screen auto-opens the Add modal
              await AsyncStorage.setItem('openAddCamera', '1');
              if (bottomTab && bottomTab.setActiveKey) {
                bottomTab.setActiveKey('cameras');
                return;
              }

              if (navigation && navigation.navigate) return navigation.navigate('AddCamera');
            } catch (e) {}
            Alert.alert('Add camera', 'Open Add Camera screen (not implemented)');
          }}
          accessibilityLabel="Add camera"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {(!cams || cams.length === 0) && !loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#6b7280' }}>No cameras configured by your admin.</Text>
            <Text style={{ color: '#6b7280', marginTop: 6 }}>
              Ask an admin to add cameras from the Admin → Cameras screen.
            </Text>
          </View>
        ) : (
          cams.map((c: any) => {
            // derive thumbnail url from common fields
            const thumb = c.thumbnail || c.thumb || c.image || c.thumbnail_url || null;

            // build RTSP URL if available
            const safe = (v: any) => (v === undefined || v === null ? '' : String(v));
            const hasExplicitRtsp = c.rtsp_url || c.rtspUrl || c.rtsp;
            const rtspUrl = hasExplicitRtsp
              ? safe(c.rtsp_url || c.rtspUrl || c.rtsp)
              : (() => {
                  if (!c.ip_address && !c.ip) return null;
                  const ip = safe(c.ip_address || c.ip);
                  const port = safe(c.port || 554);
                  const user = safe(c.username || c.user || '');
                  const pass = safe(c.password || c.pass || '');
                  const path = (c.rtsp_path || c.path || '').replace(/^\/+/, '');
                  const auth = user
                    ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
                    : '';
                  return `rtsp://${auth}${ip}:${port}/${path}`;
                })();

            return (
              <View key={c.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => {
                    if (navigation && navigation.navigate) {
                      try {
                        navigation.navigate('CCTVDetail', { cameraId: c.id, camera: c });
                      } catch (e) {}
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.thumb}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumbImage} />
                      ) : (
                        <Ionicons name="camera" size={28} color="#374151" />
                      )}
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.name}>{c.name || c.label || c.id}</Text>
                      <Text style={styles.sub}>Tap to view live stream</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Action row: open detail / open RTSP externally / open in CCTV tab */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      if (navigation && navigation.navigate) {
                        try {
                          navigation.navigate('CCTVDetail', { cameraId: c.id, camera: c });
                          return;
                        } catch (e) {}
                      }
                    }}
                  >
                    <Text style={styles.actionText}>Open</Text>
                  </TouchableOpacity>

                  {rtspUrl ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        try {
                          Linking.openURL(rtspUrl).catch(() => {
                            Alert.alert('Open failed', 'Could not open RTSP URL');
                          });
                        } catch (e) {
                          Alert.alert('Open failed', String(e));
                        }
                      }}
                    >
                      <Text style={styles.actionText}>Open RTSP</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={async () => {
                      try {
                        if (rtspUrl) await AsyncStorage.setItem('openCameraRtsp', rtspUrl);
                        // Attempt to switch to CCTV tab if available
                        if (bottomTab && bottomTab.setActiveKey) bottomTab.setActiveKey('cctv');
                        // also try navigation fallback
                        if (navigation && navigation.navigate)
                          navigation.navigate('CCTVDetail', { cameraId: c.id, camera: c });
                      } catch (e) {
                        // ignore
                      }
                    }}
                  >
                    <Text style={styles.actionText}>Open in CCTV tab</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
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
  thumbImage: { width: 64, height: 64, borderRadius: 8, resizeMode: 'cover' },
  actionsRow: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end', gap: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#eef2f2',
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  actionText: { color: '#064e3b', fontWeight: '700', fontSize: 12 },
  name: { fontWeight: '700' },
  sub: { color: '#6b7280', fontSize: 12 },
  addBtn: {
    position: 'absolute',
    right: 14,
    top: Platform.OS === 'ios' ? 50 : 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0ea5a4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
