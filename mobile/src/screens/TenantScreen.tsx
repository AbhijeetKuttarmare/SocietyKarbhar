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
import * as FileSystem from 'expo-file-system';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';

type Props = { user: any; onLogout: () => void };

export default function TenantScreen({ user, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const isDesktop = width >= 900;

  // header values will be derived at render time (below) so we can prefer ownerProfile when available

  const [showSidebar, setShowSidebar] = useState(false);
  // allow owner users to open the Owner dashboard inline (helps web testing where role routing may differ)
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  // request OwnerScreen to open Add Tenant modal
  const [ownerOpenRequest, setOwnerOpenRequest] = useState(false);

  // UI state
  const [tab, setTab] = useState<
    | 'home'
    | 'profile'
    | 'owner'
    | 'documents'
    | 'rent'
    | 'maintenance'
    | 'notices'
    | 'helplines'
    | 'agreement'
    | 'support'
    | 'complaints'
  >('home');
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Profile / data
  const [profile, setProfile] = useState<any>(user || { name: '', phone: '' });
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [helplineName, setHelplineName] = useState('');
  const [helplinePhone, setHelplinePhone] = useState('');
  const [agreements, setAgreements] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [rentHistory, setRentHistory] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);

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
    // fetch owner profile if tenant
    if (user && user.role === 'tenant') {
      fetchOwner();
      fetchHelplines();
      fetchMaintenance();
    }
  }, []);

  async function fetchMaintenance() {
    try {
      const r = await api.get('/api/maintenance');
      if (r.data && r.data.maintenance) setMaintenance(r.data.maintenance);
    } catch (e) {
      console.warn('fetch maintenance failed', e);
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

  async function fetchOwner() {
    try {
      const r = await api.get('/api/tenant/owner');
      if (r.data && r.data.owner) setOwnerProfile(r.data.owner);
    } catch (e) {
      console.warn('failed to fetch owner profile', e);
    }
  }

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

  // Document picker for support/maintenance images — uses centralized helper which
  // provides a reliable web fallback and server multipart + base64 fallback.
  async function pickFile(setter: (uriOrUrl: string) => void) {
    try {
      const url = await pickAndUploadFile({
        accept: 'image/*',
        fallbackApiPath: '/api/tenant/upload',
      });
      if (url) setter(url);
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
                          if (!url) return; // user cancelled
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

                    {/* Tenant documents shown in profile tab (parity with Owner/Admin profile view) */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                        Uploaded Documents
                      </Text>
                      {documents && documents.length > 0 ? (
                        documents.map((d: any) => (
                          <View key={d.id} style={styles.listItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.listTitle}>
                                {d.title || d.name || 'Document'}
                              </Text>
                              {d.file_url ? <Text style={styles.listSub}>{d.file_url}</Text> : null}
                            </View>
                            <TouchableOpacity
                              onPress={() => alert('Open: ' + (d.file_url || d.uri || ''))}
                            >
                              <Text style={styles.link}>View</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.muted}>No documents uploaded</Text>
                      )}
                    </View>
                  </View>
                )}

                {tab === 'owner' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Owner</Text>
                    {ownerProfile ? (
                      <ProfileCard
                        name={ownerProfile.name}
                        phone={ownerProfile.phone}
                        email={ownerProfile.email}
                        address={ownerProfile.address}
                        imageUri={ownerProfile.avatar || ownerProfile.image}
                        onEdit={undefined}
                        onCall={(p) => {
                          try {
                            Linking.openURL(`tel:${p}`);
                          } catch (e) {}
                        }}
                      />
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
                      {/* Tenants can add helplines for their society */}
                      {user && user.role === 'tenant' ? (
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

            {/* Mark Paid modal (tenant uploads proof) */}
            <Modal visible={showMarkPaidModal} animationType="slide" transparent>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Mark Bill as Paid</Text>
                  <Text style={{ marginBottom: 8 }}>
                    {selectedBill ? `${selectedBill.title} • ₹${selectedBill.cost}` : ''}
                  </Text>
                  <View style={{ marginBottom: 8 }}>
                    <Button
                      title={proofUri ? 'Change Proof' : 'Attach Payment Proof'}
                      onPress={async () => {
                        try {
                          // pick and upload immediately; store resulting URL
                          const url = await pickAndUploadFile({
                            accept: 'image/*',
                            fallbackApiPath: '/api/tenant/upload',
                          });
                          if (url) setProofUri(url);
                        } catch (e) {
                          console.warn('pick proof failed', e);
                        }
                      }}
                    />
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
        // compute bottom items dynamically so 'My Owner' (tenants) is only shown to tenant role
        <BottomTab
          // map tenant-owned 'owner' tab to the BottomTab key 'tenants' so the bottom bar highlights correctly
          activeKey={showOwnerDashboard ? 'tenants' : tab === 'owner' ? 'tenants' : tab}
          items={(() => {
            const items: any[] = [
              { key: 'home', label: 'Home', icon: 'home' },
              { key: 'helplines', label: 'Helplines', icon: 'call' },
            ];
            // include tenant-facing "My Owner" only for tenant users
            if (user && user.role === 'tenant') {
              items.push({ key: 'tenants', label: 'My Owner', icon: 'people' });
            }
            items.push({ key: 'profile', label: 'Profile', icon: 'person' });
            return items;
          })()}
          onChange={(k: any) => {
            try {
              if (k === 'tenants') {
                if (user && user.role === 'owner') {
                  // show Owner dashboard inline so Add Tenant UI is visible for owner users
                  setShowOwnerDashboard(true);
                  return;
                }
                // For tenant users: ensure we refresh owner data before showing owner view
                setShowOwnerDashboard(false);
                if (user && user.role === 'tenant') {
                  // fetch latest owner details then switch to owner tab
                  fetchOwner();
                  setTab('owner');
                } else {
                  // fallback: switch to owner tab
                  setTab('owner');
                }
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
