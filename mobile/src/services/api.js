import axios from 'axios';
import Constants from 'expo-constants';

const env = Constants.manifest?.extra || {};
const BASE_URL = env.API_BASE_URL || 'http://10.0.2.2:4000';

const api = axios.create({ baseURL: BASE_URL });

export default api;
