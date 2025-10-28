import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import api from './api';

// Pick an image file and upload via backend /api/upload which returns { url }
// Uses expo-image-picker on native (with base64) and falls back to DocumentPicker on web.
export default async function pickAndUploadProfile(): Promise<string> {
  try {
    // On native platforms prefer ImagePicker which gives a smoother UX
    let uri: string | undefined;
    let filename: string | undefined;
    let mime: string | undefined;
    let base64: string | undefined;

    if (Platform.OS !== 'web') {
      // Dynamically import expo-image-picker only on native so web bundlers don't try to resolve it
      let ImagePicker: any;
      try {
        ImagePicker = (await import('expo-image-picker')) as any;
      } catch (err) {
        throw new Error(
          'expo-image-picker is not installed. Run `cd mobile && npx expo install expo-image-picker` and restart Expo'
        );
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('permission denied');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      if (res.cancelled || !res.uri) throw new Error('no-file');
      uri = res.uri;
      base64 = res.base64 as string | undefined;
      mime = 'image/jpeg';
      // derive filename from uri
      filename = (uri as string).split('/').pop();
    } else {
      // Web fallback: DocumentPicker (may return file name and mimeType)
      const res: any = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: 'image/*',
      });
      if (res.type !== 'success') throw new Error('no-file');
      uri = res.uri;
      filename = res.name;
      mime = res.mimeType || 'image/jpeg';
      base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (!uri) throw new Error('no-file');

    // normalize uri for TS narrowings
    const fileUri = uri as string;

    // Ensure we have base64 data; ImagePicker on native returns base64 when requested
    if (!base64) {
      // Try to read file as base64 from uri
      base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (!base64) throw new Error('failed to read file');

    const dataUrl = `data:${mime || 'image/jpeg'};base64,${base64}`;
    const upl = await api.post('/api/upload', { dataUrl, filename });
    if (!upl || !upl.data) throw new Error('upload failed');
    return upl.data.url;
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || String(err);
    throw new Error(`upload failed: ${msg}`);
  }
}
