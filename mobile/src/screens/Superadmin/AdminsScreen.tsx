import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import api from '../../services/api';
import styles from '../../styles/superadminStyles';

type Props = { user: any };

export default function AdminsScreen({ user }: Props) {
  const TAB_HEIGHT = 72;
  const [admins, setAdmins] = useState<any[]>([]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/admins', { headers });
      setAdmins(res.data.admins || []);
    } catch (err) {
      console.warn('fetchAdmins error', err);
    }
  };

  return (
    <View style={styles.flex1}>
      <View style={[styles.panel, styles.panelCompact]}>
        <Text style={styles.panelTitle}>Admins</Text>
        <FlatList
          data={admins}
          keyExtractor={(i) => i.id}
          style={styles.flatlistFlex}
          contentContainerStyle={[styles.flatlistContent, { paddingBottom: TAB_HEIGHT + 24 }]}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const admin: any = item as any;
            const societiesArr = admin.adminSocieties || admin.societies || [];
            const societyNames = Array.isArray(societiesArr)
              ? societiesArr
                  .map((s: any) => s.name)
                  .filter(Boolean)
                  .join(', ')
              : '';
            const societyFallback = admin.society_name || admin.society?.name || '';
            return (
              <View style={styles.card}>
                <Text style={styles.socName}>{admin.name || admin.phone}</Text>
                <Text style={styles.socMeta}>Phone: {admin.phone || '-'}</Text>
                <Text style={styles.socMeta}>
                  Society: {societyNames || societyFallback || 'NA'}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyListPadding}>
              <Text style={styles.emptyListText}>No admins found.</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}
