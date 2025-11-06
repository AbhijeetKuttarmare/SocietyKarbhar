import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import UserProfileForm from '../components/UserProfileForm';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  user: any;
  onLogout: () => void;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
  setUser?: (u?: any) => void;
};

export default function AdminProfile({ user, onLogout, userAvatar, setUserAvatar, setUser }: Props) {
  const [profile, setProfile] = useState<any>(user || {});

  useEffect(() => {
    setProfile(user || {});
  }, [user]);

  const onChange = (patch: any) => setProfile((p: any) => ({ ...(p || {}), ...(patch || {}) }));

  const onEditAvatar = async () => {
    try {
      // Pick image only and set locally; actual upload will occur when user presses Save
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return alert('Permission to access photos is required');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      if (cancelled) return;
      const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
      if (!asset || !asset.uri) return alert('Could not read image data');
      const uri: string = asset.uri;
      // update local profile only; save will persist to server
      setProfile((p: any) => ({ ...(p || {}), avatar: uri }));
      setUserAvatar && setUserAvatar(uri);
    } catch (e) {
      console.warn('admin profile pick failed', e);
      alert('Could not pick image');
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
      if (avatarVal && typeof avatarVal === 'string' && !/^https?:\/\//i.test(avatarVal) && !/^data:/i.test(avatarVal)) {
        try {
          const formData: any = new FormData();
          if (Platform.OS === 'web') {
            const resp = await fetch(avatarVal);
            const blob = await resp.blob();
            formData.append('file', blob, avatarVal.split('/').pop() || 'photo.jpg');
          } else {
            try {
              const resp = await fetch(avatarVal);
              const blob = await resp.blob();
              formData.append('file', blob, avatarVal.split('/').pop() || 'photo.jpg');
            } catch (e) {
              // fallback to legacy object if blob conversion fails
              formData.append('file', { uri: avatarVal, name: avatarVal.split('/').pop() || 'photo.jpg' } as any);
            }
          }

          const token = await (async () => {
            try {
              return await (await import('@react-native-async-storage/async-storage')).default.getItem('token');
            } catch (e) {
              return null;
            }
          })();
          const headers: any = {};
          if (token) headers.Authorization = `Bearer ${token}`;

          const base = (api.defaults && (api.defaults as any).baseURL) || '';
          const uploadUrl = `${String(base).replace(/\/$/, '')}/api/user/avatar`;
          const resp = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
          const jd = await resp.json().catch(() => ({} as any));
          if (resp.ok && jd && jd.user) {
            uploadedUser = jd.user;
            setProfile(uploadedUser);
            setUserAvatar && setUserAvatar(uploadedUser.avatar || uploadedUser.image);
            try {
              await AsyncStorage.setItem('user', JSON.stringify(uploadedUser));
              setUser && setUser(uploadedUser);
            } catch (e) {
              /* ignore storage errors */
            }
          } else if (resp.ok && jd && jd.url) {
            // some handlers may return only a url. Persist this avatar to the user record
            profile.avatar = jd.url;
            setUserAvatar && setUserAvatar(jd.url);
            try {
              await api.put('/api/user', { avatar: jd.url });
            } catch (e) {
              console.warn('failed to persist avatar url via PUT /api/user', e);
            }
          }
        } catch (e) {
          console.warn('avatar upload failed during save', e);
          alert('Failed to upload avatar');
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

      alert('Profile saved');
    } catch (e) {
      console.warn('saveProfile failed', e);
      alert('Save failed');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Profile</Text>

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

      <View style={{ height: 12 }} />
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
  label: { color: '#6b7280', fontWeight: '700', marginBottom: 4 },
  value: { color: '#111', fontSize: 15 },
  logoutBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: '700' },
});
