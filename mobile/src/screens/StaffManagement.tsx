import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import api from '../services/api';
import ConfirmBox from '../components/ConfirmBox';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';
import { Ionicons } from '@expo/vector-icons';
import { notify } from '../services/notifier';

type Props = {
  buildings?: any[];
  // when true the component will not render its own search/add controls
  hideControls?: boolean;
  // external search query to sync with parent header
  externalQuery?: string;
  // a numeric key that, when changed, will force a refresh
  refreshKey?: number;
  // control the visibility of the add form from parent
  addVisible?: boolean;
  onAddToggle?: (v: boolean) => void;
};

export default function StaffManagement(props: Props) {
  const {
    buildings = [],
    hideControls,
    externalQuery,
    refreshKey,
    addVisible,
    onAddToggle,
  } = props || ({} as Props);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [staffType, setStaffType] = useState('');
  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);
  const [aadhaarUploading, setAadhaarUploading] = useState(false);
  const [phone, setPhone] = useState('');
  const [wingId, setWingId] = useState<string | null>(null);
  const [status, setStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  // sync external query if provided
  useEffect(() => {
    if (externalQuery !== undefined) setQ(externalQuery || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery]);

  // trigger refresh when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined) fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // control add form via prop
  useEffect(() => {
    if (addVisible !== undefined) setShowAddForm(!!addVisible);
  }, [addVisible]);

  async function fetchStaff() {
    try {
      setLoading(true);
      const r = await api.get('/api/admin/staff');
      setStaff(r.data.staff || []);
    } catch (e) {
      console.warn('fetch staff failed', e);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  async function createStaff() {
    if (!name) {
      notify({ type: 'warning', message: 'Name required' });
      return;
    }
    if (staffType === 'Security Guards' && !aadhaarUrl) {
      notify({ type: 'warning', message: 'Please upload Aadhaar card for security guards' });
      return;
    }
    try {
      setSubmitting(true);
      const payload: any = {
        name,
        staffType,
        phone,
        wingId,
        status: status ? 'active' : 'inactive',
        // request backend create login-capable user for security guards
        role: staffType === 'Security Guards' ? 'security_guard' : undefined,
        aadhaarUrl: aadhaarUrl || undefined,
      };
      const r = await api.post('/api/admin/staff', payload);
      setName('');
      setStaffType('');
      setPhone('');
      setWingId(null);
      setStatus(true);
      notify({ type: 'success', message: 'Staff Added Successfully' });
      // if parent controls add form, notify parent to close it
      if (onAddToggle) onAddToggle(false);
      setShowAddForm(false);
      fetchStaff();
    } catch (err: any) {
      console.warn('create staff failed', err);
      const msg =
        (err &&
          (err as any).response &&
          (err as any).response.data &&
          (err as any).response.data.error) ||
        'Failed to add staff';
      notify({ type: 'error', message: String(msg) });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStaff(id: string) {
    // open confirm modal
    setConfirmTarget(id);
    setConfirmVisible(true);
  }

  const runDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    try {
      setConfirmVisible(false);
      await api.delete('/api/admin/staff/' + confirmTarget);
      fetchStaff();
    } catch (e) {
      console.warn('delete staff failed', e);
      notify({ type: 'error', message: 'Delete failed' });
    } finally {
      setConfirmTarget(null);
    }
  };

  const renderItem = ({ item }: any) => {
    const avatarUri =
      item?.avatar || item?.image || item?.photo || item?.profile_pic || item?.image_url || null;
    const initials = (item?.name || item?.phone || '')
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <View style={styles.staffCard}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri } as any} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={{ fontWeight: '700', color: '#1f2937' }}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.staffName}>{item.name}</Text>
          <Text style={styles.staffMeta} numberOfLines={1}>
            {item.staffType || 'Staff'} • {item.phone || '—'}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {item.staffType ? item.staffType.split(' ')[0] : 'Staff'}
              </Text>
            </View>
            <Text style={{ marginLeft: 10, color: '#6b7280' }}>{item.wingName || ''}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={[
              styles.statusBadge,
              item.status && String(item.status).toLowerCase() === 'active'
                ? styles.statusActive
                : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusText}>{item.status || '—'}</Text>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <TouchableOpacity onPress={() => deleteStaff(item.id)} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const filtered = staff.filter((s) => {
    if (!q) return true;
    const low = q.toLowerCase();
    return (
      String(s.name || '')
        .toLowerCase()
        .includes(low) ||
      String(s.phone || '')
        .toLowerCase()
        .includes(low) ||
      String(s.staffType || '')
        .toLowerCase()
        .includes(low)
    );
  });

  return (
    <View style={{ padding: 8, paddingBottom: 0 }}>
      {!hideControls && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TextInput
            placeholder="Search staff by name, phone or type"
            value={q}
            onChangeText={setQ}
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TouchableOpacity
            style={[styles.primaryButton, { paddingHorizontal: 12, paddingVertical: 8 }]}
            onPress={() => {
              setShowAddForm((s) => !s);
              if (onAddToggle) onAddToggle(!showAddForm);
            }}
          >
            <Text style={{ color: '#fff' }}>{showAddForm ? 'Close' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAddForm && (
        <View style={styles.formRow}>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
          {/* Staff type selector */}
          <View>
            <TouchableOpacity
              onPress={() => setShowTypeOptions((s) => !s)}
              style={[styles.input, { justifyContent: 'center' }]}
            >
              <Text>{staffType || 'Select staff type'}</Text>
            </TouchableOpacity>
            {showTypeOptions && (
              <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 6, marginTop: 6 }}>
                {[
                  'Security Guards',
                  'Cleaners',
                  'Gardeners',
                  'Electrician',
                  'Plumber',
                  'Manager/Supervisor',
                  'Waste Collector',
                ].map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setStaffType(t);
                      setShowTypeOptions(false);
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TextInput
            placeholder="Mobile"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            keyboardType="phone-pad"
          />

          {/* Aadhaar upload shown only for Security Guards */}
          {staffType === 'Security Guards' && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ marginBottom: 6 }}>Aadhaar (required)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[styles.primaryButton, { paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={async () => {
                    try {
                      setAadhaarUploading(true);
                      // Aadhaar is an image — prefer the profile image picker which attempts direct Cloudinary upload
                      const url = await pickAndUploadProfile();
                      if (url) setAadhaarUrl(url);
                    } catch (e) {
                      console.warn('aadhaar upload failed', e);
                      notify({ type: 'error', message: 'Upload failed' });
                    } finally {
                      setAadhaarUploading(false);
                    }
                  }}
                >
                  {aadhaarUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff' }}>
                      {aadhaarUrl ? 'Replace Aadhaar' : 'Upload Aadhaar'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={{ width: 12 }} />
                {aadhaarUrl ? <Text style={{ flex: 1, color: '#065f46' }}>Uploaded</Text> : null}
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
            <Text style={{ marginRight: 8 }}>Status</Text>
            <Switch value={status} onValueChange={setStatus} />
          </View>
          <Text style={{ marginTop: 6, marginBottom: 6 }}>Assigned Wing (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setWingId(null)}
              style={[styles.pill, wingId === null ? styles.pillActive : {}]}
            >
              <Text>None</Text>
            </TouchableOpacity>
            {buildings.map((b: any) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => setWingId(b.id)}
                style={[styles.pill, wingId === b.id ? styles.pillActive : {}]}
              >
                <Text>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={createStaff}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff' }}>Create Staff</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 12 }} />
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Staff List</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}
      <ConfirmBox
        visible={confirmVisible}
        title="Delete this staff?"
        message="This staff member will be permanently removed and cannot be recovered."
        danger
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTarget(null);
        }}
        onConfirm={runDeleteConfirmed}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: { backgroundColor: '#fff', padding: 12, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 8, borderRadius: 6, marginBottom: 8 },
  primaryButton: {
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    // shadow
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 56, height: 56, borderRadius: 28, resizeMode: 'cover' },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffName: { fontWeight: '800', fontSize: 15, color: '#111' },
  staffMeta: { color: '#6b7280', marginTop: 4 },
  roleBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleText: { color: '#4f46e5', fontWeight: '700', fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusActive: { backgroundColor: '#ECFDF5' },
  statusInactive: { backgroundColor: '#FEF3F2' },
  statusText: { fontWeight: '700', color: '#065f46' },
  listTitle: { fontWeight: '700' },
  listSub: { color: '#6b7280' },
  iconBtn: { padding: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    marginBottom: 6,
  },
  pillActive: { backgroundColor: '#dbeafe' },
});
