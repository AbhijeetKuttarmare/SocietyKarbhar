import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import AddCamera from './AddCamera';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabContext } from '../../contexts/BottomTabContext';

export default function CamerasScreen() {
  const [cams, setCams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [feedCam, setFeedCam] = useState<any | null>(null);
  const bottomTab = useContext(BottomTabContext);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/cameras');
      setCams(r.data.cameras || []);
    } catch (e) {
      // Improve logging for Axios errors: include HTTP status and response body when available
      try {
        const err: any = e;
        const status = err?.response?.status;
        const statusText = err?.response?.statusText;
        const body = err?.response?.data;
        console.warn('load cameras failed', { message: err?.message, status, statusText, body });
      } catch (logErr) {
        console.warn('load cameras failed', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const v = await AsyncStorage.getItem('openAddCamera');
        if (v === '1') {
          await AsyncStorage.removeItem('openAddCamera');
          setShowAdd(true);
        }
      } catch (e) {}
    })();
  }, []);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>Cameras</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={{ padding: 8 }}>
          <Ionicons name="add-circle" size={28} color="#0ea5a4" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={cams}
          keyExtractor={(c) => String(c.id)}
          style={{ marginTop: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: '#6b7280' }}>
                  {item.ip_address}:{item.port}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.smallBtn]}
                  onPress={async () => {
                    // Try to open a feed modal with RTSP or fall back to external player
                    const cam = item;
                    setFeedCam(cam);
                  }}
                >
                  <Text style={{ color: '#fff' }}>View Feed</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showAdd} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Add Camera</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={{ color: '#2563eb' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
          <AddCamera
            onCancel={() => setShowAdd(false)}
            onSaved={(c) => {
              setShowAdd(false);
              load();
            }}
          />
        </View>
      </Modal>

      {/* Feed modal */}
      <Modal visible={!!feedCam} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
          <View style={{ margin: 24, backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{feedCam?.name || 'Camera'}</Text>
            <Text style={{ color: '#6b7280', marginTop: 6 }}>{feedCam?.ip_address || ''}</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={[styles.smallBtn, { marginBottom: 8 }]}
              onPress={() => {
                try {
                  const rtsp = buildRtsp(feedCam);
                  if (rtsp) Linking.openURL(rtsp);
                } catch (e) {
                  Alert.alert('Open failed');
                }
              }}
            >
              <Text style={{ color: '#fff' }}>Open in external player</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#2563eb' }]}
              onPress={async () => {
                try {
                  // Store selected camera rtsp for guards and switch to CCTV tab
                  const rtsp = buildRtsp(feedCam);
                  if (rtsp) await AsyncStorage.setItem('openCameraRtsp', rtsp);
                  if (bottomTab && bottomTab.setActiveKey) {
                    // Switch to admin's cameras tab (keeps admin mapping consistent)
                    bottomTab.setActiveKey('cameras');
                  }
                  setFeedCam(null);
                } catch (e) {
                  Alert.alert('Failed to open in CCTV');
                }
              }}
            >
              <Text style={{ color: '#fff' }}>Open in CCTV tab</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            <TouchableOpacity onPress={() => setFeedCam(null)} style={{ alignItems: 'center' }}>
              <Text style={{ color: '#2563eb' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function buildRtsp(cam: any) {
  if (!cam) return null;
  const user = cam.username || '';
  const pass = cam.password || '';
  const host = cam.ip_address || cam.ip || cam.host || '';
  const port = cam.port || 554;
  const path = cam.rtsp_path || cam.path || '';
  let creds = '';
  if (user || pass) creds = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
  return `rtsp://${creds}${host}:${port}/${String(path).replace(/^\//, '')}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallBtn: {
    backgroundColor: '#0ea5a4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
