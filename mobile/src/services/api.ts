import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default machine IP for your dev machine (as requested)
const DEFAULT_HOST_IP = '192.168.1.25';
// The backend in this workspace often runs on 4001 to avoid conflicts — use 4001 by default
const DEFAULT_PORT = 4001;

function getBaseUrl() {
	const env = (Constants as any).manifest?.extra || (Constants as any).extra || {};
	if (env.API_BASE_URL) return env.API_BASE_URL;

	// Web (running in browser)
	if (typeof window !== 'undefined' && (window as any)?.location) {
		return `http://localhost:${DEFAULT_PORT}`;
	}

	// Native (Expo)
	// If running on a physical device prefer the machine IP so Expo Go can reach the backend
	if ((Constants as any).isDevice) {
		return `http://${DEFAULT_HOST_IP}:${DEFAULT_PORT}`;
	}

	// Android emulator -> 10.0.2.2
	if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_PORT}`;

	// iOS simulator -> localhost
	return `http://localhost:${DEFAULT_PORT}`;
}

const BASE_URL = getBaseUrl();
console.debug('[api] baseURL ->', BASE_URL);
const api = axios.create({ baseURL: BASE_URL });

// Attach Authorization header from AsyncStorage if present
api.interceptors.request.use(async (cfg) => {
	try{
		const token = await AsyncStorage.getItem('token');
		if(token) cfg.headers = cfg.headers || {}, cfg.headers.Authorization = `Bearer ${token}`;
	}catch(e){ }
	return cfg;
});

// Global response error notifier
let _errorHandler: ((err: any)=>void) | null = null;
api.interceptors.response.use((res)=>res, (err)=>{
	try{
		if(_errorHandler) _errorHandler(err);
	}catch(e){}
	return Promise.reject(err);
});

export async function setToken(token:string){
	if(token){
		await AsyncStorage.setItem('token', token);
		// Set axios default header immediately so in-memory requests include it
		api.defaults.headers = api.defaults.headers || {};
		api.defaults.headers.Authorization = `Bearer ${token}`;
	}else{
		await AsyncStorage.removeItem('token');
		if(api.defaults && api.defaults.headers) delete api.defaults.headers.Authorization;
	}
}

// helper to set header synchronously when you already have token (optional)
export function setAuthHeader(token?: string){
    if(token){
        api.defaults.headers = api.defaults.headers || {};
        api.defaults.headers.Authorization = `Bearer ${token}`;
    }else{
        if(api.defaults && api.defaults.headers) delete api.defaults.headers.Authorization;
    }
}

export function attachErrorHandler(fn: (err:any)=>void){ _errorHandler = fn; }

export async function testConnectivity(){
	try{
		const r = await api.get('/');
		return { ok: true, data: r.data };
	}catch(e:any){
		return { ok: false, error: (e && (e.response?.data || e.message)) || String(e) };
	}
}

export default api;
