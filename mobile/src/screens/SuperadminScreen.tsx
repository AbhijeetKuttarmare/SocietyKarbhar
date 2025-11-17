import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import api, { testConnectivity } from '../services/api';
import { defaultBaseUrl } from '../services/config';
import { notify } from '../services/notifier';
import pickAndUploadProfile from '../services/uploadProfile';
import DashboardScreen from './Superadmin/DashboardScreen';
import PopupBox from '../components/PopupBox';
import ProfileCard from '../components/ProfileCard';
import { BottomTabContext } from '../contexts/BottomTabContext';
import SuperadminProfile from './SuperadminProfile';
import AboutUs from './AboutUs';
import PrivacyPolicy from './PrivacyPolicy';
import TermsAndConditions from './TermsAndConditions';
import styles from '../styles/superadminStyles';
import ConfirmBox from '../components/ConfirmBox';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = { user: any; onLogout: () => void };
type Society = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  area?: string;
  mobile_number?: string;
};

export default function SuperadminScreen({ user, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const cardWidth = isMobile ? '100%' : 280;
  // reserve space for bottom tab
  const TAB_HEIGHT = 72;

  const [societies, setSocieties] = useState<Society[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    | 'Dashboard'
    | 'Societies'
    | 'Admins'
    | 'Buildings'
    | 'Plans'
    | 'Reports'
    | 'Logs'
    | 'Settings'
    | 'Profile'
  >('Dashboard');
  const [itemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<any>({
    name: '',
    country: '',
    city: '',
    area: '',
    mobile_number: '',
    builder_name: '',
    image_url: '',
  });
  const [editingSociety, setEditingSociety] = useState<any | null>(null);

  const [creatingAdminFor, setCreatingAdminFor] = useState<any | null>(null);
  const [adminForm, setAdminForm] = useState<any>({
    name: '',
    phone: '',
    email: '',
    permanent_address: '',
    emergency_contact: '',
    avatar: '',
  });
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [adminUploading, setAdminUploading] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmDanger, setConfirmDanger] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(
    (user as any)?.avatar || (user as any)?.image
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // fetch societies list
  const fetchSocieties = async () => {
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/societies', { headers });
      setSocieties(res.data.societies || res.data || []);
    } catch (e) {
      console.warn('fetchSocieties failed', e);
    }
  };

  // sync bottom tab -> local tab on mount
  const bottomTab = useContext(BottomTabContext);
  useEffect(() => {
    try {
      const k = bottomTab.activeKey;
      if (k === 'home') setActiveTab('Dashboard');
      else if (k === 'societies' || k === 'browses') setActiveTab('Societies');
      else if (k === 'admins') setActiveTab('Admins');
      else if (k === 'buildings') setActiveTab('Buildings');
      else if (k === 'plans') setActiveTab('Plans');
      else if (k === 'reports') setActiveTab('Reports');
      else if (k === 'logs') setActiveTab('Logs');
      else if (k === 'settings') setActiveTab('Settings');
      else if (k === 'profile') setActiveTab('Profile');
    } catch (e) {}
  }, [bottomTab?.activeKey]);

  useEffect(() => {
    // initial data
    fetchSocieties();
    fetchAdmins();
    fetchBuildings();
    fetchPlans();
  }, []);

  const [infoScreen, setInfoScreen] = useState<string | null>(null);

  // basic pagination helpers
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
  const fetchPlans = async () => {
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/plans', { headers });
      setPlans(res.data.plans || []);
    } catch (err) {
      console.warn('fetchPlans error', err);
    }
  };

  // Debug helper: quick connectivity + upload smoke test from the running device/emulator
  const testBackendConnectivityAndUpload = async () => {
    try {
      const base = defaultBaseUrl();
      console.debug('[SuperadminScreen] test ping ->', base);
      const ping = await fetch(`${base}/`);
      console.debug('[SuperadminScreen] ping status', ping.status);
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
      const uploadJsonUrl = `${base.replace(/\/$/, '')}/api/upload`;
      console.debug('[SuperadminScreen] attempting test JSON upload to', uploadJsonUrl);
      const r = await fetch(uploadJsonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: 'test.png' }),
      });
      const jd = await r.json().catch(() => ({} as any));
      console.debug('[SuperadminScreen] test upload result', r.status, jd);
      notify({
        type: 'info',
        message: `Connectivity test: ping=${ping.status} upload=${r.status}`,
      });
    } catch (e: any) {
      console.warn('[SuperadminScreen] connectivity test failed', e);
      notify({ type: 'error', message: `Connectivity test failed: ${e?.message || String(e)}` });
    }
  };

  // image picker + upload for modal (uses tenant upload endpoint)
  const pickImageAndUpload = async () => {
    try {
      // quick connectivity check so we can show a clearer error when the backend is unreachable
      try {
        const conn = await testConnectivity();
        if (!conn.ok) {
          console.warn('[SuperadminScreen] connectivity test failed', conn.error);
          notify({ type: 'error', message: `Cannot reach backend: ${conn.error}` });
          return;
        }
      } catch (e) {
        // ignore - proceed to actual upload attempt
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify({ type: 'warning', message: 'Permission to access photos is required' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
      });
      if ((result as any).canceled || (result as any).cancelled) return;
      const asset = (result as any).assets ? (result as any).assets[0] : (result as any);
      if (!asset || !asset.uri) {
        notify({ type: 'error', message: 'Could not read image data' });
        return;
      }
      const uri: string = asset.uri;
      const name = uri.split('/').pop() || 'photo.jpg';
      const lower = name.toLowerCase();
      const type = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', { uri, name, type } as any);

      const uploadUrl = `${defaultBaseUrl()}/api/tenant/upload_form`;
      const fetchHeaders: any = {};
      if ((user as any)?.token) fetchHeaders.Authorization = `Bearer ${(user as any).token}`;

      const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers: fetchHeaders });
      const res = await r.json().catch(() => ({} as any));
      const url = res && res.url ? res.url : '';
      if (!url) {
        notify({ type: 'error', message: 'Upload did not return a URL' });
        return;
      }
      setForm((prev: any) => ({ ...prev, image_url: url }));
    } catch (e: any) {
      console.error('image upload failed', e);
      try {
        if (typeof e.toJSON === 'function') console.error('axios error json', e.toJSON());
      } catch (ee) {}
      const msg = e?.message || String(e);
      notify({ type: 'error', message: `Image upload failed: ${msg}` });
    }
  };

  const handleAddSociety = async () => {
    if (!form.name) {
      notify({ type: 'warning', message: 'Name is required' });
      return;
    }
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.post('/api/superadmin/societies', form, { headers });
      setSocieties((s) => [res.data.society, ...s]);
      setModalVisible(false);
      setForm({
        name: '',
        country: '',
        city: '',
        area: '',
        mobile_number: '',
        builder_name: '',
        image_url: '',
      });
    } catch (err: any) {
      console.warn('Failed to create society', err);
      notify({ type: 'error', message: 'Failed to create society' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateAdmin = (soc: Society) => {
    setCreatingAdminFor(soc);
    setAdminForm({
      name: '',
      phone: soc.mobile_number || '',
      email: '',
      permanent_address: '',
      emergency_contact: '',
      avatar: '',
    });
  };
  // Fetch full society details before opening edit modal so form is populated with saved values
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
        builder_name: s.builder_name || '',
        image_url: s.image_url || '',
      });
      setModalVisible(true);
    } catch (err: any) {
      notify({ type: 'error', message: 'Could not load society details' });
    } finally {
      setLoading(false);
    }
  };
  const handleCreateAdmin = async () => {
    if (!creatingAdminFor) return;
    if (!adminForm.phone || !adminForm.name) {
      notify({ type: 'warning', message: 'Name and phone required' });
      return;
    }
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const payload = {
        name: adminForm.name,
        phone: adminForm.phone,
        email: adminForm.email,
        permanent_address: adminForm.permanent_address,
        emergency_contact: adminForm.emergency_contact,
        avatar: adminForm.avatar,
        societyId: creatingAdminFor.id,
      };
      const r = await api.post('/api/superadmin/admins', payload, { headers });
      // Success handled globally by NotificationProvider through axios interceptor
      // Refresh societies so the newly created admin is wired into the society record shown in UI
      try {
        await fetchSocieties();
      } catch (e) {
        /* ignore refresh error */
      }
      setCreatingAdminFor(null);
      // Optionally clear admin form
      setAdminForm({
        name: '',
        phone: '',
        email: '',
        permanent_address: '',
        emergency_contact: '',
        avatar: '',
      });
      // If API returned the created admin, we could also merge it into societies state, but fetch does that
    } catch (err: any) {
      console.warn('Failed to create admin', err);
      notify({ type: 'error', message: 'Failed to create admin' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;
    if (!adminForm.phone || !adminForm.name) {
      notify({ type: 'warning', message: 'Name and phone required' });
      return;
    }
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const payload = {
        name: adminForm.name,
        phone: adminForm.phone,
        email: adminForm.email,
        permanent_address: adminForm.permanent_address,
        emergency_contact: adminForm.emergency_contact,
        avatar: adminForm.avatar,
      };
      const r = await api.put(`/api/superadmin/admins/${editingAdmin.id}`, payload, { headers });
      // Success handled by global notifier
      // refresh admins list
      try {
        await fetchAdmins();
      } catch (e) {}
      setEditingAdmin(null);
      setAdminForm({
        name: '',
        phone: '',
        email: '',
        permanent_address: '',
        emergency_contact: '',
        avatar: '',
      });
    } catch (err: any) {
      console.warn('update admin failed', err);
      notify({ type: 'error', message: 'Failed to update admin' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    // Open our confirm modal and store target id
    setConfirmTarget(id);
    setConfirmTitle('Delete this society?');
    setConfirmMessage('This society will be permanently deleted and cannot be recovered.');
    setConfirmDanger(true);
    setConfirmVisible(true);
  };

  const runDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    try {
      setConfirmVisible(false);
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      await api.delete(`/api/superadmin/societies/${confirmTarget}`, { headers });
      setSocieties((s) => s.filter((x) => x.id !== confirmTarget));
    } catch (err: any) {
      console.warn('delete failed', err);
    } finally {
      setLoading(false);
      setConfirmTarget(null);
    }
  };

  const handleEditSave = async () => {
    if (!editingSociety) return;
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.put(`/api/superadmin/societies/${editingSociety.id}`, form, {
        headers,
      });
      setSocieties((s) => s.map((x) => (x.id === editingSociety.id ? res.data.society : x)));
      setEditingSociety(null);
      setModalVisible(false);
      setForm({
        name: '',
        country: '',
        city: '',
        area: '',
        mobile_number: '',
        builder_name: '',
        image_url: '',
      });
    } catch (err: any) {
      console.warn('Failed to update society', err);
    } finally {
      setLoading(false);
    }
  };

  // Table pagination logic
  const totalPages = Math.ceil(societies.length / itemsPerPage);
  const paginatedSocieties = societies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderTableRow = (item: Society) => (
    <View key={item.id} style={styles.tableRow}>
      <Text style={[styles.tableCellText, { flex: 1 }]}>{item.name}</Text>
      <Text style={[styles.tableCellText, { flex: 1 }]}>{item.city || '-'}</Text>
      <Text style={[styles.tableCellText, { flex: 1 }]}>{item.area || '-'}</Text>
      <Text style={[styles.tableCellText, { flex: 1 }]}>{item.mobile_number || '-'}</Text>
      <View
        style={[
          styles.tableCellView,
          { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={`Create admin for ${item.name}`}
          onPress={() => openCreateAdmin(item)}
          style={styles.iconButton}
        >
          <Feather name="user-plus" size={20} color="#3b82f6" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={`Edit ${item.name}`}
          onPress={() => {
            setEditingSociety(item);
            setForm({
              name: item.name,
              country: item.country || '',
              city: item.city || '',
              area: item.area || '',
              mobile_number: item.mobile_number || '',
              builder_name: (item as any).builder_name || '',
              image_url: (item as any).image_url || '',
            });
            setModalVisible(true);
          }}
          style={styles.iconButton}
        >
          <Feather name="edit-3" size={20} color="#10b981" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={`Delete ${item.name}`}
          onPress={() => handleDeleteServer(item.id)}
          style={styles.iconButton}
        >
          <Feather name="trash-2" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Sidebar items
  const sidebarItems: Array<{ key: string; label: any; icon: any }> = [
    {
      key: 'Dashboard',
      label: 'Dashboard',
      icon: <MaterialIcons name="home" size={16} color="#9ca3af" />,
    },
    {
      key: 'Societies',
      label: 'Societies',
      icon: <MaterialIcons name="apartment" size={16} color="#9ca3af" />,
    },
    { key: 'Admins', label: 'Admins', icon: <Feather name="users" size={16} color="#9ca3af" /> },
    {
      key: 'Buildings',
      label: 'Buildings',
      icon: <MaterialIcons name="domain" size={16} color="#9ca3af" />,
    },
    {
      key: 'Plans',
      label: 'Plans',
      icon: <Feather name="credit-card" size={16} color="#9ca3af" />,
    },
    {
      key: 'Reports',
      label: 'Reports',
      icon: <Feather name="bar-chart-2" size={16} color="#9ca3af" />,
    },
    { key: 'Logs', label: 'Logs', icon: <Feather name="file-text" size={16} color="#9ca3af" /> },
    {
      key: 'Settings',
      label: 'Settings',
      icon: <Feather name="settings" size={16} color="#9ca3af" />,
    },
  ];

  return (
    <>
      <View style={[styles.root, { flex: 1 }]}>
        {/* Main area */}
        <View style={[styles.mainArea, { paddingBottom: TAB_HEIGHT + 12 }]}>
          {/* Top bar */}
          <View style={styles.topbar}>
            <Text style={styles.projectTitle}>Society Management</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TextInput
                placeholder="Search societies, admins..."
                placeholderTextColor="#9ca3af"
                style={styles.search}
              />
            </View>
            <View style={styles.topIcons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => notify({ type: 'info', message: 'No notifications' })}
              >
                <MaterialIcons name="notifications-none" size={18} color="#111" />
              </TouchableOpacity>
              {/* removed top-right profile icon per request; profile moved to BottomTab */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <Feather name="log-out" size={16} color="#111" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Global confirm modal used for destructive actions */}
          <ConfirmBox
            visible={confirmVisible}
            title={confirmTitle}
            message={confirmMessage}
            danger={confirmDanger}
            onCancel={() => {
              setConfirmVisible(false);
              setConfirmTarget(null);
            }}
            onConfirm={runDeleteConfirmed}
            confirmLabel={confirmDanger ? 'Delete' : 'Confirm'}
            cancelLabel="Cancel"
          />

          {/* Content area */}
          <View style={{ flex: 1 }}>
            {/* Debug banner so we can see the screen mounted and which tab is active */}
            <View style={{ padding: 8 }}>
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>
                {/* DEBUG: activeTab = {activeTab} */}
              </Text>
            </View>
            {/* Dashboard tab (render DashboardScreen component) */}
            {activeTab === 'Dashboard' && (
              <View style={{ flex: 1 }}>
                <DashboardScreen user={user} />
              </View>
            )}
            {activeTab === 'Societies' && (
              <>
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                      // Clear form explicitly when opening Add modal so previous
                      // values are not shown.
                      setEditingSociety(null);
                      setForm({
                        name: '',
                        country: '',
                        city: '',
                        area: '',
                        mobile_number: '',
                        builder_name: '',
                        image_url: '',
                      });
                      setModalVisible(true);
                    }}
                  >
                    <Text style={styles.addBtnText}>＋ Add Society</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.refreshBtn} onPress={fetchSocieties}>
                    <Text style={styles.refreshBtnText}>⟳ Refresh</Text>
                  </TouchableOpacity>
                </View>
                {loading ? (
                  <ActivityIndicator style={{ marginTop: 20 }} />
                ) : (
                  <ScrollView
                    contentContainerStyle={{ paddingVertical: 8, paddingBottom: TAB_HEIGHT + 12 }}
                  >
                    <View style={styles.socCardsRow}>
                      {societies.map((s) => {
                        // Compute admin name defensively: API may return different shapes
                        const ss: any = s as any;
                        const adminFromArray =
                          Array.isArray(ss.adminSocieties) && ss.adminSocieties.length
                            ? ss.adminSocieties[0].name
                            : undefined;
                        const adminFromAdmins =
                          Array.isArray(ss.admins) && ss.admins.length
                            ? ss.admins[0].name
                            : undefined;
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

                        const initials = s.name
                          ? s.name
                              .split(' ')
                              .map((p: string) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : (s.id || '').slice(0, 2).toUpperCase();

                        return (
                          <View
                            key={s.id}
                            style={[
                              styles.card,
                              {
                                width: cardWidth,
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                marginVertical: 6,
                              },
                            ]}
                          >
                            {(s as any).image_url || (s as any).image ? (
                              <Image
                                source={{ uri: (s as any).image_url || (s as any).image }}
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 28,
                                  marginRight: 12,
                                  backgroundColor: '#eef2ff',
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 28,
                                  backgroundColor: '#eef2ff',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  marginRight: 12,
                                }}
                              >
                                <Text style={{ fontWeight: '800', color: '#4f46e5', fontSize: 16 }}>
                                  {initials}
                                </Text>
                              </View>
                            )}

                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 16, fontWeight: '700' }}>{s.name}</Text>
                              <Text style={{ color: '#6b7280', marginTop: 4 }}>
                                {ss.address || `${s.area || ''} ${s.city || ''}`}
                              </Text>

                              <View
                                style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}
                              >
                                {s.area || s.city || s.country ? (
                                  [s.area, s.city, s.country]
                                    .filter(Boolean)
                                    .slice(0, 3)
                                    .map((label: any, idx: number) => (
                                      <View
                                        key={idx}
                                        style={{
                                          backgroundColor: '#f3f4ff',
                                          paddingHorizontal: 8,
                                          paddingVertical: 4,
                                          borderRadius: 12,
                                          marginRight: 6,
                                          marginBottom: 6,
                                        }}
                                      >
                                        <Text style={{ fontSize: 12, color: '#4f46e5' }}>
                                          {label}
                                        </Text>
                                      </View>
                                    ))
                                ) : (
                                  <View
                                    style={{
                                      backgroundColor: '#f8fafc',
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      borderRadius: 12,
                                    }}
                                  >
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                      No location
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Builder name if present */}
                              {(s as any).builder_name ? (
                                <Text style={{ color: '#6b7280', marginTop: 6 }}>
                                  Builder: {(s as any).builder_name}
                                </Text>
                              ) : null}

                              <Text style={{ color: '#374151', marginTop: 8 }}>
                                Admin: {adminName}
                              </Text>
                            </View>

                            <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                              {hasAdmin ? (
                                <TouchableOpacity
                                  style={{ padding: 8 }}
                                  onPress={() => openEdit(s)}
                                >
                                  <Feather name="edit-3" size={18} color="#10b981" />
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={{ padding: 8 }}
                                  onPress={() => openCreateAdmin(s)}
                                >
                                  <Feather name="user-plus" size={18} color="#3b82f6" />
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={{ padding: 8 }}
                                onPress={() =>
                                  notify({ type: 'info', message: `Open ${s.name} details` })
                                }
                              >
                                <Feather name="eye" size={18} color="#6b7280" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            {/* Other tabs (Admins, Buildings, Plans, Reports, Logs, Settings) kept same as before */}
            {activeTab === 'Admins' && (
              <View style={{ flex: 1 }}>
                <View style={[styles.panel, { padding: 6, flex: 1 }]}>
                  <Text style={styles.panelTitle}>Admins</Text>
                  <FlatList
                    data={admins}
                    keyExtractor={(i) => i.id}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: TAB_HEIGHT + 24 }}
                    showsVerticalScrollIndicator={true}
                    // Ensure this FlatList handles vertical scroll independently
                    nestedScrollEnabled={true}
                    scrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={() => (
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: '#6b7280' }}>No admins found.</Text>
                      </View>
                    )}
                    renderItem={({ item }) => {
                      // Try several shapes returned by API: adminSocieties (included), societies, or single society fields
                      const admin: any = item as any;
                      const societiesArr = admin.adminSocieties || admin.societies || [];
                      const societyNames = Array.isArray(societiesArr)
                        ? societiesArr
                            .map((s: any) => s.name)
                            .filter(Boolean)
                            .join(', ')
                        : '';
                      const societyFallback = admin.society_name || admin.society?.name || '';
                      const initials = admin.name
                        ? admin.name
                            .split(' ')
                            .map((p: string) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : (admin.phone || '').slice(-2);

                      return (
                        <View
                          style={[
                            styles.card,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 12,
                              marginVertical: 6,
                            },
                          ]}
                        >
                          {(admin as any).avatar ? (
                            <Image
                              source={{ uri: (admin as any).avatar }}
                              style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }}
                            />
                          ) : (
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: '#eef2ff',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 12,
                              }}
                            >
                              <Text style={{ fontWeight: '800', color: '#4f46e5', fontSize: 16 }}>
                                {initials}
                              </Text>
                            </View>
                          )}

                          {/* Main info */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700' }}>
                              {admin.name || admin.phone}
                            </Text>
                            <Text style={{ color: '#6b7280', marginTop: 4 }}>
                              📞 {admin.phone || '-'}
                            </Text>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                              {Array.isArray(societiesArr) && societiesArr.length ? (
                                societiesArr.slice(0, 3).map((s: any, idx: number) => (
                                  <View
                                    key={idx}
                                    style={{
                                      backgroundColor: '#f3f4ff',
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      borderRadius: 12,
                                      marginRight: 6,
                                      marginBottom: 6,
                                    }}
                                  >
                                    <Text style={{ fontSize: 12, color: '#4f46e5' }}>
                                      {s.name || s}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <View
                                  style={{
                                    backgroundColor: '#f8fafc',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    {societyFallback || 'NA'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Actions */}
                          <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
                            <TouchableOpacity
                              style={{ padding: 8 }}
                              onPress={() => {
                                // open edit modal for this admin
                                const a = item as any;
                                const addr = a.address || a.permanent_address || '';
                                setEditingAdmin(a);
                                setAdminForm({
                                  name: a.name || '',
                                  phone: a.phone || a.mobile_number || '',
                                  email: a.email || '',
                                  permanent_address: addr,
                                  emergency_contact: a.emergency_contact || '',
                                  avatar: a.avatar || a.image || a.avatar_url || '',
                                });
                              }}
                            >
                              <Feather name="edit-3" size={18} color="#10b981" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ padding: 8 }}
                              onPress={() => {
                                try {
                                  Linking.openURL(`tel:${admin.phone}`);
                                } catch (e) {}
                              }}
                            >
                              <Feather name="phone" size={18} color="#3b82f6" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                  />
                </View>
              </View>
            )}
            {activeTab === 'Buildings' && (
              <View style={[styles.panel, { padding: 6, flex: 1 }]}>
                <Text style={styles.panelTitle}>Buildings</Text>
                <FlatList
                  data={buildings}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => {
                    // defensive accessors: API may return different shapes
                    const addr =
                      item.address || item.location || item.address_line || item.city || '-';
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
            )}
            {activeTab === 'Plans' && (
              <View style={[styles.panel, { padding: 6, flex: 1 }]}>
                <Text style={styles.panelTitle}>Subscription Plans</Text>
                <FlatList
                  data={plans}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <View style={styles.card}>
                      <Text style={styles.socName}>{item.name}</Text>
                      <Text style={styles.socMeta}>
                        Price: {item.price} • Duration: {item.duration_days || item.duration_days}{' '}
                        days
                      </Text>
                    </View>
                  )}
                />
              </View>
            )}
            {activeTab === 'Reports' && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Reports</Text>
                <Text style={styles.panelText}>Generate and view reports (placeholder).</Text>
              </View>
            )}
            {activeTab === 'Logs' && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Activity Logs</Text>
                <Text style={styles.panelText}>Superadmin activity logs (placeholder).</Text>
              </View>
            )}
            {activeTab === 'Settings' && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Settings</Text>
                <Text style={styles.panelText}>Profile and app settings (placeholder).</Text>
              </View>
            )}
            {activeTab === 'Profile' && (
              <View style={{ flex: 1 }}>
                <SuperadminProfile
                  user={user}
                  onBack={() => setActiveTab('Dashboard')}
                  onNavigate={(route) => setInfoScreen(route)}
                />
              </View>
            )}

            {/* Full page info screens opened from Profile - render in content area */}
            {infoScreen === 'AboutUs' && (
              <View style={{ flex: 1 }}>
                <AboutUs onClose={() => setInfoScreen(null)} />
              </View>
            )}
            {infoScreen === 'PrivacyPolicy' && (
              <View style={{ flex: 1 }}>
                <PrivacyPolicy onClose={() => setInfoScreen(null)} />
              </View>
            )}
            {infoScreen === 'TermsAndConditions' && (
              <View style={{ flex: 1 }}>
                <TermsAndConditions onClose={() => setInfoScreen(null)} />
              </View>
            )}
          </View>

          {/* Modals kept same as before */}
          <PopupBox
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false);
              setEditingSociety(null);
            }}
            title={editingSociety ? 'Edit Society' : 'Add Society'}
            dismissable={true}
            showFooter={true}
            footerContent={
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#ef4444', flex: 1, marginRight: 8 }]}
                  onPress={() => {
                    setModalVisible(false);
                    setEditingSociety(null);
                    setForm({
                      name: '',
                      country: '',
                      city: '',
                      area: '',
                      mobile_number: '',
                      builder_name: '',
                      image_url: '',
                    });
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#4f46e5', flex: 1, marginLeft: 8 }]}
                  onPress={editingSociety ? handleEditSave : handleAddSociety}
                >
                  <Text style={styles.modalBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            }
          >
            <View>
              {/* Name */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
                Name
              </Text>
              <TextInput
                placeholder="Ex: Green Meadows Society"
                placeholderTextColor="#9ca3af"
                value={form.name}
                onChangeText={(t) => setForm((p: any) => ({ ...p, name: t }))}
                style={styles.input}
              />

              {/* Admin mobile (shown when editing) */}
              {editingSociety ? (
                <>
                  <Text
                    style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}
                  >
                    Admin mobile
                  </Text>
                  <TextInput
                    placeholder="Ex: +91 98765 43210"
                    placeholderTextColor="#9ca3af"
                    value={form.mobile_number}
                    onChangeText={(t) => setForm((p: any) => ({ ...p, mobile_number: t }))}
                    style={styles.input}
                    keyboardType="phone-pad"
                  />
                </>
              ) : null}

              {/* Country */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
                Country
              </Text>
              <TextInput
                placeholder="Ex: India"
                placeholderTextColor="#9ca3af"
                value={form.country}
                onChangeText={(t) => setForm((p: any) => ({ ...p, country: t }))}
                style={styles.input}
              />

              {/* City */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
                City
              </Text>
              <TextInput
                placeholder="Ex: Pune"
                placeholderTextColor="#9ca3af"
                value={form.city}
                onChangeText={(t) => setForm((p: any) => ({ ...p, city: t }))}
                style={styles.input}
              />

              {/* Area */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
                Area
              </Text>
              <TextInput
                placeholder="Ex: Wakad"
                placeholderTextColor="#9ca3af"
                value={form.area}
                onChangeText={(t) => setForm((p: any) => ({ ...p, area: t }))}
                style={styles.input}
              />

              {/* Builder name */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
                Builder name
              </Text>
              <TextInput
                placeholder="Ex: ABC Builders (optional)"
                placeholderTextColor="#9ca3af"
                value={form.builder_name}
                onChangeText={(t) => setForm((p: any) => ({ ...p, builder_name: t }))}
                style={styles.input}
              />

              {/* Image Picker Section */}
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8, marginTop: 8 }}>
                Society Image
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { paddingVertical: 10, paddingHorizontal: 16 }]}
                  onPress={pickImageAndUpload}
                >
                  <Text style={{ color: '#fff' }}>Upload Photo</Text>
                </TouchableOpacity>
                {form.image_url ? (
                  <>
                    <Image
                      source={{ uri: form.image_url }}
                      style={{ width: 100, height: 70, marginLeft: 12, borderRadius: 8 }}
                    />
                    <TouchableOpacity
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: '#ef4444',
                          marginLeft: 12,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                        },
                      ]}
                      onPress={() => setForm((p: any) => ({ ...p, image_url: '' }))}
                    >
                      <Text style={{ color: '#fff' }}>Remove</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          </PopupBox>

          <Modal
            visible={!!creatingAdminFor || !!editingAdmin}
            animationType="slide"
            onRequestClose={() => {
              setCreatingAdminFor(null);
              setEditingAdmin(null);
            }}
          >
            <View style={styles.modalInner}>
              <Text style={styles.modalTitle}>
                {editingAdmin ? `Edit Admin` : `Create Admin for ${creatingAdminFor?.name}`}
              </Text>
              <TextInput
                placeholder="Name"
                value={adminForm.name}
                onChangeText={(t) => setAdminForm((p: any) => ({ ...p, name: t }))}
                style={styles.input}
              />
              <TextInput
                placeholder="Phone"
                value={adminForm.phone}
                onChangeText={(t) => setAdminForm((p: any) => ({ ...p, phone: t }))}
                style={styles.input}
                keyboardType="phone-pad"
              />
              <TextInput
                placeholder="Email"
                value={adminForm.email}
                onChangeText={(t) => setAdminForm((p: any) => ({ ...p, email: t }))}
                style={styles.input}
                keyboardType="email-address"
              />
              <TextInput
                placeholder="Permanent address"
                value={adminForm.permanent_address}
                onChangeText={(t) => setAdminForm((p: any) => ({ ...p, permanent_address: t }))}
                style={styles.input}
              />
              <TextInput
                placeholder="Emergency contact number"
                value={adminForm.emergency_contact}
                onChangeText={(t) => setAdminForm((p: any) => ({ ...p, emergency_contact: t }))}
                style={styles.input}
                keyboardType="phone-pad"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={async () => {
                    try {
                      setAdminUploading(true);
                      const url = await pickAndUploadProfile();
                      setAdminUploading(false);
                      if (!url) return; // cancelled
                      setAdminForm((p: any) => ({ ...p, avatar: url }));
                      // preview will show automatically
                    } catch (e: any) {
                      setAdminUploading(false);
                      console.warn('admin profile upload failed', e);
                      notify({ type: 'error', message: e?.message || 'Upload failed' });
                    }
                  }}
                >
                  <Text style={{ color: '#fff' }}>Upload Profile Photo</Text>
                </TouchableOpacity>

                {adminUploading ? (
                  <ActivityIndicator style={{ marginLeft: 12 }} />
                ) : adminForm.avatar ? (
                  <>
                    <Image
                      source={{ uri: adminForm.avatar }}
                      style={{ width: 72, height: 48, marginLeft: 12, borderRadius: 6 }}
                    />
                    <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: '#d1fae5',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: '#065f46', fontSize: 12 }}>Uploaded</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.smallBtn,
                          {
                            backgroundColor: '#ef4444',
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                          },
                        ]}
                        onPress={() => setAdminForm((p: any) => ({ ...p, avatar: '' }))}
                      >
                        <Text style={{ color: '#fff' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => {
                    setCreatingAdminFor(null);
                    setEditingAdmin(null);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#10b981' }]}
                  onPress={editingAdmin ? handleUpdateAdmin : handleCreateAdmin}
                >
                  <Text style={styles.modalBtnText}>{editingAdmin ? 'Update' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Profile modal for Superadmin */}
          <Modal visible={showProfileModal} animationType="slide" transparent>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalContent, { maxWidth: 420 }]}>
                <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 8 }}>Profile</Text>
                <ProfileCard
                  name={(user as any)?.name}
                  phone={(user as any)?.phone || (user as any)?.mobile_number}
                  email={(user as any)?.email}
                  address={(user as any)?.address || (user as any)?.area || ''}
                  imageUri={userAvatar || (user as any)?.avatar || (user as any)?.image}
                  onEdit={async () => {
                    // Perform a single multipart POST to /api/user/avatar so backend
                    // uploads to Cloudinary and persists the avatar URL in the DB.
                    try {
                      // Request permission and pick image
                      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!perm.granted) {
                        notify({
                          type: 'warning',
                          message: 'Permission to access photos is required',
                        });
                        return;
                      }
                      const res = await ImagePicker.launchImageLibraryAsync({
                        // avoid deprecated ImagePicker.MediaTypeOptions API; use MediaType when available or fallback to 'images'
                        mediaTypes: (ImagePicker as any).MediaType?.images || 'images',
                        quality: 0.8,
                      });
                      const cancelled =
                        (res as any).canceled === true || (res as any).cancelled === true;
                      if (cancelled) return; // user cancelled
                      const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
                      if (!asset || !asset.uri) {
                        notify({ type: 'error', message: 'Could not read image data' });
                        return;
                      }

                      const uri: string = asset.uri;
                      const name = uri.split('/').pop() || 'photo.jpg';
                      const lower = name.toLowerCase();
                      const type = lower.endsWith('.png')
                        ? 'image/png'
                        : lower.endsWith('.webp')
                        ? 'image/webp'
                        : 'image/jpeg';

                      const formData = new FormData();
                      if (Platform.OS === 'web') {
                        // On web convert blob
                        const resp = await fetch(uri);
                        const blob = await resp.blob();
                        formData.append('file', blob, name);
                      } else {
                        // On native (Expo/Android/iOS) convert the local file URI to a Blob
                        // and append that Blob to FormData. This avoids "TypeError: Network request failed"
                        // which can occur when fetch tries to send a local file URI directly on some devices.
                        try {
                          const resp = await fetch(uri);
                          const blob = await resp.blob();
                          formData.append('file', blob, name);
                        } catch (e) {
                          // Fallback to the previous approach if blob conversion fails for any reason
                          formData.append('file', { uri, name, type } as any);
                        }
                      }

                      // Determine base URL like other upload helpers
                      const base =
                        (api.defaults && (api.defaults as any).baseURL) || defaultBaseUrl();
                      const uploadUrl = `${String(base).replace(/\/$/, '')}/api/user/avatar`;

                      const headers: any = {};
                      if ((user as any)?.token)
                        headers.Authorization = `Bearer ${(user as any).token}`;
                      // Do NOT set Content-Type here; let fetch set the multipart boundary

                      console.debug(
                        '[SuperadminScreen] uploadUrl=',
                        uploadUrl,
                        'headers=',
                        headers
                      );
                      const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
                      let jd: any = {};
                      try {
                        jd = await r.json();
                      } catch (e) {
                        console.debug(
                          '[SuperadminScreen] upload response not JSON or empty body',
                          e
                        );
                      }
                      console.debug('[SuperadminScreen] upload response', r.status, jd);
                      if (!r.ok) {
                        const msg =
                          jd && (jd.error || jd.detail)
                            ? jd.error || jd.detail
                            : `status=${r.status}`;
                        notify({ type: 'error', message: 'Upload failed: ' + String(msg) });
                        return;
                      }
                      // Backend returns updated user record
                      const updatedUser = jd && jd.user ? jd.user : null;
                      const avatarUrl = updatedUser?.avatar || (jd && jd.url) || null;
                      if (!avatarUrl) {
                        notify({
                          type: 'error',
                          message: 'Upload succeeded but no avatar URL returned',
                        });
                        return;
                      }
                      setUserAvatar(avatarUrl);
                      notify({ type: 'success', message: 'Profile photo updated' });
                    } catch (e: any) {
                      console.warn('superadmin profile upload failed', e);
                      const msg = e?.message || String(e);
                      notify({ type: 'error', message: 'Upload failed: ' + msg });
                    }
                  }}
                  onCall={(p) => {
                    try {
                      Linking.openURL(`tel:${p}`);
                    } catch (e) {}
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#ccc', marginRight: 8 }]}
                    onPress={() => setShowProfileModal(false)}
                  >
                    <Text>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => {
                      setShowProfileModal(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <Text style={{ color: '#fff' }}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* BottomTab is rendered at the app root (App.tsx) and synced via BottomTabContext */}
          <ConfirmBox
            visible={showLogoutConfirm}
            title="Logout"
            message="Are you sure you want to logout?"
            danger={false}
            confirmLabel="Logout"
            cancelLabel="Cancel"
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={async () => {
              setShowLogoutConfirm(false);
              try {
                if (typeof onLogout === 'function') return onLogout();
                try {
                  await AsyncStorage.removeItem('token');
                } catch (er) {}
              } catch (e) {
                notify({ type: 'error', message: 'Logout failed' });
              }
            }}
          />
        </View>
      </View>
    </>
  );
}
