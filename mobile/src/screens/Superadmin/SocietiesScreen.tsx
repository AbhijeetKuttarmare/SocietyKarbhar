import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { notify } from '../../services/notifier';
import api from '../../services/api';
import { Feather } from '@expo/vector-icons';
import styles from '../../styles/superadminStyles';

type Props = {
  user: any;
  navigation: any;
};

type Society = {
  id: string;
  name: string;
  area?: string;
  city?: string;
  mobile_number?: string;
  admin_name?: string;
  admin?: any;
  adminSocieties?: any[];
  admins?: any[];
};

export default function SocietiesScreen({ user, navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const cardWidth = isMobile ? '100%' : 280;
  const TAB_HEIGHT = 72;
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(false);

  // Open edit screen for a society
  const openEdit = (soc: Society) => {
    navigation.navigate('AddEditSociety', {
      society: soc,
      user: user,
      onSave: fetchSocieties,
    });
  };

  useEffect(() => {
    fetchSocieties();
  }, []);

  const fetchSocieties = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/societies', { headers });
      setSocieties(res.data.societies || []);
    } catch (err: any) {
      notify({ type: 'error', message: 'Could not load societies' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateAdmin = (soc: Society) => {
    // Navigate to admin creation flow in-app or show modal — simplified here
    notify({ type: 'info', message: `Open create admin for ${soc.name}` });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            navigation.navigate('AddEditSociety', {
              user: user,
              onSave: fetchSocieties,
            });
          }}
        >
          <Text style={styles.addBtnText}>Add Society</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSocieties}>
          <Text style={styles.refreshBtnText}>⟳ Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_HEIGHT + 12 }]}
      >
        <View style={styles.socCardsRow}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : (
            societies.map((s) => {
              const ss: any = s as any;
              const adminFromArray =
                Array.isArray(ss.adminSocieties) && ss.adminSocieties.length
                  ? ss.adminSocieties[0].name
                  : undefined;
              const adminFromAdmins =
                Array.isArray(ss.admins) && ss.admins.length ? ss.admins[0].name : undefined;
              const adminName =
                ss.admin_name ||
                ss.admin?.name ||
                adminFromArray ||
                adminFromAdmins ||
                ss.mobile_number ||
                'NA';
              const hasAdmin = !!(
                ss.admin ||
                ss.admin_name ||
                adminFromArray ||
                adminFromAdmins ||
                ss.admin_mobile ||
                ss.mobile_number
              );

              return (
                <View key={s.id} style={styles.socCard}>
                  {ss.image_url ? (
                    <Image
                      source={{ uri: ss.image_url }}
                      style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 8 }}
                    />
                  ) : null}
                  <Text style={styles.socCardTitle}>{s.name}</Text>
                  {ss.builder_name ? (
                    <Text style={{ color: '#374151', marginBottom: 4 }}>
                      Builder: {ss.builder_name}
                    </Text>
                  ) : null}
                  <Text style={styles.socCardSub}>
                    {ss.address || `${s.area || ''} ${s.city || ''}`}
                  </Text>
                  <Text style={styles.socCardMeta}>Admin: {adminName}</Text>
                  <View style={styles.socCardActions}>
                    {hasAdmin ? (
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: '#10b981' }]}
                        onPress={() => openEdit(s)}
                      >
                        <Text style={{ color: '#fff' }}>View / Edit</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.smallBtn} onPress={() => openCreateAdmin(s)}>
                        <Text style={{ color: '#fff' }}>Create Admin</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
          {societies.length === 0 && !loading && (
            <View style={{ padding: 12 }}>
              <Text style={{ color: '#6b7280' }}>No societies yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
