import React from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api, { testConnectivity } from '../services/api';
import { defaultBaseUrl } from '../services/config';
import styles from '../styles/superadminStyles';

type Props = {
  visible: boolean;
  editingSociety: any | null;
  form: {
    name: string;
    country: string;
    city: string;
    area: string;
    mobile_number: string;
    builder_name: string;
    image_url: string;
  };
  user: any;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (updates: Partial<Props['form']>) => void;
};

export default function AddEditSocietyModal({
  visible,
  editingSociety,
  form,
  user,
  onClose,
  onSave,
  onFormChange,
}: Props) {
  // image picker + upload (uses tenant upload endpoint that accepts multipart form-data)
  const pickImageAndUpload = async () => {
    try {
      // quick connectivity check so we can show a clearer error when the backend is unreachable
      try {
        const conn = await testConnectivity();
        if (!conn.ok) {
          console.warn('[AddEditSocietyModal] connectivity test failed', conn.error);
          return Alert.alert('Network', `Cannot reach backend: ${conn.error}`);
        }
      } catch (e) {
        // ignore
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

      const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers: fetchHeaders });
      const res = await r.json().catch(() => ({} as any));
      const url = res && res.url ? res.url : '';
      if (!url) return Alert.alert('Error', 'Upload did not return a URL');
      onFormChange({ image_url: url });
    } catch (e: any) {
      console.error('image upload failed', e);
      try {
        if (typeof e.toJSON === 'function') console.error('axios error json', e.toJSON());
      } catch (ee) {}
      const msg = e?.message || String(e);
      Alert.alert('Error', `Image upload failed: ${msg}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.modalInner, { paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.modalTitle}>{editingSociety ? 'Edit Society' : 'Add Society'}</Text>
          <TextInput
            placeholder="Name"
            value={form.name}
            onChangeText={(t) => onFormChange({ name: t })}
            style={styles.input}
          />
          {editingSociety ? (
            <TextInput
              placeholder="Mobile (admin)"
              value={form.mobile_number}
              onChangeText={(t) => onFormChange({ mobile_number: t })}
              style={styles.input}
              keyboardType="phone-pad"
            />
          ) : null}
          <TextInput
            placeholder="Country"
            value={form.country}
            onChangeText={(t) => onFormChange({ country: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="City"
            value={form.city}
            onChangeText={(t) => onFormChange({ city: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="Area"
            value={form.area}
            onChangeText={(t) => onFormChange({ area: t })}
            style={styles.input}
          />
          <TextInput
            placeholder="Builder name (optional)"
            value={form.builder_name}
            onChangeText={(t) => onFormChange({ builder_name: t })}
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.smallBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
              onPress={pickImageAndUpload}
            >
              <Text style={{ color: '#fff' }}>Choose Image</Text>
            </TouchableOpacity>
            {form.image_url ? (
              <>
                <Image
                  source={{ uri: form.image_url }}
                  style={{ width: 72, height: 48, marginLeft: 12, borderRadius: 6 }}
                />
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    {
                      backgroundColor: '#ef4444',
                      marginLeft: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    },
                  ]}
                  onPress={() => onFormChange({ image_url: '' })}
                >
                  <Text style={{ color: '#fff' }}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
              onPress={onClose}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#4f46e5' }]}
              onPress={onSave}
            >
              <Text style={styles.modalBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
