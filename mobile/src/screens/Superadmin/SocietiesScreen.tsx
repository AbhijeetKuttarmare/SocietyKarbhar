import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import api from '../../services/api';
import { Feather } from '@expo/vector-icons';
import styles from '../../styles/superadminStyles';

type Props = { user: any };

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

export default function SocietiesScreen({ user }: Props) {
  const TAB_HEIGHT = 72;
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    name: '',
    country: '',
    city: '',
    area: '',
    mobile_number: '',
  });
  const [editingSociety, setEditingSociety] = useState<null | Society>(null);

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
      Alert.alert('Error', 'Could not load societies');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSociety = async () => {
    if (!form.name) return Alert.alert('Validation', 'Name is required');
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.post('/api/superadmin/societies', form, { headers });
      setSocieties((s) => [res.data.society, ...s]);
      setModalVisible(false);
      setForm({ name: '', country: '', city: '', area: '', mobile_number: '' });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to create society');
    } finally {
      setLoading(false);
    }
  };

  const openCreateAdmin = (soc: Society) => {
    // Navigate to admin creation flow in-app or show modal — simplified here
    Alert.alert('Create Admin', `Open create admin for ${soc.name}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setModalVisible(true);
            setEditingSociety(null);
          }}
        >
          <Text style={styles.addBtnText}>＋ Add Society</Text>
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
                  <Text style={styles.socCardTitle}>{s.name}</Text>
                  <Text style={styles.socCardSub}>
                    {ss.address || `${s.area || ''} ${s.city || ''}`}
                  </Text>
                  <Text style={styles.socCardMeta}>Admin: {adminName}</Text>
                  <View style={styles.socCardActions}>
                    {hasAdmin ? (
                      <TouchableOpacity
                        style={styles.smallBtnSuccess}
                        onPress={() => Alert.alert('View / Edit', s.name)}
                      >
                        <Text style={styles.smallBtnTextWhite}>View / Edit</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.smallBtn} onPress={() => openCreateAdmin(s)}>
                        <Text style={styles.smallBtnTextWhite}>Create Admin</Text>
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
