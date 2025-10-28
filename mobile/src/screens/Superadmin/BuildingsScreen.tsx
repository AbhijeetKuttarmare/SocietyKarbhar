import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import api from '../../services/api';
import styles from '../../styles/superadminStyles';

type Props = { user: any };

export default function BuildingsScreen({ user }: Props) {
  const TAB_HEIGHT = 72;
  const [buildings, setBuildings] = useState<any[]>([]);

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/buildings', { headers });
      setBuildings(res.data.buildings || []);
    } catch (err) {
      console.warn('fetchBuildings error', err);
    }
  };

  return (
    <View style={styles.flex1}>
      <View style={[styles.panel, styles.panelCompact]}>
        <Text style={styles.panelTitle}>Buildings</Text>
        <FlatList
          data={buildings}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const addr = item.address || item.location || item.address_line || item.city || '-';
            const adminName =
              (item as any).admin_name ||
              (item as any).admin?.name ||
              (item as any).manager_name ||
              (item as any).contact_name ||
              '';
            const adminPhone =
              (item as any).admin_mobile ||
              (item as any).admin?.phone ||
              (item as any).manager_phone ||
              (item as any).contact_phone ||
              (item as any).mobile_number ||
              '';
            return (
              <View style={styles.card}>
                <Text style={styles.socName}>{item.name}</Text>
                <Text style={styles.socMeta}>Address: {addr}</Text>
                {adminName || adminPhone ? (
                  <Text style={styles.socMeta}>
                    Admin: {adminName || '—'} {adminPhone ? `• ${adminPhone}` : ''}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}
