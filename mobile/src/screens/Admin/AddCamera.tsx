import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../../services/api';

type Props = {
  onSaved?: (cam: any) => void;
  onCancel?: () => void;
};

export default function AddCamera({ onSaved, onCancel }: Props) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('554');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rtspPath, setRtspPath] = useState('cam/realmonitor?channel=1&subtype=0');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const testConnection = async () => {
    if (!ip || !username || !password) return Alert.alert('IP, username and password required');
    setTesting(true);
    try {
      const r = await api.post('/api/admin/cameras/test', {
        ip_address: ip,
        port: Number(port || 554),
        username,
        password,
        rtsp_path: rtspPath,
      });
      Alert.alert('Test Result', (r && r.data && r.data.message) || 'Success');
    } catch (e: any) {
      Alert.alert('Test failed', (e && (e.response?.data?.message || e.message)) || String(e));
    } finally {
      setTesting(false);
    }
  };

  const saveCamera = async () => {
    if (!name || !ip || !username || !password) return Alert.alert('Please fill required fields');
    setSaving(true);
    try {
      const r = await api.post('/api/admin/cameras', {
        name,
        ip_address: ip,
        port: Number(port || 554),
        username,
        password,
        rtsp_path: rtspPath,
      });
      Alert.alert('Saved', 'Camera saved successfully');
      if (onSaved) onSaved(r.data.camera);
    } catch (e: any) {
      Alert.alert('Save failed', (e && (e.response?.data?.error || e.message)) || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ padding: 12 }}>
      <Text style={styles.label}>Camera Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Main Gate" />

      <Text style={styles.label}>IP Address</Text>
      <TextInput style={styles.input} value={ip} onChangeText={setIp} placeholder="192.168.1.4" />

      <Text style={styles.label}>Port</Text>
      <TextInput
        style={styles.input}
        value={port}
        onChangeText={setPort}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />

      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.label}>RTSP Path</Text>
      <TextInput style={styles.input} value={rtspPath} onChangeText={setRtspPath} />

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.btn, { marginRight: 8 }]}
          onPress={testConnection}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Test Connection</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={saveCamera} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save Camera</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 8 }} />
      <TouchableOpacity onPress={onCancel} style={{ alignItems: 'center' }}>
        <Text style={{ color: '#2563eb' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#374151', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 8, borderRadius: 6, marginTop: 6 },
  btn: { backgroundColor: '#6b7280', padding: 10, borderRadius: 8, alignItems: 'center', flex: 1 },
  primaryBtn: {
    backgroundColor: '#0ea5a4',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
