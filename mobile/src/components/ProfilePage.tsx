import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import ConfirmBox from './ConfirmBox';
import { Ionicons } from '@expo/vector-icons';
import ProfileCard from './ProfileCard';
import UserProfileForm from './UserProfileForm';
import AppInfoSection from './AppInfoSection';
import { pickAndUploadFile } from '../services/uploadProfile';
import api from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notify } from '../services/notifier';

type Props = {
  user: any;
  onLogout?: () => void;
  navigation?: any;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
  setUser?: (u?: any) => void;
  onNavigate?: (route: 'AboutUs' | 'PrivacyPolicy' | 'TermsAndConditions') => void;
  variant?: 'admin' | 'superadmin' | 'guard' | 'tenant' | 'owner';
  showTitle?: boolean;
  showLogoutButton?: boolean;
  showAppInfo?: boolean;
  showEditableForm?: boolean;
  containerStyle?: any;
  fetchEndpoint?: string; // Custom endpoint for fetching profile data
};

export default function ProfilePage({
  user,
  onLogout,
  navigation,
  userAvatar,
  setUserAvatar,
  setUser,
  onNavigate,
  variant = 'admin',
  showTitle = true,
  showLogoutButton = true,
  showAppInfo = true,
  showEditableForm = true,
  containerStyle,
  fetchEndpoint,
}: Props) {
  const [profile, setProfile] = useState<any>(user || {});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setProfile(user || {});
  }, [user]);

  // Fetch profile data on mount if custom endpoint provided
  useEffect(() => {
    if (fetchEndpoint) {
      fetchProfile();
    }
  }, [fetchEndpoint]);

  const fetchProfile = async () => {
    if (!fetchEndpoint) return;

    try {
      const r = await api.get(fetchEndpoint);
      const profileData =
        variant === 'guard'
          ? r && r.data && r.data.guard
            ? r.data.guard
            : r.data.user || null
          : (r && r.data && r.data.user) || null;

      if (profileData) {
        setProfile(profileData);
      }
    } catch (e) {
      // fallback to passed user
      setProfile(user || {});
    }
  };

  const onChange = (patch: any) => setProfile((p: any) => ({ ...(p || {}), ...(patch || {}) }));

  const onEditAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify({ type: 'warning', message: 'Permission to access photos is required' });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
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
      setProfile((p: any) => ({ ...(p || {}), avatar: uri }));
      setUserAvatar && setUserAvatar(uri);
    } catch (e) {
      console.warn('pick avatar failed', e);
      notify({ type: 'error', message: 'Could not pick image' });
    }
  };

  const saveProfile = async () => {
    try {
      const payload: any = {};
      const basicFields = ['name', 'phone', 'address', 'email', 'emergency_contact'];
      const tenantFields = ['gender', 'rent', 'deposit', 'move_in', 'move_out', 'status'];

      // Add basic fields
      for (const k of basicFields) {
        if (typeof (profile as any)[k] !== 'undefined') payload[k] = (profile as any)[k];
      }

      // Add tenant-specific fields if the user is a tenant
      if (profile?.role === 'tenant') {
        for (const k of tenantFields) {
          if (typeof (profile as any)[k] !== 'undefined') payload[k] = (profile as any)[k];
        }
      }

      // Handle avatar upload if it's a local URI
      const avatarVal = profile?.avatar;
      let uploadedUser: any = null;
      if (
        avatarVal &&
        typeof avatarVal === 'string' &&
        !/^https?:\/\//i.test(avatarVal) &&
        !/^data:/i.test(avatarVal)
      ) {
        try {
          // Test connectivity for admin variant (has more robust error handling)
          if (variant === 'admin') {
            try {
              const ping = await (api as any).testConnectivity?.();
              if (!ping || !ping.ok) {
                const resolved = (api.defaults && (api.defaults as any).baseURL) || 'unknown';
                notify({
                  type: 'error',
                  message: `Cannot reach backend at ${resolved}. Ensure your device can access the dev machine (update mobile/src/services/config.js DEFAULT_HOST if needed).`,
                });
                throw new Error('backend-unreachable');
              }
            } catch (pingErr) {
              if (String(pingErr).includes('backend-unreachable')) throw pingErr;
            }
          }

          const formData: any = new FormData();

          if (Platform.OS === 'web') {
            const resp = await fetch(avatarVal);
            const blob = await resp.blob();
            formData.append('file', blob, avatarVal.split('/').pop() || 'photo.jpg');
          } else {
            formData.append('file', {
              uri: avatarVal,
              name: avatarVal.split('/').pop() || 'photo.jpg',
              type: 'image/jpeg',
            } as any);
          }

          // Try axios first for admin variant, direct fetch for others
          let resp: any = null;
          if (variant === 'admin') {
            try {
              resp = await api.post('/api/user/avatar', formData as any, {
                headers: { Accept: 'application/json' },
              });
            } catch (axErr) {
              console.warn('axios post failed for avatar upload, trying fetch fallback', axErr);
              // Fallback to fetch
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
            }
          } else {
            // Direct fetch for guard/superadmin variants
            const token = await AsyncStorage.getItem('token');
            const headers: any = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const base = (api.defaults && (api.defaults as any).baseURL) || '';
            const uploadUrl = `${String(base).replace(/\/$/, '')}/api/user/avatar`;
            const fResp = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
            const jd = await fResp.json().catch(() => ({} as any));
            resp = { data: jd, ok: fResp.ok };
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
          notify({
            type: 'error',
            message:
              (e && e.message) ||
              'Failed to upload avatar. Check your backend URL and device network (LAN IP).',
          });
        }
      }

      // Update other profile fields via PUT /api/user
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

      // Finally, refresh full user from server
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

  // Extract user data for ProfileCard display
  const name = (profile && (profile.name || profile.full_name)) || '';
  const phone = (profile && (profile.phone || profile.mobile_number || profile.mobile)) || '';
  const avatar = (profile && (profile.avatar || profile.image || profile.image_url)) || undefined;

  const renderContent = () => {
    if (variant === 'superadmin' && !showEditableForm) {
      // Simple ProfileCard display for superadmin
      return (
        <View style={{ width: '100%', maxWidth: 720 }}>
          <ProfileCard
            name={name}
            phone={phone}
            imageUri={avatar}
            onEdit={() => notify({ type: 'info', message: 'Edit profile not implemented' })}
            onCall={(p) => {
              try {
                require('react-native').Linking.openURL(`tel:${p}`);
              } catch (e) {
                notify({ type: 'error', message: 'Cannot make call' });
              }
            }}
          />
        </View>
      );
    }

    // Full editable form for admin and guard variants
    return (
      <View style={styles.formCard}>
        <UserProfileForm
          profile={profile}
          onChange={onChange}
          onEditAvatar={onEditAvatar}
          onCall={(p: string) => {
            try {
              require('react-native').Linking.openURL(`tel:${p}`);
            } catch (e) {}
          }}
          onSave={saveProfile}
          documents={[]}
          pickAndUploadFile={pickAndUploadFile}
          saveDocumentToServer={async () => null}
          uploadingDocId={null}
        />
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        variant === 'superadmin' ? styles.superadminContainer : styles.container,
        containerStyle,
      ]}
    >
      {showTitle && <Text style={styles.title}>Profile</Text>}

      {renderContent()}

      {showAppInfo && (
        <>
          <View style={{ height: 12 }} />
          <AppInfoSection navigation={navigation} onNavigate={onNavigate} />
        </>
      )}

      {showLogoutButton && onLogout && (
        <>
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                setShowLogoutConfirm(true);
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

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
            if (navigation && (navigation as any).reset) {
              (navigation as any).reset({ index: 0, routes: [{ name: 'Login' }] });
            } else if (navigation && (navigation as any).navigate) {
              (navigation as any).navigate('Login');
            }
          } catch (e) {
            notify({ type: 'error', message: 'Logout failed' });
          }
        }}
      />

      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#f7fafc',
  },
  superadminContainer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
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
  logoutBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});
