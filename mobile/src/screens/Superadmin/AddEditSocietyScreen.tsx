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
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api, { testConnectivity } from '../../services/api';
import { defaultBaseUrl } from '../../services/config';
import styles from '../../styles/superadminStyles';

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
          return Alert.alert('Network', `Cannot reach backend: ${conn.error}`);
        }
      } catch (e) {
        // ignore: we'll still try the upload and surface the underlying error
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted)
        return Alert.alert('Permission required', 'Permission to access photos is required');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
      });
      // support both old and new result shapes
      if ((result as any).canceled || (result as any).cancelled) return;
      const asset = (result as any).assets ? (result as any).assets[0] : (result as any);
      if (!asset || !asset.uri) return Alert.alert('Error', 'Could not read image data');
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
      if (!url) return Alert.alert('Error', 'Upload did not return a URL');
      handleFormChange({ image_url: url });
    } catch (e: any) {
      console.error('image upload failed', e);
      // axios exposes a toJSON helper with details about request/response
      try {
        if (typeof e.toJSON === 'function') console.error('axios error json', e.toJSON());
      } catch (ee) {}
      const msg = e?.message || String(e);
      Alert.alert('Error', `Image upload failed: ${msg}`);
    }
  };

  const handleSave = async () => {
    if (!form.name) return Alert.alert('Validation', 'Name is required');
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;

      if (isEditing) {
        await api.put(`/api/superadmin/societies/${society.id}`, form, { headers });
        Alert.alert('Success', 'Society updated successfully');
      } else {
        await api.post('/api/superadmin/societies', form, { headers });
        Alert.alert('Success', 'Society created successfully');
      }

      if (onSave) onSave();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', isEditing ? 'Failed to update society' : 'Failed to create society');
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
