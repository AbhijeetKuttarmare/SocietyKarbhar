import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';
import api from '../services/api';
import UserProfileForm from '../components/UserProfileForm';

type Props = {
  user: any;
  onLogout: () => void;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
};

export default function AdminProfile({ user, onLogout, userAvatar, setUserAvatar }: Props) {
  const [profile, setProfile] = useState<any>(user || {});

  useEffect(() => {
    setProfile(user || {});
  }, [user]);

  const onChange = (patch: any) => setProfile((p: any) => ({ ...(p || {}), ...(patch || {}) }));

  const onEditAvatar = async () => {
    try {
      const url = await pickAndUploadProfile();
      if (!url) return;
      // persist to server and update local/profile
      try {
        const r = await api.put('/api/user', { avatar: url });
        if (r && r.data && r.data.user) setProfile(r.data.user);
      } catch (e) {
        // optimistic update if server fails
        setProfile((p: any) => ({ ...(p || {}), avatar: url }));
      }
      setUserAvatar && setUserAvatar(url);
      alert('Profile photo updated');
    } catch (e) {
      console.warn('admin profile upload failed', e);
      alert('Upload failed');
    }
  };

  const saveProfile = async () => {
    try {
      const payload: any = {
        name: profile?.name,
        phone: profile?.phone,
        address: profile?.address,
        email: profile?.email,
        emergency_contact: profile?.emergency_contact,
      };
      const r = await api.put('/api/user', payload);
      if (r && r.data && r.data.user) {
        setProfile(r.data.user);
        // keep global avatar in sync
        setUserAvatar && setUserAvatar(r.data.user.avatar || r.data.user.image);
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
