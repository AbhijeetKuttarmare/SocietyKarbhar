import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import UserProfileForm from '../components/UserProfileForm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notify } from '../services/notifier';

type Props = {
  user: any;
  onLogout: () => void;
  navigation?: any;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
  setUser?: (u?: any) => void;
};

export default function AdminProfile({
  user,
  onLogout,
  navigation,
  userAvatar,
  setUserAvatar,
  setUser,
}: Props) {
  const [profile, setProfile] = useState<any>(user || {});

  useEffect(() => {
    setProfile(user || {});
  }, [user]);

  const onChange = (patch: any) => setProfile((p: any) => ({ ...(p || {}), ...(patch || {}) }));

  const onEditAvatar = async () => {
    try {
      // Pick image only and set locally; actual upload will occur when user presses Save
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify({ type: 'warning', message: 'Permission to access photos is required' });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        // use string 'images' for compatibility with newer expo-image-picker shapes
        mediaTypes: (ImagePicker as any).MediaType?.images || 'images',
        quality: 0.8,
      });
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      if (cancelled) return;
      const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
      if (!asset || !asset.uri) {
        notify({ type: 'error', message: 'Could not read image data' });
        return;
      }
      const uri: string = asset.uri;
      // update local profile only; save will persist to server
      setProfile((p: any) => ({ ...(p || {}), avatar: uri }));
      setUserAvatar && setUserAvatar(uri);
    } catch (e) {
      console.warn('admin profile pick failed', e);
      notify({ type: 'error', message: 'Could not pick image' });
    }
  };

  const saveProfile = async () => {
    try {
      // Prepare payload for fields (exclude avatar; avatar will be uploaded separately if local URI)
      const payload: any = {};
      for (const k of ['name', 'phone', 'address', 'email', 'emergency_contact']) {
        if (typeof (profile as any)[k] !== 'undefined') payload[k] = (profile as any)[k];
      }

      // If avatar is a local URI (not a remote http(s) URL or data:), upload it via multipart to /api/user/avatar
      const avatarVal = profile?.avatar;
      let uploadedUser: any = null;
      if (
        avatarVal &&
        typeof avatarVal === 'string' &&
        !/^https?:\/\//i.test(avatarVal) &&
        !/^data:/i.test(avatarVal)
      ) {
        try {
          // Quick connectivity test so we can give a clearer error when the device cannot reach the backend
          try {
            const ping = await (api as any).testConnectivity?.();
            if (!ping || !ping.ok) {
              const resolved = (api.defaults && (api.defaults as any).baseURL) || 'unknown';
              notify({
                type: 'error',
                message: `Cannot reach backend at ${resolved}. Ensure your device can access the dev machine (update mobile/src/services/config.js DEFAULT_HOST if needed).`,
              });
              // stop the upload early
              throw new Error('backend-unreachable');
            }
          } catch (pingErr) {
            // proceed — we'll catch network errors below, but surface a helpful message
            // if ping specifically indicated unreachable, rethrow
            if (String(pingErr).includes('backend-unreachable')) throw pingErr;
          }
          // Prefer using axios instance so baseURL and auth headers are used consistently.
          const formData: any = new FormData();

          if (Platform.OS === 'web') {
            const resp = await fetch(avatarVal);
            const blob = await resp.blob();
            formData.append('file', blob, avatarVal.split('/').pop() || 'photo.jpg');
          } else {
            // On native, append the file object with uri/name
            formData.append('file', {
              uri: avatarVal,
              name: avatarVal.split('/').pop() || 'photo.jpg',
              type: 'image/jpeg',
            } as any);
          }

          // Use axios API to post multipart form so Authorization header (if present) is attached
          // Do NOT set Content-Type manually — let the client/runtime set the boundary.
          let resp: any = null;
          try {
            resp = await api.post('/api/user/avatar', formData as any, {
              headers: { Accept: 'application/json' },
            });
          } catch (axErr) {
            console.warn('axios post failed for avatar upload, trying fetch fallback', axErr);
            // Try a fetch fallback to the fully-resolved URL to bypass any axios-specific issues
            try {
              const base = (api.defaults && (api.defaults as any).baseURL) || '';
              const uploadUrl = `${String(base).replace(/\/$/, '')}/api/user/avatar`;
              const headers: any = {};
              if (
                api.defaults &&
                (api.defaults as any).headers &&
                (api.defaults as any).headers.Authorization
              ) {
                headers.Authorization = (api.defaults as any).headers.Authorization;
              }
              const fResp = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
              const txt = await fResp.text();
              try {
                resp = { data: JSON.parse(txt), status: fResp.status, ok: fResp.ok };
              } catch (e) {
                resp = { data: { raw: txt }, status: fResp.status, ok: fResp.ok };
              }
            } catch (fetchErr) {
              console.warn('fetch fallback also failed for avatar upload', fetchErr);
              throw axErr; // rethrow original axios error so outer catch handles it
            }
          }

          if (resp && resp.data) {
            const jd = resp.data;
            if (jd.user) {
              uploadedUser = jd.user;
              setProfile(uploadedUser);
              setUserAvatar && setUserAvatar(uploadedUser.avatar || uploadedUser.image);
              try {
                await AsyncStorage.setItem('user', JSON.stringify(uploadedUser));
                setUser && setUser(uploadedUser);
              } catch (e) {
                /* ignore storage errors */
              }
            } else if (jd.url) {
              profile.avatar = jd.url;
              setUserAvatar && setUserAvatar(jd.url);
              try {
                await api.put('/api/user', { avatar: jd.url });
              } catch (e) {
                console.warn('failed to persist avatar url via PUT /api/user', e);
              }
            }
          }
        } catch (e: any) {
          console.warn('avatar upload failed during save', e);
          // Network request failed often means the configured host/port is unreachable from device.
          notify({
            type: 'error',
            message:
              (e && e.message) ||
              'Failed to upload avatar. Check your backend URL and device network (LAN IP).',
          });
        }
      }

      // Now update other profile fields via PUT /api/user if there are changes
      try {
        const r = await api.put('/api/user', payload);
        if (r && r.data && r.data.user) {
          setProfile(r.data.user);
          setUserAvatar && setUserAvatar(r.data.user.avatar || r.data.user.image);
          try {
            await AsyncStorage.setItem('user', JSON.stringify(r.data.user));
            setUser && setUser(r.data.user);
          } catch (e) {
            /* ignore storage errors */
          }
        }
      } catch (e) {
        console.warn('saveProfile failed to update user fields', e);
      }

      // Finally, refresh full user from server to ensure UI shows the persisted avatar
      try {
        const me = await api.get('/api/user/me');
        if (me && me.data && me.data.user) {
          setProfile(me.data.user);
          setUserAvatar && setUserAvatar(me.data.user.avatar || me.data.user.image);
          try {
            await AsyncStorage.setItem('user', JSON.stringify(me.data.user));
            setUser && setUser(me.data.user);
          } catch (e) {
            /* ignore storage errors */
          }
        }
      } catch (e) {
        // ignore; we already attempted to update
      }

      notify({ type: 'success', message: 'Profile saved' });
    } catch (e) {
      console.warn('saveProfile failed', e);
      notify({ type: 'error', message: 'Save failed' });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header card removed as requested */}

      <View style={styles.formCard}>
        <UserProfileForm
          profile={profile}
          onChange={onChange}
          onEditAvatar={onEditAvatar}
          onCall={(p: string) => {
            try {
              (require('react-native').Linking as any).openURL(`tel:${p}`);
            } catch (e) {}
          }}
          onSave={saveProfile}
          documents={[]}
          pickAndUploadFile={pickAndUploadFile}
          saveDocumentToServer={async () => null}
          uploadingDocId={null}
        />
      </View>

      <View style={{ height: 12 }} />

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <TouchableOpacity
          style={styles.infoItem}
          onPress={() => {
            try {
              notify({ type: 'info', message: 'Opening About Us...' });
            } catch (e) {}
            try {
              (navigation && navigation.navigate && navigation.navigate('AboutUs')) || null;
            } catch (e) {}
          }}
        >
          <View style={styles.infoIcon}>
            <Ionicons name="information-circle" size={20} color="#fff" />
          </View>
          <Text style={styles.infoText}>About Us</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.infoItem}
          onPress={() => {
            try {
              notify({ type: 'info', message: 'Opening Privacy Policy...' });
            } catch (e) {}
            try {
              (navigation && navigation.navigate && navigation.navigate('PrivacyPolicy')) || null;
            } catch (e) {}
          }}
        >
          <View style={[styles.infoIcon, { backgroundColor: '#fb7185' }]}>
            <Ionicons name="lock-closed" size={18} color="#fff" />
          </View>
          <Text style={styles.infoText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.infoItem}
          onPress={() => {
            try {
              notify({ type: 'info', message: 'Opening Terms & Conditions...' });
            } catch (e) {}
            try {
              (navigation && navigation.navigate && navigation.navigate('TermsAndConditions')) ||
                null;
            } catch (e) {}
          }}
        >
          <View style={[styles.infoIcon, { backgroundColor: '#06b6d4' }]}>
            <Ionicons name="document-text" size={18} color="#fff" />
          </View>
          <Text style={styles.infoText}>Terms & Conditions</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#f7fafc' },
  pageTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  infoRow: { marginBottom: 10 },
  headerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
  },
  headerLeft: { marginRight: 12 },
  headerRight: { flex: 1 },
  avatar: { width: 84, height: 84, borderRadius: 18 },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#4f46e5' },
  subText: { color: '#6b7280', marginTop: 4 },
  infoSection: { marginTop: 18, backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoText: { flex: 1, fontSize: 15, color: '#0f172a' },
  label: { color: '#6b7280', fontWeight: '700', marginBottom: 4 },
  value: { color: '#111', fontSize: 15 },
  logoutBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  /* new styles for improved header and form */
  avatarWrap: { position: 'relative' },
  cameraButton: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: '#4f46e5',
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  nameText: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  phoneText: { fontSize: 15, color: '#0f172a', fontWeight: '600' },
  callButton: { backgroundColor: '#10b981', padding: 10, borderRadius: 10 },
  formCard: {
    marginTop: 14,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
});
