import * as DocumentPicker from 'expo-document-picker';
// Use legacy file-system API to keep readAsStringAsync and EncodingType available
import * as FileSystem from 'expo-file-system/legacy';

// Compatibility shim for expo-file-system API surface changes
const _FS: any = FileSystem as any;
const _FSPaths: any = _FS.Paths || {};
const CACHE_DIR = _FS.cacheDirectory ?? _FSPaths.cacheDirectory ?? '';
const DOCUMENT_DIR = _FS.documentDirectory ?? _FSPaths.documentDirectory ?? '';
const ENCODING_BASE64 = (_FS.EncodingType && _FS.EncodingType.Base64) ?? 'base64';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultBaseUrl, DEFAULT_HOST, DEFAULT_PORT } from './config';

// Pick an image file and upload via backend /api/upload which returns { url }
// Uses expo-image-picker on native (with base64) and falls back to DocumentPicker on web.
export default async function pickAndUploadProfile(): Promise<string | null> {
  try {
    console.debug('[uploadProfile] start pickAndUploadProfile', { platform: Platform.OS });
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
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      // Support both old and new result shapes from expo-image-picker
      // New shape: { canceled: boolean, assets: [{ uri, base64, type, fileName }] }
      // Old shape: { cancelled: boolean, uri: string, base64: string }
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      if (cancelled) {
        console.debug('[uploadProfile] image picker cancelled by user');
        return null;
      }

      // Try to read from new assets array first
      const assets = (res as any).assets;
      if (Array.isArray(assets) && assets.length) {
        const asset = assets[0];
        uri = asset.uri || asset.uri;
        base64 = asset.base64 || (res as any).base64;
        mime = asset.type || 'image/jpeg';
        filename = asset.fileName || asset.uri?.split('/').pop() || 'photo.jpg';
      } else {
        // Fallback to legacy shape
        uri = (res as any).uri as string | undefined;
        base64 = (res as any).base64 as string | undefined;
        mime = 'image/jpeg';
        filename = uri ? (uri as string).split('/').pop() : undefined;
      }
      if (!uri) {
        console.debug('[uploadProfile] no uri returned from image picker', res);
        return null;
      }
    } else {
      // Web fallback: use a native <input type="file"> to pick files reliably in the browser
      async function pickFileWeb(): Promise<{
        uri: string;
        name: string;
        mime: string;
        base64: string;
      } | null> {
        return new Promise((resolve) => {
          try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
              const f = input.files && input.files[0];
              if (!f) {
                document.body.removeChild(input);
                resolve(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = function (ev: any) {
                try {
                  const dataUrl = ev.target.result as string;
                  const base64Data = dataUrl.split(',')[1];
                  const mimeType = f.type || 'image/jpeg';
                  const blobUri = URL.createObjectURL(f);
                  document.body.removeChild(input);
                  resolve({
                    uri: blobUri,
                    name: f.name || 'photo.jpg',
                    mime: mimeType,
                    base64: base64Data,
                  });
                } catch (e) {
                  document.body.removeChild(input);
                  resolve(null);
                }
              };
              reader.onerror = function () {
                try {
                  document.body.removeChild(input);
                } catch (e) {}
                resolve(null);
              };
              reader.readAsDataURL(f);
            });
            input.click();
          } catch (e) {
            resolve(null);
          }
        });
      }

      console.debug('[uploadProfile] using web file picker');
      const picked = await pickFileWeb();
      console.debug('[uploadProfile] web picker returned', picked);
      if (!picked) return null;
      uri = picked.uri;
      filename = picked.name;
      mime = picked.mime;
      base64 = picked.base64;
    }

    if (!uri) return null;

    // normalize uri for TS narrowings
    const fileUri = uri as string;

    // Ensure we have base64 data; ImagePicker on native returns base64 when requested
    if (!base64) {
      // Try to read file as base64 from uri
      base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: ENCODING_BASE64 });
    }

    if (!base64) throw new Error('failed to read file');

    const dataUrl = `data:${mime || 'image/jpeg'};base64,${base64}`;
    // Prefer direct Cloudinary upload from client when Cloudinary unsigned preset is provided
    const env =
      (Constants as any)?.manifest?.extra ||
      (Constants as any)?.extra ||
      (Constants as any)?.expoConfig?.extra ||
      {};
    const CLOUDINARY_UPLOAD_URL = env.CLOUDINARY_UPLOAD_URL || env.CLOUDINARY_URL || null;
    const CLOUDINARY_UPLOAD_PRESET = env.CLOUDINARY_UPLOAD_PRESET || null;

    if (CLOUDINARY_UPLOAD_URL && CLOUDINARY_UPLOAD_PRESET) {
      try {
        console.debug('[uploadProfile] attempting direct Cloudinary upload', {
          CLOUDINARY_UPLOAD_URL,
        });
        // Prepare FormData for direct upload
        const formData: any = new FormData();
        if (Platform.OS === 'web') {
          const resp = await fetch(fileUri);
          const blob = await resp.blob();
          formData.append('file', blob, filename || 'photo.jpg');
        } else {
          // On native, convert local file URI to Blob before appending. This avoids
          // "Network request failed" on some Android devices when sending local URIs.
          try {
            const resp = await fetch(fileUri);
            const blob = await resp.blob();
            formData.append('file', blob, filename || 'photo.jpg');
          } catch (e) {
            // Fallback to legacy object expected by react-native fetch
            formData.append('file', {
              uri: fileUri,
              name: filename || 'photo.jpg',
              type: mime,
            } as any);
          }
        }
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(CLOUDINARY_UPLOAD_URL, {
          method: 'POST',
          body: formData,
        });
        const jd = await res.json();
        if (!res.ok) throw new Error(jd.error?.message || 'cloudinary upload failed');
        console.debug('[uploadProfile] direct Cloudinary success', jd);
        return jd.secure_url || jd.url || null;
      } catch (e) {
        console.warn('direct Cloudinary upload failed, falling back to server upload', e);
        // fallthrough to server-side upload
      }
    }
    // Try server-side multipart upload first (avoid sending big base64 blobs)
    try {
      console.debug('[uploadProfile] attempting server multipart /api/upload_form (fetch)');
      const formData: any = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(fileUri);
        const blob = await resp.blob();
        formData.append('file', blob, filename || 'photo.jpg');
      } else {
        try {
          const resp = await fetch(fileUri);
          const blob = await resp.blob();
          formData.append('file', blob, filename || 'photo.jpg');
        } catch (e) {
          formData.append('file', {
            uri: fileUri,
            name: filename || 'photo.jpg',
            type: mime,
          } as any);
        }
      }

      let base = (api.defaults && (api.defaults as any).baseURL) || '';
      if (!base) {
        // If running on Android emulator (not a physical device) use 10.0.2.2
        const host = Platform.OS === 'android' && !Constants.isDevice ? '10.0.2.2' : DEFAULT_HOST;
        base = `http://${host}:${DEFAULT_PORT}`;
      }
      const uploadUrl = `${String(base).replace(/\/$/, '')}/api/upload_form`;
      console.debug('[uploadProfile] uploadUrl=', uploadUrl);

      // try to read token from AsyncStorage (same token api uses)
      let token: string | null = null;
      try {
        token = await AsyncStorage.getItem('token');
      } catch (ee) {}
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      // quick connectivity check: try GET / on base to surface clearer network errors
      try {
        const pingUrl = String(uploadUrl).replace(/\/api\/upload_form$/, '/') || String(uploadUrl);
        console.debug('[uploadProfile] pinging base URL to test connectivity', pingUrl);
        const p = await fetch(pingUrl, { method: 'GET' });
        console.debug('[uploadProfile] ping result', p.status);
      } catch (pe) {
        console.warn('[uploadProfile] base ping failed', pe);
        // continue to attempt multipart; fetch error will give same failure below
      }

      let resp: any;
      try {
        resp = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
      } catch (fe) {
        console.warn('[uploadProfile] fetch multipart failed', fe);
        // try fallback (use fetch JSON base64 upload instead of axios)
        try {
          const uploadJsonUrl = String(uploadUrl).replace(/\/api\/upload_form$/, '/api/upload');
          const upHeaders: any = { 'Content-Type': 'application/json' };
          if (token) upHeaders.Authorization = `Bearer ${token}`;
          console.debug('[uploadProfile] attempting fallback JSON upload to', uploadJsonUrl);
          const r2 = await fetch(uploadJsonUrl, {
            method: 'POST',
            headers: upHeaders,
            body: JSON.stringify({ dataUrl, filename }),
          });
          const j2 = await r2.json().catch(() => ({} as any));
          console.debug('[uploadProfile] fallback JSON upload response', r2.status, j2);
          if (r2.ok && j2 && j2.url) return j2.url;
        } catch (fe2) {
          console.warn('[uploadProfile] fallback JSON upload failed', fe2);
        }
        throw fe;
      }
      const jd = await resp.json().catch(() => ({} as any));
      console.debug('[uploadProfile] fetch /api/upload_form response', resp.status, jd);
      if (resp.ok && jd && jd.url) return jd.url;

      // fallback to base64 server upload via fetch (avoid axios network bugs)
      try {
        const uploadJsonUrl = String(uploadUrl).replace(/\/api\/upload_form$/, '/api/upload');
        const upHeaders: any = { 'Content-Type': 'application/json' };
        if (token) upHeaders.Authorization = `Bearer ${token}`;
        console.debug('[uploadProfile] attempting fallback JSON upload to', uploadJsonUrl);
        const r3 = await fetch(uploadJsonUrl, {
          method: 'POST',
          headers: upHeaders,
          body: JSON.stringify({ dataUrl, filename }),
        });
        const j3 = await r3.json().catch(() => ({} as any));
        console.debug('[uploadProfile] fallback JSON upload response', r3.status, j3);
        if (r3.ok && j3 && j3.url) return j3.url;
      } catch (e2) {
        console.warn('[uploadProfile] fallback JSON upload failed', e2);
      }
      throw new Error('upload failed');
    } catch (e) {
      console.warn('[uploadProfile] multipart failed, trying base64 /api/upload', e);
      // try base64 server upload as last resort
      const upl = await api.post('/api/upload', { dataUrl, filename });
      if (!upl || !upl.data) throw new Error('upload failed');
      return upl.data.url;
    }
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || String(err);
    // If the user cancelled the picker we already returned null above.
    // For other errors, propagate so callers can show an alert.
    throw new Error(`upload failed: ${msg}`);
  }
}

// Generic file picker + upload helper for non-profile documents
export async function pickAndUploadFile(options?: {
  accept?: string; // e.g. 'image/*' or '*/*'
  fallbackApiPath?: string; // e.g. '/api/owner/upload' to match existing server endpoints
}): Promise<string | null> {
  try {
    const accept = options?.accept || '*/*';
    console.debug('[uploadProfile] pickAndUploadFile start', { platform: Platform.OS, accept });

    let uri: string | undefined;
    let filename: string | undefined;
    let mime: string | undefined;
    let base64: string | undefined;

    if (Platform.OS === 'web') {
      // browser-native input picker for reliable selection on web
      async function pickFileWeb(): Promise<{
        uri: string;
        name: string;
        mime: string;
        base64: string;
      } | null> {
        return new Promise((resolve) => {
          try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
              const f = input.files && input.files[0];
              if (!f) {
                document.body.removeChild(input);
                resolve(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = function (ev: any) {
                try {
                  const dataUrl = ev.target.result as string;
                  const base64Data = dataUrl.split(',')[1];
                  const mimeType = f.type || 'application/octet-stream';
                  const blobUri = URL.createObjectURL(f);
                  document.body.removeChild(input);
                  resolve({
                    uri: blobUri,
                    name: f.name || 'file',
                    mime: mimeType,
                    base64: base64Data,
                  });
                } catch (e) {
                  document.body.removeChild(input);
                  resolve(null);
                }
              };
              reader.onerror = function () {
                try {
                  document.body.removeChild(input);
                } catch (e) {}
                resolve(null);
              };
              reader.readAsDataURL(f);
            });
            input.click();
          } catch (e) {
            resolve(null);
          }
        });
      }

      const picked = await pickFileWeb();
      if (!picked) return null;
      uri = picked.uri;
      filename = picked.name;
      mime = picked.mime;
      base64 = picked.base64;
    } else {
      // native: use DocumentPicker for generic files
      const res: any = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: accept,
      });
      if (res.type !== 'success') return null;
      uri = res.uri;
      filename = res.name;
      mime = res.mimeType || 'application/octet-stream';
      // try to read base64 for fallback uploads
      try {
        base64 = await FileSystem.readAsStringAsync(res.uri as string, {
          encoding: ENCODING_BASE64,
        });
      } catch (e) {
        // ignore; we'll try multipart upload which doesn't need base64
      }
    }

    if (!uri) return null;

    const fileUri = uri as string;

    // Try server multipart upload first (avoid base64 blobs)
    try {
      console.debug('[uploadProfile] attempting server multipart /api/upload_form (fetch)');
      const formData: any = new FormData();
      if (Platform.OS === 'web') {
        const resp = await fetch(fileUri);
        const blob = await resp.blob();
        formData.append('file', blob, filename || 'file');
      } else {
        try {
          const resp = await fetch(fileUri);
          const blob = await resp.blob();
          formData.append('file', blob, filename || 'file');
        } catch (e) {
          formData.append('file', { uri: fileUri, name: filename || 'file', type: mime } as any);
        }
      }
      let base = (api.defaults && (api.defaults as any).baseURL) || '';
      if (!base) {
        const host = Platform.OS === 'android' && !Constants.isDevice ? '10.0.2.2' : DEFAULT_HOST;
        base = `http://${host}:${DEFAULT_PORT}`;
      }
      const uploadUrl = `${String(base).replace(/\/$/, '')}/api/upload_form`;
      console.debug('[uploadProfile] uploadUrl=', uploadUrl);
      let token: string | null = null;
      try {
        token = await AsyncStorage.getItem('token');
      } catch (ee) {}
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      try {
        const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
        const jd = await r.json().catch(() => ({} as any));
        console.debug('[uploadProfile] fetch /api/upload_form response', r.status, jd);
        if (r.ok && jd && jd.url) return jd.url;
      } catch (e) {
        console.warn('[uploadProfile] /api/upload_form failed (fetch), will try fallback', e);
      }
      // if upload_form exists but didn't return url, fall through
    } catch (e) {
      console.warn('[uploadProfile] multipart attempt failed, will try fallback', e);
    }

    // fallback: send base64 to caller-provided endpoint or to /api/upload
    if (!base64) {
      // try to read base64 if missing
      try {
        base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: ENCODING_BASE64 });
      } catch (e) {
        console.warn('[uploadProfile] failed to read base64 fallback', e);
      }
    }

    if (!base64) {
      // As a last resort, if we have a blob-uri on web we can POST the blob to a fallback multipart endpoint
      // but earlier multipart attempt failed. Return null to indicate failure.
      throw new Error('failed to obtain file data for upload');
    }

    const dataUrl = `data:${mime || 'application/octet-stream'};base64,${base64}`;
    const fallback = options?.fallbackApiPath || '/api/upload';
    // Use fetch for fallback to avoid axios XHR multipart/base64 issues on Android
    try {
      const base = (api.defaults && (api.defaults as any).baseURL) || defaultBaseUrl();
      const uploadJsonUrl = `${String(base).replace(/\/$/, '')}${
        fallback.startsWith('/') ? '' : '/'
      }${fallback.replace(/^\//, '')}`;
      const headers: any = { 'Content-Type': 'application/json' };
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch (e) {}
      const r = await fetch(uploadJsonUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ dataUrl, filename }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (r.ok && j) return j.url || j.file_url || null;
    } catch (e) {
      console.warn('[uploadProfile] fallback fetch upload failed', e);
    }
    return null;
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.message || String(err);
    throw new Error(`upload failed: ${msg}`);
  }
}
