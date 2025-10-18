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
  Platform
} from 'react-native';
import api from '../services/api';
import { MaterialIcons, Feather } from '@expo/vector-icons';

type Props = { user: any; onLogout: () => void };
type Society = { id: string; name: string; country?: string; city?: string; area?: string; mobile_number?: string };

export default function SuperadminScreen({ user, onLogout }: Props) {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeTab, setActiveTab] = useState<'Dashboard'|'Societies'|'Admins'|'Buildings'|'Plans'|'Reports'|'Logs'|'Settings'>('Societies');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', country: '', city: '', area: '', mobile_number: '' });
  const [creatingAdminFor, setCreatingAdminFor] = useState<null | Society>(null);
  const [adminForm, setAdminForm] = useState({ name: '', phone: '', password: '' });
  const [editingSociety, setEditingSociety] = useState<null | Society>(null);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => { fetchSocieties(); }, []);
  useEffect(() => { if (activeTab === 'Admins') fetchAdmins(); if (activeTab === 'Buildings') fetchBuildings(); if (activeTab === 'Plans') fetchPlans(); }, [activeTab]);

  const fetchSocieties = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`;
      const res = await api.get('/api/superadmin/societies', { headers });
      setSocieties(res.data.societies || []);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load societies');
    } finally { setLoading(false); }
  };

  const fetchAdmins = async () => { try { const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; const res = await api.get('/api/superadmin/admins', { headers }); setAdmins(res.data.admins || []); } catch (err) { console.warn('fetchAdmins error', err); } };
  const fetchBuildings = async () => { try { const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; const res = await api.get('/api/superadmin/buildings', { headers }); setBuildings(res.data.buildings || []); } catch (err) { console.warn('fetchBuildings error', err); } };
  const fetchPlans = async () => { try { const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; const res = await api.get('/api/superadmin/plans', { headers }); setPlans(res.data.plans || []); } catch (err) { console.warn('fetchPlans error', err); } };

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
    } catch (err: any) { Alert.alert('Error', 'Failed to create society'); } finally { setLoading(false); }
  };

  const openCreateAdmin = (soc: Society) => { setCreatingAdminFor(soc); setAdminForm({ name: '', phone: soc.mobile_number || '', password: '' }); };
  const handleCreateAdmin = async () => { if (!creatingAdminFor) return; if (!adminForm.phone || !adminForm.password) return Alert.alert('Validation', 'Phone and password required'); try { setLoading(true); const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; await api.post('/api/superadmin/admins', { ...adminForm, societyId: creatingAdminFor.id }, { headers }); Alert.alert('Success', 'Admin created'); setCreatingAdminFor(null); } catch (err: any) { Alert.alert('Error', 'Failed to create admin'); } finally { setLoading(false); } };

  const handleDeleteServer = async (id: string) => {
    Alert.alert('Confirm', 'Delete society?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { setLoading(true); const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; await api.delete(`/api/superadmin/societies/${id}`, { headers }); setSocieties((s) => s.filter((x) => x.id !== id)); } catch (err: any) { Alert.alert('Error', 'Failed to delete'); } finally { setLoading(false); }
      }}
    ]);
  };

  const handleEditSave = async () => {
    if (!editingSociety) return;
    try { setLoading(true); const headers: any = {}; if ((user as any)?.token) headers.Authorization = `Bearer ${(user as any).token}`; const res = await api.put(`/api/superadmin/societies/${editingSociety.id}`, form, { headers }); setSocieties((s) => s.map((x) => (x.id === editingSociety.id ? res.data.society : x))); setEditingSociety(null); setModalVisible(false); setForm({ name: '', country: '', city: '', area: '', mobile_number: '' }); } catch (err: any) { Alert.alert('Error', 'Failed to update'); } finally { setLoading(false); }
  };

  // Table pagination logic
  const totalPages = Math.ceil(societies.length / itemsPerPage);
  const paginatedSocieties = societies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderTableRow = (item: Society) => (
    <View key={item.id} style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 1 }]}>{item.name}</Text>
      <Text style={[styles.tableCell, { flex: 1 }]}>{item.city || '-'}</Text>
      <Text style={[styles.tableCell, { flex: 1 }]}>{item.area || '-'}</Text>
      <Text style={[styles.tableCell, { flex: 1 }]}>{item.mobile_number || '-'}</Text>
      <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }]}>
        <TouchableOpacity accessibilityLabel={`Create admin for ${item.name}`} onPress={() => openCreateAdmin(item)} style={styles.iconButton}>
  <Feather name="user-plus" size={20} color="#3b82f6" />
</TouchableOpacity>

<TouchableOpacity accessibilityLabel={`Edit ${item.name}`} onPress={() => { 
    setEditingSociety(item); 
    setForm({ name: item.name, country: item.country || '', city: item.city || '', area: item.area || '', mobile_number: item.mobile_number || '' }); 
    setModalVisible(true); 
  }} style={styles.iconButton}>
  <Feather name="edit-3" size={20} color="#10b981" />
</TouchableOpacity>

<TouchableOpacity accessibilityLabel={`Delete ${item.name}`} onPress={() => handleDeleteServer(item.id)} style={styles.iconButton}>
  <Feather name="trash-2" size={20} color="#ef4444" />
</TouchableOpacity>

      </View>
    </View>
  );

  // Sidebar items
  const sidebarItems: Array<{ key: string; label: any; icon: any }> = [
    { key: 'Dashboard', label: 'Dashboard', icon: <MaterialIcons name="home" size={16} color="#9ca3af" /> },
    { key: 'Societies', label: 'Societies', icon: <MaterialIcons name="apartment" size={16} color="#9ca3af" /> },
    { key: 'Admins', label: 'Admins', icon: <Feather name="users" size={16} color="#9ca3af" /> },
    { key: 'Buildings', label: 'Buildings', icon: <MaterialIcons name="domain" size={16} color="#9ca3af" /> },
    { key: 'Plans', label: 'Plans', icon: <Feather name="credit-card" size={16} color="#9ca3af" /> },
    { key: 'Reports', label: 'Reports', icon: <Feather name="bar-chart-2" size={16} color="#9ca3af" /> },
    { key: 'Logs', label: 'Logs', icon: <Feather name="file-text" size={16} color="#9ca3af" /> },
    { key: 'Settings', label: 'Settings', icon: <Feather name="settings" size={16} color="#9ca3af" /> },
  ];

  return (
    <View style={styles.root}>
      {/* Sidebar */}
      <View style={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>{sidebarCollapsed ? 'SA' : 'Super Admin'}</Text>
          <TouchableOpacity onPress={() => setSidebarCollapsed(!sidebarCollapsed)} style={styles.collapseBtn}><Text style={styles.collapseBtnText}>{sidebarCollapsed ? '›' : '‹'}</Text></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {sidebarItems.map((it) => (
            <TouchableOpacity key={it.key} style={[styles.sidebarItem, activeTab === it.key && styles.sidebarItemActive]} onPress={() => setActiveTab(it.key as any)}>
              <View style={{ width: 28, alignItems: 'center' }}>{it.icon}</View>
              {!sidebarCollapsed && <Text style={[styles.sidebarText, activeTab === it.key && styles.sidebarTextActive]}>{it.label}</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.sidebarFooter}>
          {!sidebarCollapsed && <Text style={styles.footerUser}>Logged as {(user as any)?.name || '—'}</Text>}
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}><Feather name="log-out" size={18} color="#fff"/></TouchableOpacity>
        </View>
      </View>

      {/* Main area */}
      <View style={styles.mainArea}>
        {/* Top bar */}
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.menuToggle} onPress={() => setSidebarCollapsed(!sidebarCollapsed)}><Text style={styles.menuToggleText}>☰</Text></TouchableOpacity>
          <TextInput placeholder="Search societies, admins..." placeholderTextColor="#9ca3af" style={styles.search} />
          <View style={styles.topIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Notifications', 'No notifications')}><MaterialIcons name="notifications-none" size={18} color="#111"/></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Profile', `Logged in as ${(user as any)?.name}`)}><Feather name="user" size={18} color="#111"/></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onLogout}><Feather name="log-out" size={16} color="#111"/></TouchableOpacity>
          </View>
        </View>

        {/* Content area */}
        <View style={{ flex: 1 }}>
          {activeTab === 'Societies' && (
            <>
              <View style={styles.controls}>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setModalVisible(true); setEditingSociety(null); }}><Text style={styles.addBtnText}>＋ Add Society</Text></TouchableOpacity>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchSocieties}><Text style={styles.refreshBtnText}>⟳ Refresh</Text></TouchableOpacity>
              </View>
              {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
                <ScrollView horizontal>
                  <View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>Name</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>City</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>Area</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>Mobile</Text>
                      <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>Actions</Text>
                    </View>
                    {paginatedSocieties.map(renderTableRow)}
                  </View>
                </ScrollView>
              )}

              {/* Pagination Controls */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                <TouchableOpacity disabled={currentPage === 1} style={[styles.smallButton, { backgroundColor: currentPage === 1 ? '#9ca3af' : PRIMARY }]} onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}><Text style={styles.smallButtonText}>Previous</Text></TouchableOpacity>
                <Text style={{ alignSelf: 'center', marginHorizontal: 12, fontWeight: '700' }}>{currentPage} / {totalPages}</Text>
                <TouchableOpacity disabled={currentPage === totalPages} style={[styles.smallButton, { backgroundColor: currentPage === totalPages ? '#9ca3af' : PRIMARY }]} onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><Text style={styles.smallButtonText}>Next</Text></TouchableOpacity>
              </View>
            </>
          )}

          {/* Other tabs (Admins, Buildings, Plans, Reports, Logs, Settings) kept same as before */}
          {activeTab === 'Admins' && (
            <View style={[styles.panel, { padding: 6, flex: 1 }]}> 
              <Text style={styles.panelTitle}>Admins</Text>
              <FlatList
                data={admins}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <Text style={styles.socName}>{item.name || item.phone}</Text>
                    <Text style={styles.socMeta}>Phone: {item.phone}</Text>
                  </View>
                )}
              />
            </View>
          )}
          {activeTab === 'Buildings' && (
            <View style={[styles.panel, { padding: 6, flex: 1 }]}> 
              <Text style={styles.panelTitle}>Buildings</Text>
              <FlatList
                data={buildings}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <Text style={styles.socName}>{item.name}</Text>
                    <Text style={styles.socMeta}>Address: {item.address || '—'}</Text>
                  </View>
                )}
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
                    <Text style={styles.socMeta}>Price: {item.price} • Duration: {item.duration_days || item.duration_days} days</Text>
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
        <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalInner}>
            <Text style={styles.modalTitle}>{editingSociety ? 'Edit Society' : 'Add Society'}</Text>
            <TextInput placeholder="Name" value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} style={styles.input} />
            <TextInput placeholder="Mobile (admin)" value={form.mobile_number} onChangeText={(t) => setForm((p) => ({ ...p, mobile_number: t }))} style={styles.input} keyboardType="phone-pad" />
            <TextInput placeholder="Country" value={form.country} onChangeText={(t) => setForm((p) => ({ ...p, country: t }))} style={styles.input} />
            <TextInput placeholder="City" value={form.city} onChangeText={(t) => setForm((p) => ({ ...p, city: t }))} style={styles.input} />
            <TextInput placeholder="Area" value={form.area} onChangeText={(t) => setForm((p) => ({ ...p, area: t }))} style={styles.input} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => { setModalVisible(false); setEditingSociety(null); }}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#4f46e5' }]} onPress={editingSociety ? handleEditSave : handleAddSociety}><Text style={styles.modalBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={!!creatingAdminFor} animationType="slide" onRequestClose={() => setCreatingAdminFor(null)}>
          <View style={styles.modalInner}>
            <Text style={styles.modalTitle}>Create Admin for {creatingAdminFor?.name}</Text>
            <TextInput placeholder="Name" value={adminForm.name} onChangeText={(t) => setAdminForm((p) => ({ ...p, name: t }))} style={styles.input} />
            <TextInput placeholder="Phone" value={adminForm.phone} onChangeText={(t) => setAdminForm((p) => ({ ...p, phone: t }))} style={styles.input} keyboardType="phone-pad" />
            <TextInput placeholder="Password" value={adminForm.password} onChangeText={(t) => setAdminForm((p) => ({ ...p, password: t }))} style={styles.input} secureTextEntry />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => setCreatingAdminFor(null)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#10b981' }]} onPress={handleCreateAdmin}><Text style={styles.modalBtnText}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

// Colors
const PRIMARY = '#4f46e5';

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f3f4f6' },
  sidebar: { width: 220, backgroundColor: '#0f172a', paddingVertical: 12, paddingHorizontal: 10 },
  sidebarCollapsed: { width: 72 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sidebarTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  collapseBtn: { padding: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  collapseBtnText: { color: '#fff', fontSize: 14 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 6 },
  sidebarItemActive: { backgroundColor: PRIMARY, shadowColor: '#000', shadowOpacity: 0.12, elevation: 3 },
  sidebarIcon: { fontSize: 18, color: '#9ca3af', width: 28, textAlign: 'center' },
  sidebarText: { color: '#9ca3af', marginLeft: 8, fontSize: 14 },
  sidebarTextActive: { color: '#fff', fontWeight: '700' },
  sidebarFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerUser: { color: '#9ca3af', fontSize: 12 },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#fff', fontSize: 16 },
  mainArea: { flex: 1, padding: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  menuToggle: { padding: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 8, elevation: Platform.OS === 'android' ? 2 : 0 },
  menuToggleText: { fontWeight: '700' },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  topIcons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8, marginLeft: 6, backgroundColor: '#fff', borderRadius: 8 },

  /* Controls */
  controls: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  addBtn: { backgroundColor: PRIMARY, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e6e9f2' },
  refreshBtnText: { color: '#374151', fontWeight: '700' },

  /* Table */
  tableHeader: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#d1d5db', backgroundColor: '#fff' },
  tableCell: { color: '#111827', fontSize: 14 },

  /* Card */
  card: { padding: 14, borderRadius: 10, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  socName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  socMeta: { color: '#6b7280', marginTop: 6 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: PRIMARY, borderRadius: 6, marginRight: 6, marginTop: 4 },
  smallButtonText: { color: '#fff', fontSize: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  actionIconText: { color: '#fff', fontSize: 14 },

  panel: { padding: 20 },
  panelTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  panelText: { color: '#6b7280' },

  modalInner: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e6eef8' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
