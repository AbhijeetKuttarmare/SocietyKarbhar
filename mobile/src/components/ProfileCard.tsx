import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  imageUri?: string;
  onCall?: (phone: string) => void;
  onEdit?: () => void;
};

export default function ProfileCard({
  name,
  phone,
  email,
  address,
  imageUri,
  onCall,
  onEdit,
}: Props) {
  const avatar = imageUri || 'https://placekitten.com/200/200';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          {onEdit ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                try {
                  console.debug('[ProfileCard] edit button pressed');
                } catch (e) {}
                try {
                  onEdit();
                } catch (e) {
                  console.error('[ProfileCard] onEdit threw', e);
                }
              }}
              accessibilityLabel="Edit profile photo"
            >
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name || '—'}
          </Text>
          {phone ? (
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{phone}</Text>
              {onCall ? (
                <TouchableOpacity onPress={() => onCall(phone)} style={styles.callBtn}>
                  <Ionicons name="call" size={16} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {email ? <Text style={styles.meta}>{email}</Text> : null}
          {address ? (
            <Text style={styles.address} numberOfLines={2}>
              {address}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
  name: { fontSize: 18, fontWeight: '800', color: '#111' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  meta: { color: '#6b7280' },
  address: { color: '#6b7280', marginTop: 6 },
  callBtn: { marginLeft: 8, backgroundColor: '#10b981', padding: 8, borderRadius: 8 },
  editBtn: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 20,
  },
});
