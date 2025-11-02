import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import api from '../services/api';
import ProfileCard from '../components/ProfileCard';
import { Linking } from 'react-native';
import pickAndUploadProfile from '../services/uploadProfile';
import DashboardScreen from './Superadmin/DashboardScreen';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { BottomTabContext } from '../contexts/BottomTabContext';

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
  // Fixed bottom tab height used to reserve space for content
  const TAB_HEIGHT = 72;
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeTab, setActiveTab] = useState<
    'Dashboard' | 'Societies' | 'Admins' | 'Buildings' | 'Plans' | 'Reports' | 'Logs' | 'Settings'
  >('Dashboard');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    country: '',
    city: '',
    area: '',
    mobile_number: '',
  });
  const [creatingAdminFor, setCreatingAdminFor] = useState<null | Society>(null);
  const [adminForm, setAdminForm] = useState({ name: '', phone: '', password: '' });
  const [editingSociety, setEditingSociety] = useState<null | Society>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(
    (user as any)?.avatar || (user as any)?.image
  );

  // Debug: log render and active tab to help diagnose blank screen issues
  useEffect(() => {
    console.log('[SuperadminScreen] render - activeTab=', activeTab);
  }, [activeTab]);

  const bottomTab = React.useContext(BottomTabContext);

  // Sync global bottom tab -> local activeTab
  useEffect(() => {
    try {
      const k = bottomTab.activeKey;
      // map global keys to superadmin local tabs
      if (k === 'home') setActiveTab('Dashboard');
      else if (k === 'societies' || k === 'browses') setActiveTab('Societies');
      else if (k === 'admins') setActiveTab('Admins');
      else if (k === 'buildings') setActiveTab('Buildings');
      else if (k === 'plans') setActiveTab('Plans');
      else if (k === 'reports') setActiveTab('Reports');
      else if (k === 'logs') setActiveTab('Logs');
      else if (k === 'settings') setActiveTab('Settings');
      else if (k === 'profile') {
        // open profile modal when bottom 'profile' key is pressed
        setShowProfileModal(true);
      }
    } catch (e) {}
  }, [bottomTab.activeKey]);

  // Sync local activeTab -> global bottom tab
  useEffect(() => {
    try {
      const map: any = {
        Dashboard: 'home',
        Societies: 'societies',
        Admins: 'admins',
        Buildings: 'buildings',
        Plans: 'plans',
        Reports: 'reports',
        Logs: 'logs',
        Settings: 'profile', // map Settings to profile tab so Settings highlights profile
      };
      const k = map[activeTab] || 'home';
      if (bottomTab.activeKey !== k) bottomTab.setActiveKey(k);
    } catch (e) {}
  }, [activeTab]);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchSocieties();
  }, []);
  useEffect(() => {
    if (activeTab === 'Admins') fetchAdmins();
    if (activeTab === 'Buildings') fetchBuildings();
    if (activeTab === 'Plans') fetchPlans();
  }, [activeTab]);

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
    setCreatingAdminFor(soc);
    setAdminForm({ name: '', phone: soc.mobile_number || '', password: '' });
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
      });
      setModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load society details');
    } finally {
      setLoading(false);
    }
  };
  const handleCreateAdmin = async () => {
    if (!creatingAdminFor) return;
    if (!adminForm.phone || !adminForm.password)
      return Alert.alert('Validation', 'Phone and password required');
    try {
      setLoading(true);
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const r = await api.post(
        '/api/superadmin/admins',
        { ...adminForm, societyId: creatingAdminFor.id },
        { headers }
      );
      Alert.alert('Success', 'Admin created');
      // Refresh societies so the newly created admin is wired into the society record shown in UI
      try {
        await fetchSocieties();
      } catch (e) {
        /* ignore refresh error */
      }
      setCreatingAdminFor(null);
      // Optionally clear admin form
      setAdminForm({ name: '', phone: '', password: '' });
      // If API returned the created admin, we could also merge it into societies state, but fetch does that
    } catch (err: any) {
      Alert.alert('Error', 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    Alert.alert('Confirm', 'Delete society?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const headers: any = {};
            if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
            await api.delete(`/api/superadmin/societies/${id}`, { headers });
            setSocieties((s) => s.filter((x) => x.id !== id));
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
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
      setForm({ name: '', country: '', city: '', area: '', mobile_number: '' });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update');
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
                onPress={() => Alert.alert('Notifications', 'No notifications')}
              >
                <MaterialIcons name="notifications-none" size={18} color="#111" />
              </TouchableOpacity>
              {/* removed top-right profile icon per request; profile moved to BottomTab */}
              <TouchableOpacity style={styles.iconButton} onPress={onLogout}>
                <Feather name="log-out" size={16} color="#111" />
              </TouchableOpacity>
            </View>
          </View>

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
                                onPress={() => Alert.alert('View', `Open ${s.name} details`)}
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
                          {/* Avatar / initials */}
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
                              onPress={() =>
                                Alert.alert('Edit admin', 'Edit functionality not implemented')
                              }
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
          </View>

          {/* Modals kept same as before */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalInner}>
              <Text style={styles.modalTitle}>
                {editingSociety ? 'Edit Society' : 'Add Society'}
              </Text>
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

          <Modal
            visible={!!creatingAdminFor}
            animationType="slide"
            onRequestClose={() => setCreatingAdminFor(null)}
          >
            <View style={styles.modalInner}>
              <Text style={styles.modalTitle}>Create Admin for {creatingAdminFor?.name}</Text>
              <TextInput
                placeholder="Name"
                value={adminForm.name}
                onChangeText={(t) => setAdminForm((p) => ({ ...p, name: t }))}
                style={styles.input}
              />
              <TextInput
                placeholder="Phone"
                value={adminForm.phone}
                onChangeText={(t) => setAdminForm((p) => ({ ...p, phone: t }))}
                style={styles.input}
                keyboardType="phone-pad"
              />
              <TextInput
                placeholder="Password"
                value={adminForm.password}
                onChangeText={(t) => setAdminForm((p) => ({ ...p, password: t }))}
                style={styles.input}
                secureTextEntry
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => setCreatingAdminFor(null)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#10b981' }]}
                  onPress={handleCreateAdmin}
                >
                  <Text style={styles.modalBtnText}>Create</Text>
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
                    try {
                      const url = await pickAndUploadProfile();
                      if (!url) return; // cancelled
                      await api.put('/api/user', { avatar: url });
                      setUserAvatar(url);
                      alert('Profile photo updated');
                    } catch (e) {
                      console.warn('superadmin profile upload failed', e);
                      const msg = (e as any)?.message || 'Upload failed';
                      alert(msg);
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
                  <TouchableOpacity style={styles.smallBtn} onPress={onLogout}>
                    <Text style={{ color: '#fff' }}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* BottomTab is rendered at the app root (App.tsx) and synced via BottomTabContext */}
        </View>
      </View>
    </>
  );
}

import styles from '../styles/superadminStyles';
