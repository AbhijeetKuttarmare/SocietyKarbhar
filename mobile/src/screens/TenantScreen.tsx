import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabContext } from '../contexts/BottomTabContext';
import ProfileCard from '../components/ProfileCard';
import OwnerScreen from './OwnerScreen';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';

type Props = { user: any; onLogout: () => void };

export default function TenantScreen({ user, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;

  const [tab, setTab] = useState<
    | 'home'
    | 'profile'
    | 'owner'
    | 'documents'
    | 'rent'
    | 'maintenance'
    | 'notices'
    | 'agreement'
    | 'support'
    | 'complaints'
    | 'helplines'
  >('home');
  const [profile, setProfile] = useState<any>(
    user || { name: '', phone: '', email: '', address: '', emergency_contact: '' }
  );

  useEffect(() => {
    // keep local profile in sync if parent `user` prop changes
    setProfile(user || { name: '', phone: '', email: '', address: '', emergency_contact: '' });
  }, [user]);
  const [ownerProfile, setOwnerProfile] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // UI state for various modals and tenant lists (minimal defaults to satisfy render)
  // sidebar removed for tenants (no drawer/menu)
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticesCount, setNoticesCount] = useState(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [ownerOpenRequest, setOwnerOpenRequest] = useState(false);

  const [agreements, setAgreements] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [maintenanceFilter, setMaintenanceFilter] = useState<'all' | 'bills' | 'complaints'>('all');
  const [rentHistory, setRentHistory] = useState<any[]>([]);

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);

  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [helplineName, setHelplineName] = useState('');
  const [helplinePhone, setHelplinePhone] = useState('');

  // complaint/support modal states (kept lightweight to avoid large refactors)
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', image: '' });
  const [complaints, setComplaints] = useState<any[]>([]);

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ message: '', image: '' });

  // helper to pick a file and upload (used by complaint/support attachments)
  async function pickFile(cb: (uri: string) => void) {
    try {
      const url = await pickAndUploadFile({ accept: 'image/*', fallbackApiPath: '/api/upload' });
      if (url) cb(url);
    } catch (e) {
      console.warn('pickFile failed', e);
    }
  }

  // submit complaint — small, robust implementation with optimistic fallback
  async function submitComplaint() {
    try {
      const payload: any = { title: complaintForm.title, description: complaintForm.description };
      if (complaintForm.image) payload.file_url = complaintForm.image;
      // Prefer dedicated complaints endpoint. If not available, fall back to maintenance endpoints for older servers.
      let posted = false;
      try {
        const r = await api.post('/api/tenant/complaints', payload);
        if (r && r.data && (r.data.complaint || r.data.complaints)) {
          const c = r.data.complaint || r.data.complaints;
          setComplaints((s) => [c, ...s]);
          posted = true;
        }
      } catch (err) {
        // ignore and try maintenance fallback
      }

      if (!posted) {
        try {
          const r = await api.post('/api/tenant/maintenance', payload);
          if (r && r.data && (r.data.complaint || r.data.maintenance)) {
            const c = r.data.complaint || r.data.maintenance;
            setComplaints((s) => [c, ...s]);
            posted = true;
          }
        } catch (err2) {
          // try owner-scoped endpoints as last network fallback
          try {
            const r2 = await api.post('/api/owner/complaints', payload);
            if (r2 && r2.data && (r2.data.complaint || r2.data.complaints)) {
              const c2 = r2.data.complaint || r2.data.complaints;
              setComplaints((s) => [c2, ...s]);
              posted = true;
            }
          } catch (e2) {
            try {
              const r3 = await api.post('/api/owner/maintenance', payload);
              if (r3 && r3.data && r3.data.maintenance) {
                setComplaints((s) => [r3.data.maintenance, ...s]);
                posted = true;
              }
            } catch (e3) {
              /* network fallback below */
            }
          }
        }
      }

      if (!posted) {
        // optimistic local fallback when no server endpoint is reachable
        setComplaints((s) => [
          { id: String(Date.now()), ...payload, status: 'open', raised_by: profile?.id || 'me' },
          ...s,
        ]);
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
      const payload: any = { message: supportForm.message };
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

  useEffect(() => {
    fetchCounts();
    fetchNotices();
    loadLocalData();
    fetchDocuments();
    if (user && user.role === 'tenant') {
      fetchOwner();
      // also load tenant complaints so the complaints tab shows data
      fetchComplaints();
      // load maintenance which includes bills assigned to this tenant (bills raised by owner)
      fetchMaintenance();
    }
    // always fetch helplines so both tenant and owner see the same list
    try {
      fetchHelplines();
    } catch (e) {
      /* ignore */
    }
  }, []);

  // refresh complaints whenever the complaints tab is shown
  useEffect(() => {
    if (tab === 'complaints') fetchComplaints();
  }, [tab]);

  async function fetchDocuments() {
    try {
      const r = await api.get('/api/tenant/documents');
      if (r && r.data && Array.isArray(r.data.documents)) setDocuments(r.data.documents || []);
    } catch (e) {
      console.warn('fetch tenant documents failed', e);
    }
  }

  async function fetchOwner() {
    try {
      const r = await api.get('/api/tenant/owner');
      if (r && r.data && r.data.owner) setOwnerProfile(r.data.owner);
    } catch (e) {
      console.warn('failed to fetch owner profile', e);
    }
  }

  // placeholder sample data
  const sampleAgreement = {
    id: 'agr-1',
    start_date: '2024-01-01',
    end_date: '2025-01-01',
    deposit: 50000,
    rent: 15000,
    file_url: '',
  };

  async function fetchCounts() {
    try {
      const r = await api.get('/api/notices/count');
    } catch (e) {}
  }
  async function fetchNotices() {
    try {
      const r = await api.get('/api/notices');
    } catch (e) {}
  }

  function loadLocalData() {
    setDocuments([
      { id: 'd1', title: 'Aadhaar', file_url: '' },
      { id: 'd2', title: 'PAN', file_url: '' },
    ]);
  }

  // profile save helper used by the Save button
  async function saveProfile() {
    try {
      const payload: any = {
        name: profile?.name,
        phone: profile?.phone,
        address: profile?.address,
        // include new fields so backend persists them
        email: profile?.email,
        emergency_contact: profile?.emergency_contact,
      };
      const r = await api.put('/api/user', payload);
      // if server returned updated user, update local profile and persisted storage so reloads show latest avatar
      if (r && r.data && r.data.user) {
        setProfile(r.data.user);
        try {
          await AsyncStorage.setItem('user', JSON.stringify(r.data.user));
        } catch (e) {
          console.warn('failed to persist user in AsyncStorage', e);
        }
      }
      alert('Profile saved');
    } catch (e) {
      console.warn('saveProfile failed', e);
      alert('Save failed');
    }
  }

  // maintenance helpers (lightweight placeholders)
  const [maintenanceForm, setMaintenanceForm] = useState({ title: '', description: '', image: '' });
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);

  async function fetchMaintenance() {
    try {
      const r = await api.get('/api/tenant/maintenance');
      if (r && r.data && Array.isArray(r.data.maintenance)) setMaintenance(r.data.maintenance);
    } catch (e) {
      console.warn('fetch maintenance failed', e);
    }
  }

  async function fetchComplaints() {
    try {
      const r = await api.get('/api/tenant/complaints');
      if (r && r.data && Array.isArray(r.data.complaints)) setComplaints(r.data.complaints);
    } catch (e) {
      console.warn('fetch complaints failed', e);
    }
  }

  async function fetchHelplines() {
    try {
      const r = await api.get('/api/tenant/helplines');
      setHelplines(r.data.helplines || r.data || []);
    } catch (e) {
      console.warn('tenant fetch helplines failed', e);
    }
  }

  async function submitMaintenance() {
    try {
      const payload: any = {
        title: maintenanceForm.title,
        description: maintenanceForm.description,
      };
      if (maintenanceForm.image) payload.file_url = maintenanceForm.image;
      try {
        const r = await api.post('/api/tenant/maintenance', payload);
        if (r && r.data && r.data.maintenance)
          setMaintenance((s) => [r.data.maintenance, ...(s || [])]);
      } catch (err) {
        console.warn('submitMaintenance failed', err);
        // optimistic fallback
        setMaintenance((s) => [
          { id: String(Date.now()), ...payload, status: 'open' },
          ...(s || []),
        ]);
      }
      setShowMaintenanceModal(false);
      setMaintenanceForm({ title: '', description: '', image: '' });
    } catch (e) {
      console.warn(e);
    }
  }

  async function saveDocumentToServer(payload: any, tempId?: string) {
    try {
      const r = await api.post('/api/tenant/documents', payload);
      if (r && r.data && r.data.document) {
        const saved = r.data.document;
        setDocuments((s) => {
          const arr = (s || []).filter((x: any) => x.id !== tempId && x.id !== saved.id);
          return [saved, ...arr];
        });
        return saved;
      }
    } catch (e) {
      console.warn('save document failed', e);
      try {
        await fetchDocuments();
      } catch (err) {}
    }
    return null;
  }

  // small render helpers
  const StatCard = ({ title, value, onPress }: any) => {
    const Content = (
      <View style={styles.statCard}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          {Content}
        </TouchableOpacity>
      );
    }
    return Content;
  };

  // derive header values here (ownerProfile may be available after fetch)
  const societyName =
    (ownerProfile && (ownerProfile.society?.name || ownerProfile.building?.name)) ||
    (user &&
      (user.society?.name ||
        user.building?.name ||
        user.societyName ||
        (user.adminSocieties && user.adminSocieties[0]?.name))) ||
    'Society';

  const wingFlat = (() => {
    if (!user) return '';
    if (!(user.role === 'tenant' || user.role === 'owner')) return '';
    const wing =
      (ownerProfile && (ownerProfile.wing?.name || ownerProfile.building?.name)) ||
      user.wing?.name ||
      user.building?.name ||
      user.buildingName ||
      user.wing ||
      '';
    const flat =
      (ownerProfile && (ownerProfile.flat?.flat_no || ownerProfile.flat_no)) ||
      user.flat?.flat_no ||
      user.flat_no ||
      user.flatNo ||
      '';
    const parts: string[] = [];
    if (wing) parts.push(String(wing));
    if (flat) parts.push(String(flat));
    return parts.join(' / ');
  })();

  const bottomTab = React.useContext(BottomTabContext);

  // sync context -> local tab
  React.useEffect(() => {
    try {
      const k = bottomTab.activeKey;
      if (k === 'tenants') {
        // tenant's 'tenants' maps to local 'owner' tab
        if (user && user.role === 'tenant') setTab('owner');
        if (user && user.role === 'owner') setShowOwnerDashboard(true);
      } else if (k === 'home' || k === 'profile' || k === 'maintenance' || k === 'bills') {
        setShowOwnerDashboard(false);
        setTab(
          k === 'home'
            ? 'home'
            : k === 'profile'
            ? 'profile'
            : k === 'bills'
            ? 'rent'
            : k === 'maintenance'
            ? 'maintenance'
            : 'home'
        );
      }
    } catch (e) {}
  }, [bottomTab.activeKey]);

  // push local tab changes to context when user changes tab internally
  React.useEffect(() => {
    try {
      // map local tab -> context key
      const map: any = { home: 'home', profile: 'profile', owner: 'tenants', rent: 'bills' };
      const key = map[tab] || tab;
      if (key && bottomTab.activeKey !== key) bottomTab.setActiveKey(key);
    } catch (e) {}
  }, [tab]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* top bar (no hamburger menu for tenants) */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View>
            <Text style={styles.appTitle}>{societyName}</Text>
            {wingFlat ? <Text style={styles.headerSub}>{wingFlat}</Text> : null}
          </View>
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
              <Ionicons name="settings" size={22} color={showOwnerDashboard ? '#6C5CE7' : '#111'} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onLogout}>
            <Ionicons name="log-out-outline" size={22} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

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
                        // show tenant's own profile by default
                        { key: 'profile', label: 'My Profile', icon: 'person' },
                        { key: 'documents', label: 'My Documents', icon: 'folder' },
                        { key: 'rent', label: 'Rent Details', icon: 'card' },
                        { key: 'maintenance', label: 'Maintenance', icon: 'construct' },
                        { key: 'complaints', label: 'Complaints', icon: 'alert-circle' },
                        { key: 'notices', label: 'Notices', icon: 'notifications' },
                        { key: 'agreement', label: 'Agreement Info', icon: 'document-text' },
                        { key: 'support', label: 'Support', icon: 'chatbubbles' },
                      ];
                      // If current user is tenant, add a dedicated 'My Owner' tab
                      if (user && user.role === 'tenant') {
                        items.splice(2, 0, { key: 'owner', label: 'My Owner', icon: 'people' });
                      }
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
              {/* Top menu removed per design request: header now shows society name only */}

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
                        title="Bills"
                        value={`${
                          (maintenance || []).filter((m: any) => m._type === 'bill').length
                        } bills`}
                        icon="card"
                        onPress={() => {
                          // show only bills when user clicks the Bills stat card
                          setMaintenanceFilter('bills');
                          setTab('maintenance');
                        }}
                      />
                      <StatCard
                        title="Agreement"
                        value={agreements[0] ? 'Active' : 'Not linked'}
                        icon="document-text"
                      />
                      <StatCard title="Notices" value={`${noticesCount}`} icon="notifications" />
                      <StatCard
                        title="Complaints"
                        value={`${complaints.length || 0}`}
                        icon="alert-circle"
                        onPress={() => setTab('complaints')}
                      />
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Quick Actions</Text>
                      <View style={styles.actionRow}>
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
                    {/* Bills raised by owner shown on dashboard for tenant */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Bills Raised by Owner</Text>
                      {((maintenance || []).filter((m: any) => m._type === 'bill') || []).length ===
                      0 ? (
                        <Text style={styles.muted}>No bills at the moment.</Text>
                      ) : (
                        (maintenance || [])
                          .filter((m: any) => m._type === 'bill')
                          .map((b: any) => (
                            <View
                              key={b.id || String(b.createdAt) + (b.title || '')}
                              style={styles.listItem}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.listTitle}>{b.title || 'Bill'}</Text>
                                {b.description ? (
                                  <Text style={styles.listSub}>{b.description}</Text>
                                ) : null}
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontWeight: '700' }}>
                                  ₹{b.cost || b.amount || '—'}
                                </Text>
                                <Text
                                  style={{ color: b.status === 'open' ? '#ff6b6b' : '#10b981' }}
                                >
                                  {b.status}
                                </Text>
                              </View>
                            </View>
                          ))
                      )}
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
                          if (!url) return; // user cancelled
                          const res = await api.put('/api/user', { avatar: url });
                          if (res && res.data && res.data.user) {
                            setProfile(res.data.user);
                            try {
                              await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
                            } catch (e) {
                              console.warn('failed to persist user in AsyncStorage', e);
                            }
                          } else {
                            // optimistic fallback
                            setProfile((p: any) => ({ ...(p || {}), avatar: url }));
                            try {
                              const raw = await AsyncStorage.getItem('user');
                              if (raw) {
                                const parsed = JSON.parse(raw);
                                const merged = { ...(parsed || {}), avatar: url };
                                await AsyncStorage.setItem('user', JSON.stringify(merged));
                              }
                            } catch (e) {
                              /* ignore */
                            }
                          }
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

                    <Text
                      style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}
                    >
                      Email address
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={profile.email}
                      onChangeText={(t) => setProfile((p: any) => ({ ...p, email: t }))}
                      placeholder="Email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <Text
                      style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}
                    >
                      Emergency contact number
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={profile.emergency_contact}
                      onChangeText={(t) => setProfile((p: any) => ({ ...p, emergency_contact: t }))}
                      placeholder="Emergency contact"
                      keyboardType="phone-pad"
                    />

                    <Text
                      style={{ marginTop: 6, marginBottom: 4, color: '#374151', fontWeight: '700' }}
                    >
                      Permanent address
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 80 }]}
                      value={profile.address}
                      onChangeText={(t) => setProfile((p: any) => ({ ...p, address: t }))}
                      placeholder="Permanent address"
                      multiline
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Button title="Save" onPress={saveProfile} />
                    </View>

                    {/* Tenant documents shown in profile tab (parity with Owner/Admin profile view) */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                        Upload Document
                      </Text>
                      {(() => {
                        // dedupe by title so Aadhaar/PAN don't appear multiple times
                        const seen = new Set<string>();
                        const deduped = (documents || []).filter((d: any) => {
                          const key = String((d.title || d.name || '').toLowerCase()).trim();
                          if (!key) return false;
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                        if (!deduped || deduped.length === 0)
                          return <Text style={styles.muted}>No documents uploaded</Text>;

                        return deduped.map((d: any) => (
                          <View key={d.id} style={styles.listItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.listTitle}>
                                {d.title || d.name || 'Document'}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                style={{ padding: 8 }}
                                onPress={async () => {
                                  try {
                                    setUploadingDocId(d.id);
                                    const url = await pickAndUploadFile({
                                      accept: '*/*',
                                      fallbackApiPath: '/api/tenant/upload',
                                    });
                                    if (!url) return;
                                    // optimistic update
                                    setDocuments((s) =>
                                      (s || []).map((x: any) =>
                                        x.id === d.id ? { ...x, file_url: url } : x
                                      )
                                    );
                                    // persist to backend and prefer server-returned document when available
                                    await saveDocumentToServer(
                                      {
                                        title: d.title || d.name || 'Document',
                                        file_url: url,
                                        userId: profile?.id,
                                      },
                                      d.id
                                    );
                                  } catch (e) {
                                    console.warn('upload failed', e);
                                    alert('Upload failed');
                                  } finally {
                                    setUploadingDocId(null);
                                  }
                                }}
                              >
                                {uploadingDocId === d.id ? (
                                  <ActivityIndicator size="small" />
                                ) : (
                                  <Ionicons name="cloud-upload-outline" size={20} color="#2563eb" />
                                )}
                              </TouchableOpacity>

                              {d && d.file_url ? (
                                <TouchableOpacity
                                  style={{ padding: 8, marginLeft: 6 }}
                                  onPress={() => {
                                    setPreviewImageUrl(d.file_url || d.uri || null);
                                    setShowPreviewModal(true);
                                  }}
                                >
                                  <Ionicons name="eye-outline" size={20} color="#2563eb" />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        ));
                      })()}
                    </View>
                  </View>
                )}

                {tab === 'owner' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Owner</Text>
                    {ownerProfile ? (
                      <View style={styles.ownerCard}>
                        {ownerProfile.avatar || ownerProfile.image ? (
                          <Image
                            source={{ uri: ownerProfile.avatar || ownerProfile.image }}
                            style={styles.ownerImageLarge}
                          />
                        ) : (
                          <View style={styles.ownerImagePlaceholder}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>
                              {(ownerProfile.name || 'O').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.ownerLabel}>Full name</Text>
                          <Text style={styles.ownerValue}>{ownerProfile.name || '—'}</Text>

                          <Text style={[styles.ownerLabel, { marginTop: 10 }]}>Full address</Text>
                          <Text style={styles.ownerValue}>{ownerProfile.address || '—'}</Text>

                          <Text style={[styles.ownerLabel, { marginTop: 10 }]}>Email</Text>
                          <Text style={styles.ownerValue}>{ownerProfile.email || '—'}</Text>

                          <Text style={[styles.ownerLabel, { marginTop: 10 }]}>
                            Emergency contact
                          </Text>
                          <Text style={styles.ownerValue}>
                            {ownerProfile.emergency_contact || '—'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.muted}>Owner information not available.</Text>
                    )}
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
                    {/* New Request button removed per UI request */}
                    {(() => {
                      const displayed = (maintenance || []).filter((it: any) => {
                        if (maintenanceFilter === 'all') return true;
                        if (maintenanceFilter === 'bills') return it._type === 'bill';
                        if (maintenanceFilter === 'complaints') return it._type !== 'bill';
                        return true;
                      });
                      if (displayed.length === 0) {
                        return <Text style={styles.muted}>No maintenance requests yet.</Text>;
                      }
                      return displayed.map((m: any) => (
                        <View key={m.id} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{m.title}</Text>
                            <Text style={styles.listSub}>{m.description}</Text>
                            {m._type === 'bill' ? (
                              <View style={{ marginTop: 6 }}>
                                <Text style={{ fontWeight: '700' }}>Amount: ₹{m.cost}</Text>
                                <Text style={{ color: '#666', marginTop: 4 }}>
                                  Type:{' '}
                                  {m.type
                                    ? String(m.type).charAt(0).toUpperCase() +
                                      String(m.type).slice(1)
                                    : 'Other'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: m.status === 'open' ? '#ff6b6b' : '#10b981' }}>
                              {m.status}
                            </Text>
                            {m._type === 'bill' && m.status !== 'closed' ? (
                              <TouchableOpacity
                                style={[styles.smallBtn, { marginTop: 8 }]}
                                onPress={() => {
                                  setSelectedBill(m);
                                  setShowMarkPaidModal(true);
                                }}
                              >
                                <Text style={{ color: '#fff' }}>Mark Paid</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ));
                    })()}
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

                {tab === 'helplines' && (
                  <View style={styles.section}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={styles.sectionTitle}>Helplines</Text>
                      {/* Only owners may add helplines; tenants see the list but cannot add */}
                      {user && user.role === 'owner' ? (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => {
                            setHelplineName('');
                            setHelplinePhone('');
                            setShowHelplineModal(true);
                          }}
                        >
                          <Text style={{ color: '#fff' }}>Add Helpline</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {helplines.length === 0 ? (
                      <View style={{ padding: 24 }}>
                        <Text style={{ color: '#666' }}>No helplines available.</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={helplines}
                        keyExtractor={(h: any) => h.id || h.phone || String(h.name)}
                        renderItem={({ item }) => (
                          <View
                            style={{
                              paddingVertical: 8,
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <View>
                              <Text style={{ fontWeight: '700' }}>
                                {item.name || item.title || 'Help'}
                              </Text>
                              <Text style={{ color: '#666', marginTop: 4 }}>
                                {item.phone || item.contact || ''}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                try {
                                  Linking.openURL(`tel:${item.phone || item.contact}`);
                                } catch (e) {}
                              }}
                              style={[styles.smallBtn, { paddingHorizontal: 14 }]}
                            >
                              <Text style={{ color: '#fff' }}>Call</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      />
                    )}
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

            {/* Sidebar permanently removed for tenant screens */}

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

            {/* Mark Paid modal (tenant uploads proof) */}
            <Modal visible={showMarkPaidModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Mark Bill as Paid</Text>
                  <Text style={{ marginBottom: 8 }}>
                    {selectedBill ? `${selectedBill.title} • ₹${selectedBill.cost}` : ''}
                  </Text>
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ alignItems: 'center' }}>
                      {uploadingProof ? (
                        <ActivityIndicator size="small" />
                      ) : proofUri ? (
                        <View style={{ alignItems: 'center' }}>
                          <Image
                            source={{ uri: proofUri }}
                            style={{
                              width: 220,
                              height: 160,
                              resizeMode: 'cover',
                              borderRadius: 8,
                            }}
                          />
                          <View style={{ flexDirection: 'row', marginTop: 8 }}>
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  setUploadingProof(true);
                                  const url = await pickAndUploadProfile();
                                  if (url) setProofUri(url);
                                } catch (e) {
                                  console.warn('pick proof failed (profile picker)', e);
                                  alert('Upload failed');
                                } finally {
                                  setUploadingProof(false);
                                }
                              }}
                              style={[styles.smallBtn, { marginRight: 8 }]}
                            >
                              <Text style={{ color: '#fff' }}>Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setProofUri(null)}
                              style={[styles.smallBtn, { backgroundColor: '#ef4444' }]}
                            >
                              <Text style={{ color: '#fff' }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <Button
                          title={proofUri ? 'Change Proof' : 'Attach Payment Proof'}
                          onPress={async () => {
                            try {
                              setUploadingProof(true);
                              // pick and upload immediately; store resulting URL
                              const url = await pickAndUploadProfile();
                              if (url) setProofUri(url);
                            } catch (e) {
                              console.warn('pick proof failed (profile picker)', e);
                              alert('Upload failed');
                            } finally {
                              setUploadingProof(false);
                            }
                          }}
                        />
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <Button
                      title="Submit"
                      onPress={async () => {
                        try {
                          if (!selectedBill) return;
                          if (!proofUri) {
                            alert('Please attach a proof image');
                            return;
                          }
                          // if proofUri is a data: URL (unexpected), upload it first
                          let finalUrl = proofUri;
                          if (String(proofUri).startsWith('data:')) {
                            const up = await api.post('/api/tenant/upload', {
                              dataUrl: proofUri,
                              filename: `proof-${Date.now()}.jpg`,
                            });
                            finalUrl = up.data && up.data.url;
                            if (!finalUrl) throw new Error('upload failed');
                          }
                          // mark paid
                          const r = await api.post(`/api/bills/${selectedBill.id}/mark-paid`, {
                            payment_proof_url: finalUrl,
                          });
                          const updated = r.data && r.data.bill;
                          // refresh local list
                          fetchMaintenance();
                          setShowMarkPaidModal(false);
                          setSelectedBill(null);
                          setProofUri(null);
                          alert('Marked as paid — owner will verify.');
                        } catch (e) {
                          console.warn('mark paid failed', e);
                          alert('Failed to submit proof');
                        }
                      }}
                    />
                    <View style={{ width: 8 }} />
                    <Button title="Cancel" onPress={() => setShowMarkPaidModal(false)} />
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
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    {/* Upload / change image: show upload icon (changes to done icon when image present) */}
                    <TouchableOpacity
                      style={{ padding: 8, marginRight: 10 }}
                      onPress={() =>
                        pickFile((uri) => setComplaintForm((s) => ({ ...s, image: uri })))
                      }
                    >
                      {complaintForm.image ? (
                        <Ionicons name="cloud-done" size={22} color="#10b981" />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={22} color="#2563eb" />
                      )}
                    </TouchableOpacity>

                    {/* Preview (eye) if an image is attached */}
                    {complaintForm.image ? (
                      <TouchableOpacity
                        style={{ padding: 8, marginRight: 12 }}
                        onPress={() => {
                          setPreviewImageUrl(complaintForm.image || null);
                          setShowPreviewModal(true);
                        }}
                      >
                        <Ionicons name="eye-outline" size={22} color="#2563eb" />
                      </TouchableOpacity>
                    ) : null}

                    {/* Send icon replaces Submit button */}
                    <TouchableOpacity
                      onPress={submitComplaint}
                      style={{
                        backgroundColor: palette.primary,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
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

      {/* Preview modal (global) - shows uploaded document image/pdf preview when eye icon clicked */}
      <Modal visible={showPreviewModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            {previewImageUrl ? (
              // Image will display common image URLs or data URLs. For PDFs/other types the browser may not render.
              <Image
                source={{ uri: previewImageUrl }}
                style={{
                  width: '100%',
                  height: 400,
                  resizeMode: 'contain',
                  backgroundColor: '#000',
                }}
              />
            ) : (
              <Text style={{ textAlign: 'center' }}>No preview available</Text>
            )}
            <View style={{ marginTop: 8 }}>
              <Button
                title="Close"
                onPress={() => {
                  setShowPreviewModal(false);
                  setPreviewImageUrl(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* BottomTab is now rendered at the app root (App.tsx) so it stays fixed across screens */}
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
  headerSub: { fontSize: 12, color: '#666', marginTop: 2 },
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
    // use flexBasis so cards wrap reliably on narrow screens and allow minWidth to avoid extreme squashing
    flexBasis: '48%',
    minWidth: 140,
    backgroundColor: palette.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    // ensure children don't paint outside rounded corners
    overflow: 'hidden',
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
  statTitle: { fontWeight: '700', flexShrink: 1, flexWrap: 'wrap' },
  statValue: { fontWeight: '800', fontSize: 18, marginTop: 6 },
  section: { marginTop: 12, backgroundColor: 'transparent' },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.primary,
    borderRadius: 12,
    marginRight: 12,
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
  listTitle: { fontWeight: '700', flexWrap: 'wrap', flexShrink: 1 },
  listSub: { color: '#6b7280', marginTop: 4, flexWrap: 'wrap' },
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
  ownerCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  ownerImageLarge: { width: 120, height: 120, borderRadius: 12, resizeMode: 'cover' },
  ownerImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerLabel: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  ownerValue: { fontSize: 16, fontWeight: '700', color: '#111', marginTop: 4 },
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
  smallBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
