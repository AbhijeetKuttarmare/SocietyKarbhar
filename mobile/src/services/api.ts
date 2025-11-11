import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_HOST, DEFAULT_PORT } from './config';
import { notify } from './notifier';

function getBaseUrl() {
  // Expo stores config in different places depending on SDK and how app is started.
  const c = (Constants as any) || {};
  const env = c.manifest?.extra || c.extra || c.expoConfig?.extra || {};

  // 1) If explicit override provided via extras (app.config.js / app.json or env), use it.
  const rawApiBase = (env.API_BASE_URL || '').toString().trim();
  if (rawApiBase) {
    if (/^https?:\/\//i.test(rawApiBase)) return rawApiBase;
    return `http://${rawApiBase}`;
  }

  // 2) Web (browser) -> prefer the developer machine LAN IP (so web builds show same host)
  // Note: explicit env/API_BASE_URL is handled above. For web we prefer DEFAULT_HOST so
  // logs and requests use the LAN IP instead of localhost when testing from other devices.
  // However, when running in the browser (Expo web / responsive mode) prefer the page's
  // hostname so requests target the same host the browser is served from (e.g. localhost).
  if (typeof window !== 'undefined' && (window as any)?.location) {
    try {
      const host = (window as any).location.hostname || DEFAULT_HOST;
      return `http://${host}:${DEFAULT_PORT}`;
    } catch (e) {
      return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
    }
  }

  // 3) Native (Expo). If running on a physical device prefer the machine LAN IP so Expo Go can reach the backend
  if (c.isDevice) {
    return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  }

  // 4) Android emulator -> 10.0.2.2
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_PORT}`;

  // 5) iOS simulator or fallback -> localhost
  return `http://localhost:${DEFAULT_PORT}`;
}

const BASE_URL = getBaseUrl();
// Helpful debug info so you can see what URL is being used in Metro/Expo logs
console.debug(
  '[api] resolved baseURL ->',
  BASE_URL,
  ' (DEFAULT_HOST,PORT)=',
  DEFAULT_HOST,
  DEFAULT_PORT
);

const api = axios.create({ baseURL: BASE_URL });

// Attach Authorization header from AsyncStorage if present
api.interceptors.request.use(async (cfg) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) (cfg.headers = cfg.headers || {}), (cfg.headers.Authorization = `Bearer ${token}`);
  } catch (e) {}
  return cfg;
});

// Global response error notifier
let _errorHandler: ((err: any) => void) | null = null;
// Response interceptor: notify errors and also surface success notifications for POST-created resources
api.interceptors.response.use(
  (res) => {
    try {
      const cfg = res && (res.config as any);
      const method = cfg && cfg.method ? String(cfg.method).toLowerCase() : '';
      const url = (cfg && cfg.url) || '';
      // Heuristic: if this was a POST/PUT/PATCH and not an auth endpoint, emit a success notification.
      if (/^(post|put|patch)$/.test(method) && !/auth|login|otp/i.test(String(url))) {
        // try to use server-provided message when available
        const serverMsg = res.data && (res.data.message || res.data.msg || res.data.error || null);
        // derive a friendly resource name from URL
        const parts = String(url).split('/').filter(Boolean);
        const resource = parts.length ? parts[parts.length - 1] : 'item';
        const title = 'Success';
        const message = serverMsg || `${resource.replace(/[-_]/g, ' ')} saved successfully`;
        try {
          notify({ type: 'success', title, message });
        } catch (e) {}
      }
    } catch (e) {}
    return res;
  },
  (err) => {
    try {
      // Always call attached error handler first so screens can handle specific flows
      if (_errorHandler) _errorHandler(err);

      // Provide a user-visible notification for common error cases on create/update
      try {
        const cfg = err && err.config ? (err.config as any) : null;
        const url = (cfg && cfg.url) || '';
        // suppress notifications for auth flows (login/otp)
        if (!/auth|login|otp/i.test(String(url))) {
          const resp = err && err.response;
          let message = 'An error occurred';
          if (resp && resp.data) {
            message =
              resp.data.message ||
              resp.data.error ||
              resp.data.msg ||
              JSON.stringify(resp.data) ||
              message;
          } else if (err && err.message) {
            message = err.message;
          }
          notify({ type: 'error', title: 'Error', message });
        }
      } catch (e) {
        // noop - don't let notification failures break error propagation
      }
    } catch (e) {}
    return Promise.reject(err);
  }
);

export async function setToken(token: string) {
  if (token) {
    await AsyncStorage.setItem('token', token);
    // Set axios default header immediately so in-memory requests include it
    api.defaults.headers = api.defaults.headers || {};
    api.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    await AsyncStorage.removeItem('token');
    if (api.defaults && api.defaults.headers) delete api.defaults.headers.Authorization;
  }
}

// helper to set header synchronously when you already have token (optional)
export function setAuthHeader(token?: string) {
  if (token) {
    api.defaults.headers = api.defaults.headers || {};
    api.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    if (api.defaults && api.defaults.headers) delete api.defaults.headers.Authorization;
  }
}

export function attachErrorHandler(fn: (err: any) => void) {
  _errorHandler = fn;
}

export async function testConnectivity() {
  try {
    const r = await api.get('/');
    return { ok: true, data: r.data };
  } catch (e: any) {
    return { ok: false, error: (e && (e.response?.data || e.message)) || String(e) };
  }
}

export default api;
