import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Button,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
  Image,
  Linking,
} from 'react-native';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import BottomTab from '../components/BottomTab';
import OwnerScreen from './OwnerScreen';
import * as DocumentPicker from 'expo-document-picker';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile from '../services/uploadProfile';

type Props = { user: any; onLogout: () => void };

export default function TenantScreen({ user, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isDesktop = width >= 900;

  const [showSidebar, setShowSidebar] = useState(false);
  // allow owner users to open the Owner dashboard inline (helps web testing where role routing may differ)
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  // request OwnerScreen to open Add Tenant modal
  const [ownerOpenRequest, setOwnerOpenRequest] = useState(false);

  // UI state
  const [tab, setTab] = useState<
    | 'home'
    | 'profile'
    | 'documents'
    | 'rent'
    | 'maintenance'
    | 'notices'
    | 'agreement'
    | 'support'
    | 'complaints'
  >('home');
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Profile / data
  const [profile, setProfile] = useState<any>(user || { name: '', phone: '' });
  const [agreements, setAgreements] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [rentHistory, setRentHistory] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  // Modals for forms
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({ title: '', description: '', image: '' });
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ message: '', image: '' });
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', image: '' });

  // placeholder sample data (used when API calls fail)
  const sampleAgreement = {
    id: 'agr-1',
    start_date: '2024-01-01',
    end_date: '2025-01-01',
    deposit: 50000,
    rent: 15000,
    file_url: '',
  };
  const sampleDocs = [
    { id: 'd1', title: 'Aadhaar', file_url: '' },
    { id: 'd2', title: 'PAN', file_url: '' },
  ];
  const sampleRentHistory = [
    { id: 'r1', date: '2025-09-01', amount: 15000, status: 'paid' },
    { id: 'r2', date: '2025-10-01', amount: 15000, status: 'due' },
  ];

  useEffect(() => {
    fetchCounts();
    fetchNotices();
    loadLocalData();
  }, []);

  function loadLocalData() {
    setAgreements([sampleAgreement]);
    setDocuments(sampleDocs);
    setRentHistory(sampleRentHistory);
    setMaintenance([]);
    setComplaints([]);
  }

  async function fetchCounts() {
    try {
      const r = await api.get('/api/notices/count');
      setNoticesCount(Number(r.data.count || 0));
    } catch (e) {
      /* ignore */
    }
  }

  async function fetchNotices() {
    try {
      const r = await api.get('/api/notices');
      setNotices(r.data.notices || []);
    } catch (e) {
      console.warn('fetch notices failed', e);
    }
  }

  // Profile update (optimistic)
  async function saveProfile() {
    try {
      await api.put('/api/user', profile); // if endpoint exists
      alert('Profile saved');
    } catch (e) {
      console.warn('save profile failed', e);
      alert('Saved locally (server call failed)');
    }
  }

  // Document picker for support/maintenance images
  async function pickFile(setter: (uri: string) => void) {
    try {
      const res: any = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      if (res.type === 'success') setter(res.uri);
    } catch (e) {
      console.warn('pick failed', e);
    }
  }

  async function submitMaintenance() {
    try {
      // try tenant-specific endpoint if exists, otherwise fallback to owner maintenance endpoint
      const payload: any = {
        title: maintenanceForm.title,
        description: maintenanceForm.description,
      };
      if (maintenanceForm.image) payload.image = maintenanceForm.image;
      // preferred tenant endpoint (may not exist) -> /api/maintenance
      try {
        const r = await api.post('/api/maintenance', payload);
        setMaintenance((s) => [r.data.maintenance, ...s]);
      } catch (err) {
        // fallback to owner maintenance route (may be forbidden) -> /api/owner/maintenance
        try {
          const r2 = await api.post('/api/owner/maintenance', payload);
          setMaintenance((s) => [r2.data.maintenance, ...s]);
        } catch (e2) {
          console.warn('maintenance post failed', e2);
          setMaintenance((s) => [
            { id: String(Date.now()), ...payload, status: 'open', raised_by: profile.id || 'me' },
            ...s,
          ]);
        }
      }
      setShowMaintenanceModal(false);
      setMaintenanceForm({ title: '', description: '', image: '' });
    } catch (e) {
      console.warn('submit maintenance failed', e);
      alert('Failed to submit');
    }
  }

  async function submitComplaint() {
    try {
      const payload = { title: complaintForm.title, description: complaintForm.description };
      try {
        const r = await api.post('/api/complaints', payload);
        setComplaints((s) => [r.data.complaint, ...s]);
      } catch (err) {
        // try owner endpoint
        try {
          const r2 = await api.post('/api/owner/maintenance', payload);
          setComplaints((s) => [r2.data.maintenance, ...s]);
        } catch (e2) {
          setComplaints((s) => [
            { id: String(Date.now()), ...payload, status: 'open', raised_by: profile.id || 'me' },
            ...s,
          ]);
        }
      }
      setShowComplaintModal(false);
      setComplaintForm({ title: '', description: '', image: '' });
    } catch (e) {
      console.warn('submit complaint failed', e);
      alert('Failed to submit');
    }
  }

  async function submitSupport() {
    try {
      const payload = { message: supportForm.message };
      try {
        await api.post('/api/support', payload);
        alert('Support request sent');
      } catch (e) {
        alert('Support request queued (no server endpoint)');
      }
      setShowSupportModal(false);
      setSupportForm({ message: '', image: '' });
    } catch (e) {
      console.warn(e);
    }
  }

  // small render helpers
  const StatCard = ({ title, value, icon }: any) => (
    <View style={styles.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon || 'wallet'} size={18} color="#fff" />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* mobile top bar */}
      {isMobile && (
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setShowSidebar(true)}
              style={{ marginRight: 12 }}
              accessibilityLabel="Open menu"
            >
              <Ionicons name="menu" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={styles.appTitle}>Society Management</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                fetchNotices();
                setShowNoticeModal(true);
              }}
              style={{ marginRight: 12 }}
            >
              <Ionicons name="notifications" size={22} color="#111" />
              {noticesCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>{noticesCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {/* If user is owner, allow quick switch to Owner dashboard for testing */}
            {user && user.role === 'owner' ? (
              <TouchableOpacity
                onPress={() => setShowOwnerDashboard((s) => !s)}
                style={{ marginRight: 12 }}
                accessibilityLabel="Open owner dashboard"
              >
                <Ionicons
                  name="settings"
                  size={22}
                  color={showOwnerDashboard ? '#6C5CE7' : '#111'}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onLogout}>
              <Ionicons name="log-out-outline" size={22} color="#111" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.container, !isMobile ? styles.row : {}]}>
        {/* If owner requested the Owner dashboard (or the tab state is 'tenants'), render it inline */}
        {(showOwnerDashboard || (tab as any) === 'tenants') && user && user.role === 'owner' ? (
          <View style={{ flex: 1 }}>
            <OwnerScreen
              user={user}
              onLogout={onLogout}
              openAddRequested={ownerOpenRequest}
              onOpenHandled={() => setOwnerOpenRequest(false)}
            />
          </View>
        ) : (
          <>
            {/* Sidebar for tablet/desktop to match Owner/Admin style */}
            {!isMobile && (
              <View style={styles.sidebar}>
                <View style={styles.logoRow}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>T</Text>
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.ownerName}>{user?.name || 'Tenant'}</Text>
                    <Text style={styles.ownerMeta}>{user?.phone || ''}</Text>
                  </View>
                </View>
                <View style={styles.menu}>
                  {
                    // map each menu key to an Ionicons name for visual parity with Owner/Admin
                    (() => {
                      const items: Array<{ key: string; label: string; icon: any }> = [
                        { key: 'home', label: 'Home', icon: 'speedometer' },
                        { key: 'profile', label: 'My Profile', icon: 'person' },
                        { key: 'documents', label: 'My Documents', icon: 'folder' },
                        { key: 'rent', label: 'Rent Details', icon: 'card' },
                        { key: 'maintenance', label: 'Maintenance', icon: 'construct' },
                        { key: 'complaints', label: 'Complaints', icon: 'alert-circle' },
                        { key: 'notices', label: 'Notices', icon: 'notifications' },
                        { key: 'agreement', label: 'Agreement Info', icon: 'document-text' },
                        { key: 'support', label: 'Support', icon: 'chatbubbles' },
                      ];
                      return items.map((it) => (
                        <TouchableOpacity
                          key={it.key}
                          style={[
                            styles.sidebarMenuItem,
                            tab === it.key && styles.sidebarMenuActive,
                          ]}
                          onPress={() => setTab(it.key as any)}
                        >
                          <Ionicons name={it.icon as any} size={18} color="#fff" />
                          <Text style={[styles.sidebarMenuText, { marginLeft: 10 }]}>
                            {it.label}
                          </Text>
                        </TouchableOpacity>
                      ));
                    })()
                  }
                </View>
                <View style={styles.sidebarFooter}>
                  <TouchableOpacity
                    onPress={onLogout}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name="log-out" size={18} color="#fff" />
                    <Text style={[styles.menuText, { marginLeft: 8 }]}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.mainArea}>
              {/* Sidebar-like menu on wide screens, top tabs on mobile */}
              <View style={[styles.menuBar, isMobile ? styles.menuBarMobile : {}]}>
                <ScrollView
                  horizontal={isMobile}
                  contentContainerStyle={{ alignItems: 'center' }}
                  showsHorizontalScrollIndicator={false}
                >
                  {[
                    ['home', 'Home'],
                    ['profile', 'My Profile'],
                    ['documents', 'My Documents'],
                    ['rent', 'Rent Details'],
                    ['maintenance', 'Maintenance Requests'],
                    ['complaints', 'Complaints'],
                    ['notices', 'Notice Board'],
                    ['agreement', 'Agreement Info'],
                    ['support', 'Support'],
                  ].map(([key, label]) => (
                    <TouchableOpacity
                      key={String(key)}
                      style={[styles.menuItem, tab === key && styles.menuItemActive]}
                      onPress={() => setTab(key as any)}
                    >
                      <Text style={[styles.menuItemText, tab === key && styles.menuItemTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Permanent Add Tenant banner removed per request */}

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                {tab === 'home' && (
                  <>
                    <View style={styles.statsRow}>
                      <StatCard
                        title="Monthly Rent"
                        value={`₹ ${agreements[0]?.rent ?? sampleAgreement.rent}`}
                        icon="card"
                      />
                      <StatCard
                        title="Maintenance"
                        value={`${maintenance.filter((m: any) => m.status === 'open').length} open`}
                        icon="tools"
                      />
                      <StatCard
                        title="Agreement"
                        value={agreements[0] ? 'Active' : 'Not linked'}
                        icon="document-text"
                      />
                      <StatCard title="Notices" value={`${noticesCount}`} icon="notifications" />
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => setShowMaintenanceModal(true)}
                        >
                          <Ionicons name="construct" size={18} />
                          <Text style={styles.actionText}>Request Maintenance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => setShowComplaintModal(true)}
                        >
                          <Ionicons name="alert-circle" size={18} />
                          <Text style={styles.actionText}>Raise Complaint</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => setShowSupportModal(true)}
                        >
                          <Ionicons name="chatbubbles" size={18} />
                          <Text style={styles.actionText}>Contact Owner</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {tab === 'profile' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Profile</Text>
                    <ProfileCard
                      name={profile?.name}
                      phone={profile?.phone}
                      email={profile?.email}
                      address={profile?.address}
                      imageUri={profile?.avatar}
                      onEdit={async () => {
                        try {
                          const url = await pickAndUploadProfile();
                          await api.put('/api/user', { avatar: url });
                          setProfile((p: any) => ({ ...(p || {}), avatar: url }));
                          alert('Profile photo updated');
                        } catch (e) {
                          console.warn('upload profile failed', e);
                          alert('Upload failed');
                        }
                      }}
                      onCall={(p) => {
                        try {
                          Linking.openURL(`tel:${p}`);
                        } catch (e) {}
                      }}
                    />
                    <TextInput
                      style={styles.input}
                      value={profile.name}
                      onChangeText={(t) => setProfile((p: any) => ({ ...p, name: t }))}
                      placeholder="Name"
                    />
                    <TextInput
                      style={styles.input}
                      value={profile.phone}
                      onChangeText={(t) => setProfile((p: any) => ({ ...p, phone: t }))}
                      placeholder="Phone"
                      keyboardType="phone-pad"
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Button title="Save" onPress={saveProfile} />
                    </View>
                  </View>
                )}

                {tab === 'documents' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Documents</Text>
                    {documents.map((d) => (
                      <View key={d.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{d.title}</Text>
                        <TouchableOpacity
                          onPress={() => alert('Open: ' + (d.file_url || 'placeholder'))}
                        >
                          <Text style={styles.link}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {tab === 'rent' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rent Details</Text>
                    <View style={styles.card}>
                      <Text>Monthly Rent: ₹{agreements[0]?.rent ?? sampleAgreement.rent}</Text>
                      <Text>Deposit: ₹{agreements[0]?.deposit ?? sampleAgreement.deposit}</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Payment History</Text>
                    {rentHistory.map((r) => (
                      <View key={r.id} style={styles.rowBetween}>
                        <Text>
                          {r.date} • ₹{r.amount}
                        </Text>
                        <Text style={{ color: r.status === 'paid' ? '#10b981' : '#ef4444' }}>
                          {r.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {tab === 'maintenance' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Maintenance Requests</Text>
                    <View style={{ marginBottom: 8 }}>
                      <Button title="New Request" onPress={() => setShowMaintenanceModal(true)} />
                    </View>
                    {maintenance.length === 0 ? (
                      <Text style={styles.muted}>No maintenance requests yet.</Text>
                    ) : (
                      maintenance.map((m: any) => (
                        <View key={m.id} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{m.title}</Text>
                            <Text style={styles.listSub}>{m.description}</Text>
                          </View>
                          <Text style={{ color: m.status === 'open' ? '#ff6b6b' : '#10b981' }}>
                            {m.status}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {tab === 'complaints' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Complaints</Text>
                    <View style={{ marginBottom: 8 }}>
                      <Button title="Raise Complaint" onPress={() => setShowComplaintModal(true)} />
                    </View>
                    {complaints.length === 0 ? (
                      <Text style={styles.muted}>No complaints yet.</Text>
                    ) : (
                      complaints.map((c: any) => (
                        <View key={c.id} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{c.title}</Text>
                            <Text style={styles.listSub}>{c.description}</Text>
                          </View>
                          <Text style={{ color: c.status === 'open' ? '#ff6b6b' : '#10b981' }}>
                            {c.status}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {tab === 'notices' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notice Board</Text>
                    <Button title="Refresh" onPress={fetchNotices} />
                    {notices.map((n) => (
                      <View key={n.id} style={styles.listItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listTitle}>{n.title}</Text>
                          <Text style={styles.listSub}>{n.description}</Text>
                        </View>
                        <Text style={styles.smallMuted}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {tab === 'agreement' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Agreement Info</Text>
                    {agreements.map((a) => (
                      <View key={a.id} style={styles.card}>
                        <Text>Start: {a.start_date}</Text>
                        <Text>End: {a.end_date}</Text>
                        <Text>Deposit: ₹{a.deposit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {tab === 'support' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support / Contact Owner</Text>
                    <Text style={styles.muted}>
                      Send a message to your owner/manager. You can optionally attach an image.
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Message"
                      value={supportForm.message}
                      onChangeText={(t) => setSupportForm((s) => ({ ...s, message: t }))}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Button title="Send" onPress={submitSupport} />
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Notices modal */}
            <Modal visible={showNoticeModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Notices</Text>
                  <FlatList
                    data={notices}
                    keyExtractor={(n: any) => n.id}
                    renderItem={({ item }) => (
                      <View style={{ paddingVertical: 8 }}>
                        <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                        <Text style={{ color: '#666' }}>{item.description}</Text>
                      </View>
                    )}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <Button title="Close" onPress={() => setShowNoticeModal(false)} />
                  </View>
                </View>
              </View>
            </Modal>

            {/* MOBILE: Sidebar drawer as modal */}
            <Modal visible={showSidebar} animationType="slide" transparent>
              <TouchableOpacity
                style={styles.mobileDrawerBackdrop}
                onPress={() => setShowSidebar(false)}
                activeOpacity={1}
              >
                <View style={styles.mobileDrawer}>
                  <View style={styles.sidebarHeader}>
                    <Text style={styles.sidebarTitle}>Tenant</Text>
                    <Text style={styles.sidebarSub}>{user?.name || 'Tenant'}</Text>
                  </View>
                  <ScrollView>
                    <TouchableOpacity
                      style={[styles.mobileDrawerItem, tab === 'home' && styles.sidebarMenuActive]}
                      onPress={() => {
                        setTab('home');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="speedometer" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'profile' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('profile');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="person" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'documents' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('documents');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="folder" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Documents</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mobileDrawerItem, tab === 'rent' && styles.sidebarMenuActive]}
                      onPress={() => {
                        setTab('rent');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="card" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Rent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'maintenance' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('maintenance');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="construct" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Maintenance</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'complaints' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('complaints');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="alert-circle" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Complaints</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'notices' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('notices');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="notifications" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Notices</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'agreement' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('agreement');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="document-text" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Agreement</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.mobileDrawerItem,
                        tab === 'support' && styles.sidebarMenuActive,
                      ]}
                      onPress={() => {
                        setTab('support');
                        setShowSidebar(false);
                      }}
                    >
                      <Ionicons name="chatbubbles" size={18} color="#fff" />
                      <Text style={styles.mobileDrawerText}>Support</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <View style={styles.sidebarFooter}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowSidebar(false);
                        onLogout();
                      }}
                      style={styles.logoutRow}
                    >
                      <Ionicons name="log-out" size={18} color="#ffdbdb" />
                      <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Maintenance modal */}
            <Modal visible={showMaintenanceModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>New Maintenance Request</Text>
                  <TextInput
                    placeholder="Title"
                    style={styles.input}
                    value={maintenanceForm.title}
                    onChangeText={(t) => setMaintenanceForm((s) => ({ ...s, title: t }))}
                  />
                  <TextInput
                    placeholder="Description"
                    style={[styles.input, { height: 100 }]}
                    value={maintenanceForm.description}
                    onChangeText={(t) => setMaintenanceForm((s) => ({ ...s, description: t }))}
                    multiline
                  />
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}
                  >
                    <Button
                      title="Attach Image"
                      onPress={() =>
                        pickFile((uri) => setMaintenanceForm((s) => ({ ...s, image: uri })))
                      }
                    />
                    <Button title="Submit" onPress={submitMaintenance} />
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Button title="Cancel" onPress={() => setShowMaintenanceModal(false)} />
                  </View>
                </View>
              </View>
            </Modal>

            {/* Complaint modal */}
            <Modal visible={showComplaintModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Raise Complaint</Text>
                  <TextInput
                    placeholder="Title"
                    style={styles.input}
                    value={complaintForm.title}
                    onChangeText={(t) => setComplaintForm((s) => ({ ...s, title: t }))}
                  />
                  <TextInput
                    placeholder="Description"
                    style={[styles.input, { height: 120 }]}
                    value={complaintForm.description}
                    onChangeText={(t) => setComplaintForm((s) => ({ ...s, description: t }))}
                    multiline
                  />
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}
                  >
                    <Button
                      title="Attach Image"
                      onPress={() =>
                        pickFile((uri) => setComplaintForm((s) => ({ ...s, image: uri })))
                      }
                    />
                    <Button title="Submit" onPress={submitComplaint} />
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Button title="Cancel" onPress={() => setShowComplaintModal(false)} />
                  </View>
                </View>
              </View>
            </Modal>

            {/* Support modal */}
            <Modal visible={showSupportModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Contact Owner</Text>
                  <TextInput
                    placeholder="Message"
                    style={[styles.input, { height: 120 }]}
                    value={supportForm.message}
                    onChangeText={(t) => setSupportForm((s) => ({ ...s, message: t }))}
                    multiline
                  />
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}
                  >
                    <Button
                      title="Attach Image"
                      onPress={() =>
                        pickFile((uri) => setSupportForm((s) => ({ ...s, image: uri })))
                      }
                    />
                    <Button title="Send" onPress={submitSupport} />
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Button title="Cancel" onPress={() => setShowSupportModal(false)} />
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </View>

      {/* Bottom tab (mobile) - intercept 'tenants' key so owner users open Owner dashboard
          Previously the shared BottomTab could emit a 'tenants' key which TenantScreen did not handle
          (resulting in a blank main area). Here we route 'tenants' -> OwnerScreen for owner-role users. */}
      {!isMobile ? null : (
        <BottomTab
          activeKey={showOwnerDashboard ? 'tenants' : tab}
          onChange={(k: any) => {
            try {
              if (k === 'tenants') {
                if (user && user.role === 'owner') {
                  // show Owner dashboard inline so Add Tenant UI is visible
                  setShowOwnerDashboard(true);
                  return;
                }
                // not an owner: show a friendly message
                alert('Only owners can access My Tenants from this app');
                return;
              }
              // any other tab: hide owner dashboard and change tenant tab state
              setShowOwnerDashboard(false);
              setTab(k);
            } catch (e) {
              console.warn('BottomTab onChange handler failed', e);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const palette = {
  primary: '#2b6cb0',
  muted: '#f2f6fb',
  card: '#ffffff',
  danger: '#ff6b6b',
  subtle: '#6b7280',
  accent: '#6C5CE7',
  bg: '#f7fafc',
};

const styles: any = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  appTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  container: { flex: 1, backgroundColor: palette.bg },
  row: { flexDirection: 'row' },
  sidebar: { width: 260, padding: 16, backgroundColor: '#2d3436', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerName: { color: '#fff', fontWeight: '700' },
  ownerMeta: { color: '#ddd', fontSize: 12 },
  menu: { marginTop: 18 },
  sidebarMenuItem: { paddingVertical: 12 },
  sidebarMenuActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  sidebarMenuText: { color: '#fff', marginLeft: 8 },
  sidebarFooter: { paddingVertical: 12 },
  mainArea: { flex: 1, padding: 16 },
  menuBar: { backgroundColor: 'transparent', paddingVertical: 8, borderBottomWidth: 0 },
  menuBarMobile: { paddingHorizontal: 8 },
  menuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  menuItemActive: { backgroundColor: palette.primary },
  menuItemText: { color: '#374151', fontWeight: '700' },
  menuItemTextActive: { color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: palette.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statTitle: { fontWeight: '700' },
  statValue: { fontWeight: '800', fontSize: 18, marginTop: 6 },
  section: { marginTop: 12, backgroundColor: 'transparent' },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: palette.primary,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  actionText: { marginLeft: 8, fontWeight: '700', color: '#fff' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, elevation: 2 },
  listItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTitle: { fontWeight: '700' },
  listSub: { color: '#6b7280', marginTop: 4 },
  smallMuted: { color: '#6b7280' },
  muted: { color: '#6b7280', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e6eef8',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '94%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  badge: {
    position: 'absolute',
    right: -6,
    top: -6,
    backgroundColor: '#ff4757',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  link: { color: palette.primary, fontWeight: '700' },
  // mobile drawer styles
  mobileDrawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  mobileDrawer: { width: '78%', height: '100%', backgroundColor: palette.primary, paddingTop: 36 },
  mobileDrawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mobileDrawerText: { color: '#fff', marginLeft: 12, fontWeight: '600' },
  logoutText: { color: '#ffdbdb', marginLeft: 8 },
  permAddBanner: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  permAddText: { fontWeight: '800', fontSize: 16 },
  permAddBtn: {
    backgroundColor: '#1abc9c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
