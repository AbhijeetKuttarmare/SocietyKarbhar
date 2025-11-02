import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const cardWidth = isMobile ? '100%' : 280;
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

  // Open edit modal for a society: fetch full object and populate form
  const openEdit = async (soc: Society) => {
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get(`/api/superadmin/societies/${soc.id}`, { headers });
      const s = res.data.society || res.data || soc;
      setEditingSociety(s);
      setForm({
        name: s.name || '',
        country: s.country || '',
        city: s.city || '',
        area: s.area || '',
        mobile_number: s.mobile_number || s.mobile || '',
      });
      setModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load society details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingSociety) return Alert.alert('Error', 'Nothing to save');
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.put(`/api/superadmin/societies/${editingSociety.id}`, form, {
        headers,
      });
      // update local state
      setSocieties((s) => s.map((x) => (x.id === editingSociety.id ? res.data.society : x)));
      setEditingSociety(null);
      setModalVisible(false);
      setForm({ name: '', country: '', city: '', area: '', mobile_number: '' });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update society');
    } finally {
      setLoading(false);
    }
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

      {/* Modal for Add/Edit */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalInner}>
          <Text style={styles.modalTitle}>{editingSociety ? 'Edit Society' : 'Add Society'}</Text>
          <TextInput
            placeholder="Name"
            value={form.name}
            onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
            style={styles.input}
          />
          {editingSociety ? (
            <TextInput
              placeholder="Mobile (admin)"
              value={form.mobile_number}
              onChangeText={(t) => setForm((p) => ({ ...p, mobile_number: t }))}
              style={styles.input}
              keyboardType="phone-pad"
            />
          ) : null}
          <TextInput
            placeholder="Country"
            value={form.country}
            onChangeText={(t) => setForm((p) => ({ ...p, country: t }))}
            style={styles.input}
          />
          <TextInput
            placeholder="City"
            value={form.city}
            onChangeText={(t) => setForm((p) => ({ ...p, city: t }))}
            style={styles.input}
          />
          <TextInput
            placeholder="Area"
            value={form.area}
            onChangeText={(t) => setForm((p) => ({ ...p, area: t }))}
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => {
                setModalVisible(false);
                setEditingSociety(null);
              }}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#4f46e5' }]}
              onPress={editingSociety ? handleEditSave : handleAddSociety}
            >
              <Text style={styles.modalBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
