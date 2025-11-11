import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api, { testConnectivity } from '../../services/api';
import { defaultBaseUrl } from '../../services/config';
import styles from '../../styles/superadminStyles';
import { notify } from '../../services/notifier';

type Props = {
  route: {
    params?: {
      society?: any;
      user: any;
      onSave?: () => void;
    };
  };
  navigation: any;
};

export default function AddEditSocietyScreen({ route, navigation }: Props) {
  const { society, user, onSave } = route.params || {};
  const isEditing = !!society;

  const [form, setForm] = React.useState({
    name: society?.name || '',
    country: society?.country || '',
    city: society?.city || '',
    area: society?.area || '',
    mobile_number: society?.mobile_number || society?.mobile || '',
    builder_name: society?.builder_name || '',
    image_url: society?.image_url || '',
  });
  const [loading, setLoading] = React.useState(false);

  const handleFormChange = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // image picker + upload (uses tenant upload endpoint that accepts multipart form-data)
  const pickImageAndUpload = async () => {
    try {
      // quick connectivity check so we can show a clearer error when the backend is unreachable
      try {
        const conn = await testConnectivity();
        if (!conn.ok) {
          console.warn('[AddEditSociety] connectivity test failed', conn.error);
          notify({ type: 'error', message: `Cannot reach backend: ${conn.error}` });
          return;
        }
      } catch (e) {
        // ignore: we'll still try the upload and surface the underlying error
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify({ type: 'warning', message: 'Permission to access photos is required' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
      });
      // support both old and new result shapes
      if ((result as any).canceled || (result as any).cancelled) return;
      const asset = (result as any).assets ? (result as any).assets[0] : (result as any);
      if (!asset || !asset.uri) {
        notify({ type: 'error', message: 'Could not read image data' });
        return;
      }
      const uri: string = asset.uri;
      const name = uri.split('/').pop() || 'photo.jpg';
      const lower = name.toLowerCase();
      const type = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

      const formData = new FormData();
      // In React Native FormData, append the file object with uri/name/type
      formData.append('file', { uri, name, type } as any);

      const uploadUrl = `${defaultBaseUrl()}/api/tenant/upload_form`;
      const fetchHeaders: any = {};
      if ((user as any)?.token) fetchHeaders.Authorization = `Bearer ${(user as any).token}`;

      // Use native fetch for multipart upload to avoid XHR/axios boundary problems on RN
      const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers: fetchHeaders });
      const res = await r.json().catch(() => ({} as any));
      const url = res && res.url ? res.url : '';
      if (!url) {
        notify({ type: 'error', message: 'Upload did not return a URL' });
        return;
      }
      handleFormChange({ image_url: url });
    } catch (e: any) {
      console.error('image upload failed', e);
      // axios exposes a toJSON helper with details about request/response
      try {
        if (typeof e.toJSON === 'function') console.error('axios error json', e.toJSON());
      } catch (ee) {}
      const msg = e?.message || String(e);
      notify({ type: 'error', message: `Image upload failed: ${msg}` });
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      notify({ type: 'warning', message: 'Name is required' });
      return;
    }
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;

      if (isEditing) {
        const r = await api.put(`/api/superadmin/societies/${society.id}`, form, { headers });
        // show the specific success message for this flow
        notify({
          type: 'success',
          message: (r && r.data && (r.data.message || r.data.msg)) || 'Society updated',
        });
      } else {
        const r = await api.post('/api/superadmin/societies', form, { headers });
        // show the specific success message for this flow
        notify({
          type: 'success',
          message: (r && r.data && (r.data.message || r.data.msg)) || 'Society created',
        });
      }

      if (onSave) onSave();
      navigation.goBack();
    } catch (err: any) {
      console.warn('Add/Edit society failed', err);
      const errMsg =
        (err && err.response && (err.response.data?.error || err.response.data?.message)) ||
        err?.message ||
        'Failed to save society';
      notify({ type: 'error', message: String(errMsg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ padding: 8, marginRight: 12 }}
            >
              <Text style={{ fontSize: 24, color: '#4f46e5' }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#111' }}>
              {isEditing ? 'Edit Society' : 'Add Society'}
            </Text>
          </View>

          <TextInput
            placeholder="Name *"
            value={form.name}
            onChangeText={(t) => handleFormChange({ name: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="Builder name (optional)"
            value={form.builder_name}
            onChangeText={(t) => handleFormChange({ builder_name: t })}
            style={styles.input}
          />
          {isEditing ? (
            <TextInput
              placeholder="Mobile (admin)"
              value={form.mobile_number}
              onChangeText={(t) => handleFormChange({ mobile_number: t })}
              style={styles.input}
              keyboardType="phone-pad"
            />
          ) : null}
          <TextInput
            placeholder="Country"
            value={form.country}
            onChangeText={(t) => handleFormChange({ country: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="City"
            value={form.city}
            onChangeText={(t) => handleFormChange({ city: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="Area"
            value={form.area}
            onChangeText={(t) => handleFormChange({ area: t })}
            style={styles.input}
          />

          {/* Image Picker Section */}
          <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8, marginTop: 8 }}>
            Society Image
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              style={[styles.smallBtn, { paddingVertical: 10, paddingHorizontal: 16 }]}
              onPress={pickImageAndUpload}
            >
              <Text style={{ color: '#fff' }}>Upload Photo</Text>
            </TouchableOpacity>
            {form.image_url ? (
              <>
                <Image
                  source={{ uri: form.image_url }}
                  style={{ width: 100, height: 70, marginLeft: 12, borderRadius: 8 }}
                />
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    {
                      backgroundColor: '#ef4444',
                      marginLeft: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    },
                  ]}
                  onPress={() => handleFormChange({ image_url: '' })}
                >
                  <Text style={{ color: '#fff' }}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#e5e7eb', flex: 1, marginRight: 8 }]}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={[styles.modalBtnText, { color: '#374151' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#4f46e5', flex: 1, marginLeft: 8 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.modalBtnText}>{loading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
