import axios from 'axios';
import Constants from 'expo-constants';
import { DEFAULT_HOST, DEFAULT_PORT, defaultBaseUrl } from './config';

const c = Constants || {};
const env = c.manifest?.extra || c.extra || c.expoConfig?.extra || {};

// Build base URL from shared config, but allow manifest/extra override.
const BASE_URL = env.API_BASE_URL || defaultBaseUrl() || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
console.debug('[api.js] resolved baseURL ->', BASE_URL);

const api = axios.create({ baseURL: BASE_URL });

export default api;
