import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type NotificationProps = {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  onClose?: () => void;
};

export default function NotificationBar({ type, title, message, onClose }: NotificationProps) {
  const bgMap: any = {
    success: '#e6f9f0',
    error: '#fff0f0',
    warning: '#fff8e6',
    info: '#eef6ff',
  };
  const iconMap: any = {
    success: 'checkmark-circle',
    error: 'close-circle',
    warning: 'alert-circle',
    info: 'information-circle',
  };
  const colorMap: any = {
    success: '#047857',
    error: '#dc2626',
    warning: '#b45309',
    info: '#2563eb',
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: bgMap[type] || bgMap.info }]}>
      <View style={styles.inner}>
        <View style={styles.left}>
          <View style={[styles.iconCircle, { backgroundColor: (colorMap as any)[type] + '20' }]}>
            <Ionicons name={iconMap[type] as any} size={20} color={colorMap[type]} />
          </View>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>{title || (type === 'success' ? 'Success' : type)}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Dismiss">
          <Text style={{ fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 9999,
  },
  inner: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  left: { paddingRight: 8 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, paddingRight: 8 },
  title: { fontWeight: '800', fontSize: 14, color: '#111' },
  message: { color: '#374151', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 8 },
});
