import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Switch,
  Button,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  StatusBar,
  useWindowDimensions,
  Image,
  Linking,
} from 'react-native';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import BottomTab from '../components/BottomTab';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, { pickAndUploadFile as sharedPickAndUploadFile } from '../services/uploadProfile';

// Responsive Admin Screen
// - Preserves all API calls / logic from your original file
// - Improves mobile responsiveness by switching to a top navbar + drawer-style sidebar
// - Uses useWindowDimensions for runtime layout decisions

type Props = { user: any; onLogout: () => void };

export default function AdminScreen({ user, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 700 && width < 900;
  const isMobile = width < 700;

  // derive society name for header
  const societyName =
    (user &&
      (user.society?.name ||
        user.building?.name ||
        user.societyName ||
        (user.adminSocieties && user.adminSocieties[0]?.name))) ||
    'Society';

  const [lastApiError, setLastApiError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const apiModule = require('../services/api');
      apiModule.attachErrorHandler((err: any) => {
        try {
          setLastApiError(JSON.stringify(err.response?.data || err.message || err));
        } catch (e) {
          setLastApiError(String(err));
        }
      });
    } catch (e) {}
  }, []);

  // --- original state kept ---
  const [summary, setSummary] = useState<any>(null);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'helplines' | 'users' | 'notices' | 'maintenance'>(
    'dashboard'
  );
  const [tab2, setTab2] = useState<'wings' | 'logs'>('wings');
  const [q, setQ] = useState('');
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [newHelpline, setNewHelpline] = useState({
    type: 'ambulance',
    name: '',
    phone: '',
    notes: '',
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddFlatModal, setShowAddFlatModal] = useState(false);
  const [newFlat, setNewFlat] = useState({ flat_no: '', buildingId: '' });
  const [showAddWingModal, setShowAddWingModal] = useState(false);
  const [newWing, setNewWing] = useState({ name: '', number_of_floors: '1', flats_per_floor: '1' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStep, setAssignStep] = useState(1);
  const [assignState, setAssignState] = useState({
    wingId: '',
    flatId: '',
    role: 'owner',
    name: '',
    phone: '',
    address: '',
    files: [] as any[],
  });
  const [newUser, setNewUser] = useState({
    name: '',
    phone: '',
    role: 'owner',
    flat_no: '',
    buildingId: '',
  });
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(
    (user as any)?.avatar || (user as any)?.image
  );
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedWingId, setSelectedWingId] = useState<string | null>(null);
  const [wingAnalytics, setWingAnalytics] = useState({ flats: 0, owners: 0, tenants: 0 });
  const [loadingWingAnalytics, setLoadingWingAnalytics] = useState(false);
  const animatedWingHeightsRef = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const [logs, setLogs] = useState<any[]>([]);
  // Maintenance admin state
  const [maintenanceGroups, setMaintenanceGroups] = useState<any[]>([]);
  const [maintenanceTotals, setMaintenanceTotals] = useState<any>(null);
  const [maintenanceSetting, setMaintenanceSettingState] = useState<any>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMonth, setMaintenanceMonth] = useState<string | null>(null);
  const [maintenanceEditAmount, setMaintenanceEditAmount] = useState<string>('');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [generateOwnersOnly, setGenerateOwnersOnly] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);

  // Image preview modal state (show images in-app instead of opening external window)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // UI state: which wing cards are expanded (show flats/users)
  const [expandedWings, setExpandedWings] = useState<Record<string, boolean>>({});

  // new: mobile sidebar drawer
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchHelplines();
    fetchUsers();
    fetchSocieties();
    fetchBuildings();
    fetchLogs();
  }, []);

  // When buildings load, default select the first wing
  useEffect(() => {
    if (!selectedWingId && buildings && buildings.length) {
      setSelectedWingId(buildings[0].id);
    }
  }, [buildings]);

  // Fetch analytics for selected wing
  useEffect(() => {
    if (!selectedWingId) return;
    (async () => {
      try {
        setLoadingWingAnalytics(true);
        // get flats for wing
        const r = await api.get('/api/admin/getFlatsByWing/' + selectedWingId);
        const flats = r.data.flats || [];
        const totalFlats = flats.length;
        const totalOwners = flats.filter((f: any) => f.ownerId).length;
        const flatIds = flats.map((f: any) => f.id).filter(Boolean);

        let totalTenants = 0;
        if (flatIds.length) {
          // call agreements endpoint with flatIds
          const q = flatIds.join(',');
          const agrRes = await api.get('/api/admin/agreements?flatIds=' + encodeURIComponent(q));
          const ags = agrRes.data.agreements || [];
          const tenantIds = Array.from(new Set(ags.map((a: any) => a.tenantId).filter(Boolean)));
          totalTenants = tenantIds.length;
        }

        setWingAnalytics({ flats: totalFlats, owners: totalOwners, tenants: totalTenants });
      } catch (e) {
        console.warn('fetch wing analytics failed', e);
        setWingAnalytics({ flats: 0, owners: 0, tenants: 0 });
      } finally {
        setLoadingWingAnalytics(false);
      }
    })();
  }, [selectedWingId]);
  // when switching to users tab, refresh the list
  useEffect(() => {
    if (tab === 'users') fetchUsers();
  }, [tab]);
  useEffect(() => {
    if (tab === 'maintenance') {
      fetchMaintenanceSettings();
      fetchMaintenanceFees(maintenanceMonth || undefined, 'all');
    }
  }, [tab]);
  useEffect(() => {
    fetchNoticesCount();
  }, []);

  useEffect(() => {
    if (tab === 'notices') {
      fetchNotices();
      fetchNoticesCount();
    }
  }, [tab]);

  async function fetchNotices() {
    try {
      const r = await api.get('/api/notices');
      setNotices(r.data.notices || []);
    } catch (e) {
      console.warn('fetch notices failed', e);
    }
  }

  async function fetchComplaints() {
    try {
      const r = await api.get('/api/admin/complaints');
      setComplaintsList(r.data.complaints || []);
    } catch (e) {
      console.warn('fetch admin complaints failed', e);
      setComplaintsList([]);
    }
  }

  // helper: find user and their wing/flat from the wings->flats->users structure
  function resolveUserLocation(userId: string) {
    for (const wing of users || []) {
      const flats = wing.flats || [];
      for (const f of flats) {
        const u = (f.users || []).find((x: any) => x.id === userId);
        if (u) return { user: u, flat: f, wing };
      }
    }
    return null;
  }

  async function fetchNoticesCount() {
    try {
      const r = await api.get('/api/notices/count');
      setNoticesCount(Number(r.data.count || 0));
    } catch (e) {
      /* ignore */
    }
  }

  // fetch flats for admin dashboard convenience
  const [flatsList, setFlatsList] = useState<any[]>([]);
  async function fetchFlats() {
    try {
      const r = await api.get('/api/admin/flats');
      setFlatsList(r.data.flats || []);
    } catch (e) {
      console.warn('fetch flats failed', e);
    }
  }
  useEffect(() => {
    fetchFlats();
  }, []);

  async function fetchSummary() {
    try {
      const res = await api.get('/api/admin/summary');
      setSummary(res.data);
    } catch (e) {
      console.warn(e);
    }
  }
  async function fetchHelplines() {
    try {
      const res = await api.get('/api/admin/helplines');
      setHelplines(res.data.helplines || []);
    } catch (e) {
      console.warn(e);
    }
  }
  async function fetchUsers() {
    try {
      const res = await api.get('/api/admin/users');
      setUsers(res.data.wings || []); // Now expecting wings array with nested flats and users
    } catch (e) {
      console.warn(e);
    }
  }
  async function fetchSocieties() {
    try {
      const r = await api.get('/api/admin/societies');
      setSocieties(r.data.societies || []);
    } catch (e) {
      console.warn(e);
    }
  }
  async function fetchBuildings() {
    try {
      const r = await api.get('/api/admin/buildings');
      setBuildings(r.data.buildings || []);
    } catch (e) {
      console.warn(e);
    }
  }
  async function fetchLogs() {
    try {
      const r = await api.get('/api/admin/logs');
      setLogs(r.data.logs || []);
    } catch (e) {
      console.warn(e);
    }
  }

  // Maintenance related API calls
  async function fetchMaintenanceSettings() {
    try {
      const r = await api.get('/api/admin/maintenance-settings');
      setMaintenanceSettingState(r.data.setting || null);
    } catch (e) {
      console.warn('fetch maintenance settings failed', e);
    }
  }

  // keep editable input in sync with fetched setting
  useEffect(() => {
    try {
      setMaintenanceEditAmount(
        maintenanceSetting && maintenanceSetting.amount ? String(maintenanceSetting.amount) : ''
      );
    } catch (e) {}
  }, [maintenanceSetting]);

  // when admin opens maintenance tab, load settings and fees
  useEffect(() => {
    if (tab === 'maintenance') {
      fetchMaintenanceSettings();
      fetchMaintenanceFees(maintenanceMonth || undefined, 'all');
    }
  }, [tab]);

  async function fetchMaintenanceFees(month?: string, status?: string) {
    try {
      setMaintenanceLoading(true);
      const q = [] as string[];
      if (month) q.push('month=' + encodeURIComponent(month));
      if (status) q.push('status=' + encodeURIComponent(status));
      const url = '/api/admin/maintenance-fees' + (q.length ? '?' + q.join('&') : '');
      const r = await api.get(url);
      setMaintenanceGroups(r.data.groups || []);
      setMaintenanceTotals(r.data.totals || null);
    } catch (e) {
      console.warn('fetch maintenance fees failed', e);
      setMaintenanceGroups([]);
      setMaintenanceTotals(null);
    } finally {
      setMaintenanceLoading(false);
    }
  }

  async function saveMaintenanceSetting(amount: number) {
    try {
      const r = await api.post('/api/admin/maintenance-settings', { amount });
      setMaintenanceSettingState(r.data.setting);
      alert('Maintenance amount saved');
    } catch (e) {
      console.warn('save maintenance setting failed', e);
      alert('Failed to save');
    }
  }

  async function generateMonthlyMaintenance(month?: string, amount?: number, ownersOnly?: boolean) {
    try {
      const payload: any = {};
      if (month) payload.month = month;
      if (amount !== undefined) payload.amount = amount;
      if (ownersOnly !== undefined) payload.ownersOnly = !!ownersOnly;
      const r = await api.post('/api/admin/generate-monthly-maintenance', payload);
      alert('Generated: ' + (r.data.created || 0) + ', skipped: ' + (r.data.skipped || 0));
      // refresh list
      fetchMaintenanceFees(month || maintenanceMonth || undefined, 'all');
    } catch (e) {
      console.warn('generate monthly failed', e);
      alert('Generate failed');
    }
  }

  async function adminVerifyBill(billId: string, action: 'approve' | 'reject') {
    try {
      const r = await api.post('/api/admin/bills/' + billId + '/verify', { action });
      alert('Updated bill status');
      // refresh
      fetchMaintenanceFees(maintenanceMonth || undefined, 'all');
    } catch (e) {
      console.warn('admin verify failed', e);
      alert('Failed to update');
    }
  }

  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [agrFlatId, setAgrFlatId] = useState('');
  const [agrTenantId, setAgrTenantId] = useState('');
  const [agrUrl, setAgrUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    description: '',
    image_url: '',
    buildingIds: [] as string[],
    targetAll: false,
  });

  const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dxdzlbvoj/image/upload';
  const CLOUDINARY_UPLOAD_PRESET = 'dev_preset';

  async function createHelpline() {
    try {
      await api.post('/api/admin/helplines', newHelpline);
      setShowHelplineModal(false);
      setNewHelpline({ type: 'ambulance', name: '', phone: '', notes: '' });
      fetchHelplines();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  async function deleteHelpline(id: string) {
    try {
      await api.delete('/api/admin/helplines/' + id);
      fetchHelplines();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  async function searchUsers() {
    try {
      const res = await api.get('/api/admin/search/users?q=' + encodeURIComponent(q));
      setUsers(res.data.users || []);
    } catch (e) {
      console.warn(e);
    }
  }
  async function createUser() {
    try {
      await api.post('/api/admin/users', newUser);
      setShowUserModal(false);
      setNewUser({ name: '', phone: '', role: 'owner', flat_no: '', buildingId: '' });
      fetchUsers();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  async function openUserDetail(u: any) {
    setDetailUser(null);
    setShowUserDetail(true);
    try {
      const r = await api.get('/api/admin/users/' + u.id + '/documents');
      const his = await api.get('/api/admin/users/' + u.id + '/history');
      setDetailUser({ user: u, documents: r.data.documents || [], history: his.data });
    } catch (e) {
      console.warn(e);
    }
  }

  async function pickAndUploadFile(docType?: string) {
    try {
      const url = await sharedPickAndUploadFile({ accept: '*/*', fallbackApiPath: '/api/admin/upload' });
      if (!url) return;
      if (detailUser && detailUser.user) {
        const title = docType ? `${docType}` : '';
        const r = await api.post('/api/admin/users/' + detailUser.user.id + '/documents', {
          title,
          file_url: url,
          file_type: undefined,
        });
        setDetailUser((s: any) => ({ ...s, documents: [...(s?.documents || []), r.data.document] }));
        fetchLogs();
      }
    } catch (e) {
      console.warn('pick/upload failed', e);
    }
  }

  // helpers to find Aadhaar / PAN documents for the user and to view them
  const findDoc = (regex: RegExp) =>
    (detailUser?.documents || []).find((d: any) =>
      Boolean(
        (d.title && regex.test(String(d.title))) ||
          (d.file_url && regex.test(String(d.file_url))) ||
          (d.file_type && regex.test(String(d.file_type)))
      )
    );
  const aadhaarDoc = findDoc(/aadhaar|aadhar/i);
  const panDoc = findDoc(/\bpan\b/i);
  const viewDocument = (url?: string) => {
    if (!url) return;
    // show preview modal inside the app instead of opening a new window
    try {
      setPreviewImageUrl(url);
      setShowPreviewModal(true);
    } catch (e) {
      console.warn('open doc failed', e);
    }
  };

  async function createBuilding() {
    try {
      await api.post('/api/admin/buildings', { name: 'New Wing', address: '' });
      fetchBuildings();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  async function createWing() {
    try {
      if (!newWing.name) return alert('Wing name required');
      const r = await api.post('/api/admin/addWing', {
        name: newWing.name,
        number_of_floors: Number(newWing.number_of_floors),
        flats_per_floor: Number(newWing.flats_per_floor),
      });
      setShowAddWingModal(false);
      setNewWing({ name: '', number_of_floors: '1', flats_per_floor: '1' });
      fetchBuildings();
      fetchFlats();
      fetchSummary();
      alert('Wing created with ' + (r.data?.flats?.length || 0) + ' flats');
    } catch (e) {
      console.warn('create wing failed', e);
      alert('Create wing failed');
    }
  }

  async function createNotice() {
    try {
      if (!newNotice.title) return alert('Title required');
      const payload: any = {
        title: newNotice.title,
        description: newNotice.description,
        image_url: newNotice.image_url,
      };
      if (newNotice.targetAll) {
        payload.targetAll = true;
      } else if (Array.isArray(newNotice.buildingIds) && newNotice.buildingIds.length) {
        payload.buildingIds = newNotice.buildingIds;
      }
      const r = await api.post('/api/admin/notices', payload);
      setShowCreateNoticeModal(false);
      setNewNotice({
        title: '',
        description: '',
        image_url: '',
        buildingIds: [],
        targetAll: false,
      });
      fetchNoticesCount();
      fetchNotices();
      alert('Notice created');
    } catch (e) {
      console.warn('create notice failed', e);
      alert('Failed to create notice');
    }
  }

  async function startAssign() {
    setAssignStep(1);
    setAssignState({
      wingId: '',
      flatId: '',
      role: 'owner',
      name: '',
      phone: '',
      address: '',
      files: [],
    });
    setShowAssignModal(true);
  }
  async function loadFlatsForWing(wingId: string) {
    try {
      const r = await api.get('/api/admin/getFlatsByWing/' + wingId);
      return r.data.flats || [];
    } catch (e) {
      console.warn('load flats failed', e);
      return [];
    }
  }
  async function submitAssign() {
    try {
      const payload = {
        wingId: assignState.wingId,
        flatId: assignState.flatId,
        role: assignState.role,
        name: assignState.name,
        phone: assignState.phone,
        address: assignState.address,
      };
      const r = await api.post('/api/admin/assignUserToFlat', payload);
      if (r.data && r.data.success) {
        alert('Assigned successfully');
        setShowAssignModal(false);
        fetchFlats();
        fetchUsers();
      } else alert('Assign failed');
    } catch (e: any) {
      console.warn('assign failed', e);
      alert((e && e.response?.data?.error) || 'Assign failed');
    }
  }
  const [assignFlats, setAssignFlats] = useState<any[]>([]);
  async function goToStep2() {
    if (!assignState.wingId) return alert('Choose wing');
    try {
      const flats = await loadFlatsForWing(assignState.wingId);
      setAssignFlats(flats);
      setAssignStep(2);
    } catch (e) {
      alert('Failed to load flats');
    }
  }
  async function createFlat() {
    try {
      if (!newFlat.flat_no) return alert('flat no required');
      await api.post('/api/admin/flats', {
        flat_no: newFlat.flat_no,
        buildingId: newFlat.buildingId || undefined,
      });
      setShowAddFlatModal(false);
      setNewFlat({ flat_no: '', buildingId: '' });
      fetchFlats();
      fetchSummary();
    } catch (e) {
      console.warn(e);
      alert('Failed to create flat');
    }
  }
  async function editBuilding(id: string, patch: any) {
    try {
      await api.put('/api/admin/buildings/' + id, patch);
      fetchBuildings();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  async function deleteBuilding(id: string) {
    try {
      await api.delete('/api/admin/buildings/' + id);
      fetchBuildings();
      fetchSummary();
    } catch (e) {
      console.warn(e);
    }
  }
  function editHelpline(id: string) {
    const h = helplines.find((x) => x.id === id);
    if (!h) return;
    setNewHelpline({
      type: h.type,
      name: h.name || '',
      phone: h.phone || '',
      notes: h.notes || '',
    });
    setShowHelplineModal(true);
  }

  // small helper to render stat cards responsively
  const renderStatCard = (title: string, value: any, iconName?: string) => (
    <View style={[styles.statCard, isMobile ? styles.statCardMobile : {}]}>
      <View style={styles.statTop}>
        {iconName ? <Ionicons name={iconName as any} size={18} /> : null}
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value ?? '-'}</Text>
    </View>
  );

  // animate wing bars when analytics changes
  useEffect(() => {
    const bars = [wingAnalytics.flats, wingAnalytics.owners, wingAnalytics.tenants];
    const max = Math.max(...bars, 1);
    const animations = bars.map((val, i) => {
      const target = Math.round((val / max) * 120);
      return Animated.timing(animatedWingHeightsRef[i], {
        toValue: target,
        duration: 600,
        useNativeDriver: false,
      });
    });
    Animated.stagger(60, animations).start();
  }, [wingAnalytics]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'} />

      {/* Mobile top nav */}
      {isMobile && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.hamburger}>
            <Ionicons name="menu" size={22} color="#111" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'column', alignItems: 'center' }}>
            <Text numberOfLines={1} style={styles.mobileTitle}>
              {societyName}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={20} />
            </TouchableOpacity>
            {/* three-dot header menu intentionally hidden per request */}
            <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.container, isDesktop ? styles.containerRow : {}]}>
        {/* SIDEBAR for tablet/desktop - disabled (menu moved to BottomTab) */}
        {false && (
          <View
            style={[styles.sidebar, isDesktop ? {} : styles.sidebarTablet]}
            accessibilityRole="menu"
          >
            {/* sidebar preserved in code but hidden; navigation now available via BottomTab */}
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Society Karbhar</Text>
              <Text style={styles.sidebarSub}>{user?.name || 'Admin'}</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'dashboard' && styles.menuItemActive]}
                onPress={() => {
                  setTab('dashboard');
                  setTab2('wings');
                }}
              >
                <Ionicons name="speedometer" size={18} color="#fff" />
                <Text style={styles.menuText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'helplines' && styles.menuItemActive]}
                onPress={() => setTab('helplines')}
              >
                <Ionicons name="call-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Helplines</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'notices' && styles.menuItemActive]}
                onPress={() => {
                  setTab('notices');
                  fetchNotices();
                }}
              >
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Notices</Text>
                {noticesCount > 0 ? (
                  <View style={styles.badgeSmall}>
                    <Text style={styles.badgeSmallText}>{noticesCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'users' && styles.menuItemActive]}
                onPress={() => setTab('users')}
              >
                <Ionicons name="people-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Users</Text>
              </TouchableOpacity>

              <View style={styles.sidebarQuick}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setShowHelplineModal(true)}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Helpline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setShowAddWingModal(true)}>
                  <Ionicons name="business" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Wing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setShowAddFlatModal(true)}>
                  <Ionicons name="home" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Flat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => startAssign()}>
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Assign Owner/Tenant</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={onLogout} style={styles.logoutRow}>
                <Ionicons name="log-out-outline" size={18} color="#ffdbdb" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MAIN AREA */}
        <View style={styles.mainContent}>
          {/* Header (desktop/tablet) */}
          {!isMobile && (
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Admin Dashboard</Text>
                <Text style={styles.subtitle}>
                  Manage societies, users, helplines and documents
                </Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} />
                  <TextInput
                    placeholder="Search users or helplines"
                    value={q}
                    onChangeText={setQ}
                    style={styles.searchInput}
                    onSubmitEditing={searchUsers}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTab('notices');
                    fetchNotices();
                  }}
                  style={styles.iconBtn}
                >
                  <Ionicons name="notifications-outline" size={20} />
                  {noticesCount > 0 ? (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>{noticesCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
                {/* three-dot header menu intentionally hidden on desktop header per request */}
              </View>
            </View>
          )}

          {/* Wing Analytics (moved here so it appears below the header) */}
          <View style={{ marginTop: 12, paddingHorizontal: isMobile ? 6 : 0 }}>
            <Text style={styles.sectionTitle}>Wing Analytics</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {buildings.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setSelectedWingId(b.id)}
                    style={[
                      styles.buildingChip,
                      selectedWingId === b.id ? styles.buildingChipActive : {},
                    ]}
                  >
                    <Text>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, elevation: 1 }}>
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>
                {selectedWingId
                  ? `Wing: ${(buildings.find((x) => x.id === selectedWingId) || {}).name || ''}`
                  : 'Select Wing'}
              </Text>
              {loadingWingAnalytics ? (
                <ActivityIndicator />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160 }}>
                  {[
                    { key: 'Flats', value: wingAnalytics.flats, color: '#4f46e5' },
                    { key: 'Owners', value: wingAnalytics.owners, color: '#10b981' },
                    { key: 'Tenants', value: wingAnalytics.tenants, color: '#f59e0b' },
                  ].map((b, i) => (
                    <View key={b.key} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                        {b.value}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          try {
                            (require('react-native').Alert as any).alert(b.key, String(b.value));
                          } catch (e) {}
                        }}
                        style={{
                          width: 44,
                          height: 120,
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 120,
                            backgroundColor: '#f3f4f6',
                            borderRadius: 6,
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            overflow: 'hidden',
                          }}
                        >
                          <Animated.View
                            style={[
                              { width: '100%', backgroundColor: b.color },
                              { height: animatedWingHeightsRef[i] },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                      <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{b.key}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
            {tab === 'dashboard' && (
              <View style={{ paddingVertical: 8 }}>
                {lastApiError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>API Error: {lastApiError}</Text>
                  </View>
                ) : null}

                <View style={[styles.statsRow, isMobile && { paddingHorizontal: 6 }]}>
                  {renderStatCard('Owners', summary?.totalOwners, 'person')}
                  {renderStatCard('Tenants', summary?.totalTenants, 'people')}
                  {renderStatCard('Wings', summary?.totalWings, 'business')}
                  {renderStatCard('Services', summary?.totalHelplines, 'call')}
                </View>

                <View style={{ marginTop: 12, paddingHorizontal: isMobile ? 6 : 0 }}>
                  <Text style={styles.sectionTitle}>Quick actions</Text>
                  <View style={[styles.actionRow, isMobile && { flexDirection: 'column' }]}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={() => setShowHelplineModal(true)}
                    >
                      <Ionicons name="add" size={16} />
                      <Text style={styles.actionBtnText}>Add Helpline</Text>
                    </TouchableOpacity>

                    {/* Add Wing quick action */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={() => setShowAddWingModal(true)}
                    >
                      <Ionicons name="business" size={16} />
                      <Text style={styles.actionBtnText}>Add Wing</Text>
                    </TouchableOpacity>

                    {/* Add Owner/Tenant - restores quick action on Dashboard */}
                    {/* Add Owner/Tenant quick action removed from Dashboard per UI preference */}

                    {/* Assign Owner/Tenant - quick access to the multi-step assign flow */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={startAssign}
                    >
                      <Ionicons name="people" size={16} />
                      <Text style={styles.actionBtnText}>Assign Owner/Tenant</Text>
                    </TouchableOpacity>

                    {/* Complaints quick action */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={async () => {
                        await fetchComplaints();
                        setShowComplaintsModal(true);
                      }}
                    >
                      <Ionicons name="alert-circle" size={16} />
                      <Text style={styles.actionBtnText}>Complaints</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {tab === 'helplines' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={{ marginBottom: 8 }}>
                  <Button title="Create Helpline" onPress={() => setShowHelplineModal(true)} />
                </View>
                <FlatList
                  data={helplines}
                  keyExtractor={(h: any) => h.id}
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{item.name || item.type}</Text>
                        <Text style={styles.listSub}>{item.phone}</Text>
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          onPress={() => editHelpline(item.id)}
                          style={styles.listIcon}
                        >
                          <Ionicons name="create-outline" size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteHelpline(item.id)}
                          style={styles.listIcon}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              </View>
            )}

            {tab === 'notices' && (
              <View style={{ paddingVertical: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={styles.sectionTitle}>Notices</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => {
                        fetchNotices();
                        fetchNoticesCount();
                      }}
                    >
                      <Text style={{ color: '#fff' }}>Refresh</Text>
                    </TouchableOpacity>
                    <View style={{ width: 8 }} />
                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => setShowCreateNoticeModal(true)}
                    >
                      <Text style={{ color: '#fff' }}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <FlatList
                  data={notices}
                  keyExtractor={(n: any) => n.id}
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{item.title}</Text>
                        <Text style={styles.listSub}>{item.description}</Text>
                      </View>
                      <Text style={{ color: '#6b7280' }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  )}
                />
              </View>
            )}

            {tab === 'users' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={[styles.rowBetween, { paddingHorizontal: isMobile ? 6 : 0 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      placeholder="Search name or phone"
                      value={q}
                      onChangeText={setQ}
                      style={styles.search}
                    />
                  </View>
                  <Button title="Search" onPress={searchUsers} />
                </View>
                {/* this has been moved to assign flow only */}
                {/* <View
                  style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: isMobile ? 6 : 0 }}
                >
                  <Button title="Add Owner/Tenant" onPress={() => setShowUserModal(true)} />
                </View> */}
                <FlatList
                  data={users}
                  keyExtractor={(w: any) => w.id}
                  renderItem={({ item: wing }) => {
                    const isOpen = !!expandedWings[wing.id];
                    return (
                      <View style={styles.wingContainer}>
                        <TouchableOpacity
                          style={styles.wingHeader}
                          onPress={() =>
                            setExpandedWings((s) => ({ ...s, [wing.id]: !s[wing.id] }))
                          }
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="business" size={20} color="#374151" />
                            <Text style={styles.wingTitle}>{wing.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: '#6b7280', marginRight: 8 }}>
                              {wing.flats ? wing.flats.length : 0} flats
                            </Text>
                            <Ionicons
                              name={isOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#6B7280"
                            />
                          </View>
                        </TouchableOpacity>

                        {isOpen &&
                          (wing.flats || []).map((flat: any) => (
                            <View key={flat.id} style={styles.flatContainer}>
                              <View style={styles.flatHeader}>
                                <Ionicons name="home" size={18} color="#4B5563" />
                                <Text style={styles.flatTitle}>Flat {flat.flat_no}</Text>
                              </View>

                              <View style={styles.flatUsers}>
                                {flat.users?.map((user: any) => (
                                  <View key={user.id} style={styles.userItemContainer}>
                                    <TouchableOpacity
                                      style={styles.userItem}
                                      onPress={() => openUserDetail(user)}
                                    >
                                      <View style={styles.userIcon}>
                                        <Ionicons
                                          name={user.role === 'owner' ? 'person' : 'people'}
                                          size={16}
                                          color="#4B5563"
                                        />
                                      </View>
                                      <View style={styles.userInfo}>
                                        <Text style={styles.userName}>
                                          {user.name || user.phone}
                                        </Text>
                                        <Text style={styles.userRole}>
                                          {user.role} • {user.phone}
                                        </Text>
                                      </View>
                                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ))}
                      </View>
                    );
                  }}
                />
              </View>
            )}

            {tab === 'maintenance' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={[styles.rowBetween, { paddingHorizontal: isMobile ? 6 : 0 }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.sectionTitle}>Maintenance Settings</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ color: '#6b7280', marginRight: 8 }}>Monthly amount: ₹</Text>
                      <TextInput
                        value={maintenanceEditAmount}
                        onChangeText={setMaintenanceEditAmount}
                        keyboardType="numeric"
                        style={[styles.input, { width: 140, paddingVertical: 6 }]}
                        placeholder="0"
                      />
                      <View style={{ width: 8 }} />
                      <TouchableOpacity
                        style={[styles.smallBtn]}
                        onPress={() => {
                          const v = Number((maintenanceEditAmount || '').replace(/[^0-9.-]/g, ''));
                          if (Number.isNaN(v)) return alert('Enter a valid amount');
                          saveMaintenanceSetting(v);
                        }}
                      >
                        <Text style={{ color: '#fff' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Button title="Generate" onPress={() => setShowGenerateConfirm(true)} />
                  </View>
                </View>

                <View style={{ marginTop: 12, paddingHorizontal: isMobile ? 6 : 0 }}>
                  <Text style={styles.sectionTitle}>Monthly Maintenance - Owners</Text>
                  {maintenanceLoading ? (
                    <ActivityIndicator style={{ marginTop: 12 }} />
                  ) : (
                    <FlatList
                      data={(maintenanceGroups || []).sort(
                        (a: any, b: any) => (b.unpaidAmount || 0) - (a.unpaidAmount || 0)
                      )}
                      keyExtractor={(g: any) => String(g.id || g.name)}
                      renderItem={({ item }) => (
                        <View style={[styles.listItem, { alignItems: 'center' }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{item.name || 'Unknown'}</Text>
                            <Text style={styles.listSub}>
                              Due: ₹{item.unpaidAmount || 0} • Total: ₹{item.totalAmount || 0}
                            </Text>
                            <Text style={{ color: item.unpaidAmount > 0 ? '#b45309' : '#10b981' }}>
                              {item.unpaidAmount > 0 ? 'Overdue' : 'Paid'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                            <TouchableOpacity
                              style={[styles.smallBtn]}
                              onPress={() => {
                                // open detail: list of bills for this owner
                                Alert.alert(
                                  item.name || 'Owner',
                                  `${item.bills?.length || 0} bills\nUnpaid: ₹${
                                    item.unpaidAmount || 0
                                  }`,
                                  [
                                    { text: 'Close' },
                                    {
                                      text: 'Mark all Paid',
                                      onPress: async () => {
                                        // mark each bill as approved
                                        for (const b of item.bills || []) {
                                          if ((b.status || '') !== 'closed') {
                                            await adminVerifyBill(b.id, 'approve');
                                          }
                                        }
                                        fetchMaintenanceFees(maintenanceMonth || undefined, 'all');
                                      },
                                    },
                                  ]
                                );
                              }}
                            >
                              <Text style={{ color: '#fff' }}>Actions</Text>
                            </TouchableOpacity>
                            <View style={{ height: 6 }} />
                            <TouchableOpacity
                              style={styles.smallBtnClose}
                              onPress={() => {
                                // open bills in browser if proof exists
                                const firstProof = (item.bills || []).find(
                                  (x: any) => x.payment_proof_url
                                );
                                if (firstProof && firstProof.payment_proof_url) {
                                  try {
                                    (require('react-native').Linking as any).openURL(
                                      firstProof.payment_proof_url
                                    );
                                  } catch (e) {}
                                } else Alert.alert('No proof available');
                              }}
                            >
                              <Text style={{ color: '#374151' }}>View Proof</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    />
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* MOBILE: Sidebar drawer as modal */}
      <Modal visible={showSidebar} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.mobileDrawerBackdrop}
          onPress={() => setShowSidebar(false)}
          activeOpacity={1}
        >
          <View style={styles.mobileDrawer}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Society Karbhar</Text>
              <Text style={styles.sidebarSub}>{user?.name || 'Admin'}</Text>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'dashboard' && styles.menuItemActive]}
                onPress={() => {
                  setShowSidebar(false);
                }}
              >
                <Ionicons name="speedometer" size={18} color="#fff" />
                <Text style={styles.menuText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'helplines' && styles.menuItemActive]}
                onPress={() => {
                  setTab('helplines');
                  setShowSidebar(false);
                }}
              >
                <Ionicons name="call-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Helplines</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'notices' && styles.menuItemActive]}
                onPress={() => {
                  setTab('notices');
                  setShowSidebar(false);
                  fetchNotices();
                }}
              >
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Notices</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, tab === 'users' && styles.menuItemActive]}
                onPress={() => {
                  setTab('users');
                  setShowSidebar(false);
                }}
              >
                <Ionicons name="people-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Users</Text>
              </TouchableOpacity>

              <View style={styles.sidebarQuick}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    setShowHelplineModal(true);
                    setShowSidebar(false);
                  }}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Helpline</Text>
                </TouchableOpacity>
                {/* Removed Add User from sidebar per UI preference */}
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    setShowAddWingModal(true);
                    setShowSidebar(false);
                  }}
                >
                  <Ionicons name="business" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Wing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    setShowAddFlatModal(true);
                    setShowSidebar(false);
                  }}
                >
                  <Ionicons name="home" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Flat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    startAssign();
                    setShowSidebar(false);
                  }}
                >
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Assign Owner/Tenant</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity
                onPress={() => {
                  setShowSidebar(false);
                  onLogout();
                }}
                style={styles.logoutRow}
              >
                <Ionicons name="log-out-outline" size={18} color="#ffdbdb" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image preview modal (shows Aadhaar/PAN or any document image inside the app) */}
      <Modal visible={showPreviewModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentLarge, { alignItems: 'center' }]}>
            {previewImageUrl ? (
              <Image
                source={{ uri: previewImageUrl }}
                style={{ width: '100%', height: 420, resizeMode: 'contain', backgroundColor: '#000' }}
              />
            ) : (
              <Text>No preview available</Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
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

      {/* Create Notice modal */}
      <Modal visible={showCreateNoticeModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Notice</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={newNotice.title}
              onChangeText={(t) => setNewNotice((s) => ({ ...s, title: t }))}
              style={styles.input}
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={newNotice.description}
              onChangeText={(t) => setNewNotice((s) => ({ ...s, description: t }))}
              style={[styles.input, { height: 100 }]}
              multiline
            />
            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput
              value={newNotice.image_url}
              onChangeText={(t) => setNewNotice((s) => ({ ...s, image_url: t }))}
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: 8 }]}>Target Wings</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() =>
                  setNewNotice((s) => ({ ...s, targetAll: !s.targetAll, buildingIds: [] }))
                }
                style={[styles.pill, newNotice.targetAll ? styles.pillActive : {}]}
              >
                <Text>All wings</Text>
              </TouchableOpacity>
              {buildings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => {
                    if (newNotice.targetAll) return; // ignore when all selected
                    const exists = (newNotice.buildingIds || []).includes(b.id);
                    if (exists)
                      setNewNotice((s) => ({
                        ...s,
                        buildingIds: (s.buildingIds || []).filter((x) => x !== b.id),
                      }));
                    else
                      setNewNotice((s) => ({
                        ...s,
                        buildingIds: [...(s.buildingIds || []), b.id],
                      }));
                  }}
                  style={[
                    styles.buildingChip,
                    (newNotice.buildingIds || []).includes(b.id) ? styles.buildingChipActive : {},
                  ]}
                >
                  <Text>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={() => setShowCreateNoticeModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createNotice} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom tab (mobile) */}
      {/* BottomTab: show menu actions in the bottom tab for all sizes (sidebar removed per request) */}
      {/* Generate confirmation modal */}
      <Modal visible={showGenerateConfirm} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate maintenance</Text>
            <Text style={{ marginTop: 8 }}>
              This will create maintenance bills for the selected members using the configured
              maintenance amount. Please confirm.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ marginRight: 8 }}>Owners only</Text>
              <Switch value={generateOwnersOnly} onValueChange={setGenerateOwnersOnly} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setShowGenerateConfirm(false)} />
              <View style={{ width: 8 }} />
              <Button
                title="Confirm"
                onPress={() => {
                  setShowGenerateConfirm(false);
                  // If an explicit amount was entered, prefer that; otherwise undefined
                  const amt = maintenanceEditAmount ? Number(maintenanceEditAmount) : undefined;
                  generateMonthlyMaintenance(
                    maintenanceMonth || undefined,
                    amt,
                    generateOwnersOnly
                  );
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <BottomTab
        activeKey={tab}
        onChange={(k: any) => {
          if (k === 'profile') {
            setShowProfileModal(true);
          } else {
            setTab(k);
          }
        }}
        items={[
          { key: 'dashboard', label: 'Dashboard', icon: 'speedometer' },
          { key: 'helplines', label: 'Helplines', icon: 'call-outline' },
          { key: 'maintenance', label: 'Maintenance', icon: 'cash' },
          { key: 'users', label: 'Users', icon: 'people-outline' },
          { key: 'notices', label: 'Notices', icon: 'notifications-outline' },
          { key: 'profile', label: 'Profile', icon: 'person' },
        ]}
      />

      {/* MODALS: keep behavior but mobile-friendly sizes */}

      {/* Complaints modal (admin) */}
      <Modal visible={showComplaintsModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentLarge, { maxHeight: '85%' }]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={styles.modalTitle}>Complaints</Text>
              <TouchableOpacity onPress={() => setShowComplaintsModal(false)}>
                <Ionicons name="close" size={22} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={complaintsList}
              keyExtractor={(c: any) => c.id}
              renderItem={({ item }) => {
                const loc = resolveUserLocation(item.raised_by);
                return (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => setSelectedComplaint(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{item.title || 'Complaint'}</Text>
                      <Text style={styles.listSub} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <Text style={styles.listMeta}>
                        Raised by: {loc ? loc.user.name : item.raised_by}{' '}
                        {loc ? `• ${loc.wing?.name || ''} / Flat ${loc.flat?.flat_no || ''}` : ''}
                      </Text>
                    </View>
                    <View style={{ justifyContent: 'center' }}>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Selected complaint popup */}
      <Modal visible={!!selectedComplaint} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxWidth: 600 }]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={[styles.modalTitle, { flex: 1 }]} numberOfLines={2}>
                {selectedComplaint?.title}
              </Text>
              <TouchableOpacity onPress={() => setSelectedComplaint(null)}>
                <Ionicons name="close" size={22} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.listSub}>{selectedComplaint?.description}</Text>
              <View style={{ height: 12 }} />
              <Text style={styles.listMeta}>
                Raised by:{' '}
                {resolveUserLocation(selectedComplaint?.raised_by)?.user?.name ||
                  selectedComplaint?.raised_by}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Wing modal */}
      <Modal visible={showAddWingModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Wing (Generate Flats)</Text>
            <Text style={styles.label}>Wing Name</Text>
            <TextInput
              value={newWing.name}
              onChangeText={(t) => setNewWing((s) => ({ ...s, name: t }))}
              style={styles.input}
            />
            <Text style={styles.label}>Number of Floors</Text>
            <TextInput
              value={newWing.number_of_floors}
              onChangeText={(t) => setNewWing((s) => ({ ...s, number_of_floors: t }))}
              style={styles.input}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Flats per Floor</Text>
            <TextInput
              value={newWing.flats_per_floor}
              onChangeText={(t) => setNewWing((s) => ({ ...s, flats_per_floor: t }))}
              style={styles.input}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button title="Cancel" onPress={() => setShowAddWingModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create Wing" onPress={createWing} />
            </View>
          </View>
        </View>
      </Modal>
      {/* Profile modal for Admin (opened from BottomTab 'Profile') */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 8 }}>Profile</Text>
            <ProfileCard
              name={user?.name}
              phone={user?.phone || user?.mobile_number}
              email={user?.email}
              address={user?.address}
              imageUri={userAvatar || user?.avatar || user?.image}
              onEdit={async () => {
                try {
                  const url = await pickAndUploadProfile();
                  if (!url) return; // cancelled
                  await api.put('/api/user', { avatar: url });
                  setUserAvatar(url);
                  alert('Profile photo updated');
                } catch (e) {
                  console.warn('admin profile upload failed', e);
                  alert('Upload failed');
                }
              }}
              onCall={(p) => {
                try {
                  (require('react-native').Linking as any).openURL(`tel:${p}`);
                } catch (e) {}
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallBtnClose, { marginRight: 8 }]}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => {
                  setShowProfileModal(false);
                  onLogout();
                }}
              >
                <Text style={styles.smallBtnTextWhite}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Owner/Tenant multi-step modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Assign Owner / Tenant</Text>
            {assignStep === 1 && (
              <>
                <Text style={styles.label}>Select Wing</Text>
                <FlatList
                  data={buildings}
                  horizontal
                  keyExtractor={(b: any) => b.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setAssignState((s) => ({ ...s, wingId: item.id }))}
                      style={[
                        styles.buildingChip,
                        assignState.wingId === item.id && styles.buildingChipActive,
                      ]}
                    >
                      <Text>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button title="Next" onPress={goToStep2} />
                </View>
              </>
            )}
            {assignStep === 2 && (
              <>
                <Text style={styles.label}>Select Flat</Text>
                <FlatList
                  data={assignFlats}
                  keyExtractor={(f: any) => f.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setAssignState((s) => ({ ...s, flatId: item.id }))}
                      style={[
                        styles.buildingChip,
                        assignState.flatId === item.id && styles.buildingChipActive,
                      ]}
                    >
                      <Text>{item.flat_no}</Text>
                    </TouchableOpacity>
                  )}
                  horizontal
                />
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}
                >
                  <Button title="Back" onPress={() => setAssignStep(1)} />
                  <Button
                    title="Next"
                    onPress={() => {
                      if (!assignState.flatId) return alert('Choose flat');
                      setAssignStep(3);
                    }}
                  />
                </View>
              </>
            )}
            {assignStep === 3 && (
              <>
                <Text style={styles.label}>Role</Text>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => setAssignState((s) => ({ ...s, role: 'owner' }))}
                    style={[styles.pill, assignState.role === 'owner' && styles.pillActive]}
                  >
                    <Text>Owner</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAssignState((s) => ({ ...s, role: 'tenant' }))}
                    style={[styles.pill, assignState.role === 'tenant' && styles.pillActive]}
                  >
                    <Text>Tenant</Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}
                >
                  <Button title="Back" onPress={() => setAssignStep(2)} />
                  <Button title="Next" onPress={() => setAssignStep(4)} />
                </View>
              </>
            )}
            {assignStep === 4 && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  value={assignState.name}
                  onChangeText={(t) => setAssignState((s) => ({ ...s, name: t }))}
                  style={styles.input}
                />
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  value={assignState.phone}
                  onChangeText={(t) => setAssignState((s) => ({ ...s, phone: t }))}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
                <Text style={styles.label}>Address</Text>
                <TextInput
                  value={assignState.address}
                  onChangeText={(t) => setAssignState((s) => ({ ...s, address: t }))}
                  style={styles.input}
                />
                {/* Document upload area for tenants: simple URL input or picker */}
                {assignState.role === 'tenant' && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
                      Upload Documents (Aadhaar, PAN, Agreement)
                    </Text>
                    <TextInput
                      placeholder="Document URL"
                      onChangeText={(t) =>
                        setAssignState((s) => ({ ...s, files: [...s.files, { file_url: t }] }))
                      }
                      style={styles.input}
                    />
                  </>
                )}
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}
                >
                  <Button title="Back" onPress={() => setAssignStep(3)} />
                  <Button title="Submit" onPress={submitAssign} />
                </View>
              </>
            )}
            <View style={{ height: 12 }} />
            <Button title="Close" onPress={() => setShowAssignModal(false)} />
          </View>
        </View>
      </Modal>

      {/* Header three-dot menu modal */}
      <Modal visible={showHeaderMenu} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowHeaderMenu(false)}
        >
          <View
            style={[styles.modalContent, { width: 260, alignSelf: 'flex-end', marginRight: 12 }]}
          >
            <TouchableOpacity
              style={{ padding: 12 }}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowAddWingModal(true);
              }}
            >
              <Text style={{ fontWeight: '700' }}>Add Wing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ padding: 12 }}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowAddFlatModal(true);
              }}
            >
              <Text style={{ fontWeight: '700' }}>Add Flat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ padding: 12 }}
              onPress={() => {
                setShowHeaderMenu(false);
                setShowCreateNoticeModal(true);
              }}
            >
              <Text style={{ fontWeight: '700' }}>Create Notice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => setShowHeaderMenu(false)}>
              <Text style={{ color: '#666' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* User detail modal */}
      <Modal visible={showUserDetail} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentLarge, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>{detailUser?.user?.name || 'User'}</Text>
              <Text style={styles.label}>Phone: {detailUser?.user?.phone}</Text>

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Documents</Text>
              <FlatList
                data={detailUser?.documents || []}
                keyExtractor={(d: any) => d.id}
                renderItem={({ item }) => (
                  <View style={{ padding: 8 }}>
                    <Text style={styles.listTitle}>{item.title || item.file_type}</Text>
                    <Text style={styles.listSub}>{item.file_url}</Text>
                  </View>
                )}
              />

              {/* Aadhaar / PAN upload buttons (replaces generic upload/link UI) */}
              <View style={{ marginTop: 8, marginBottom: 6 }}>
                <Text style={{ marginBottom: 6, color: '#374151', fontWeight: '700' }}>
                  Identity Documents
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
                    onPress={() => pickAndUploadFile('Aadhaar Card')}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} />
                    <Text style={[styles.actionBtnText, { marginLeft: 8 }]}>
                      Upload Aadhaar Card
                    </Text>
                  </TouchableOpacity>

                  {aadhaarDoc ? (
                    <TouchableOpacity
                      style={{ marginLeft: 8, padding: 8 }}
                      onPress={() => viewDocument(aadhaarDoc.file_url)}
                    >
                      <Ionicons name="eye-outline" size={22} color="#374151" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={{ height: 8 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
                    onPress={() => pickAndUploadFile('PAN Card')}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} />
                    <Text style={[styles.actionBtnText, { marginLeft: 8 }]}>Upload PAN Card</Text>
                  </TouchableOpacity>

                  {panDoc ? (
                    <TouchableOpacity
                      style={{ marginLeft: 8, padding: 8 }}
                      onPress={() => viewDocument(panDoc.file_url)}
                    >
                      <Ionicons name="eye-outline" size={22} color="#374151" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {uploadProgress !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginLeft: 8 }}>{uploadProgress}%</Text>
                </View>
              )}

              <FlatList
                data={detailUser?.history?.agreements || []}
                keyExtractor={(a: any) => a.id}
                renderItem={({ item }) => (
                  <View style={{ padding: 6 }}>
                    <Text>Agreement {item.id}</Text>
                    <Text style={styles.listSub}>{item.file_url}</Text>
                  </View>
                )}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Button
                  title="Save"
                  onPress={async () => {
                    try {
                      const r = await api.post('/api/admin/agreements', {
                        flatId: agrFlatId,
                        ownerId: detailUser.user.id,
                        tenantId: agrTenantId,
                        file_url: agrUrl,
                      });
                      setDetailUser((s: any) => ({
                        ...s,
                        history: {
                          ...s.history,
                          agreements: [...(s.history?.agreements || []), r.data.agreement],
                        },
                      }));
                      fetchLogs();
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button title="Close" onPress={() => setShowUserDetail(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Flat modal */}
      <Modal visible={showAddFlatModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Flat</Text>
            <Text style={styles.label}>Wing</Text>
            <FlatList
              data={buildings}
              horizontal
              keyExtractor={(b: any) => b.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setNewFlat((s) => ({ ...s, buildingId: item.id }))}
                  style={[
                    styles.buildingChip,
                    newFlat.buildingId === item.id && styles.buildingChipActive,
                  ]}
                >
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <Text style={styles.label}>Flat / Apartment No.</Text>
            <TextInput
              value={newFlat.flat_no}
              onChangeText={(t) => setNewFlat((s) => ({ ...s, flat_no: t }))}
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button title="Cancel" onPress={() => setShowAddFlatModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createFlat} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Helpline modal */}
      <Modal visible={showHelplineModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Helpline</Text>
            <Text style={styles.label}>Type (ambulance, police, plumber...)</Text>
            <TextInput
              value={newHelpline.type}
              onChangeText={(t) => setNewHelpline((s) => ({ ...s, type: t }))}
              style={styles.input}
            />
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              value={newHelpline.name}
              onChangeText={(t) => setNewHelpline((s) => ({ ...s, name: t }))}
              style={styles.input}
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={newHelpline.phone}
              onChangeText={(t) => setNewHelpline((s) => ({ ...s, phone: t }))}
              style={styles.input}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={newHelpline.notes}
              onChangeText={(t) => setNewHelpline((s) => ({ ...s, notes: t }))}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={() => setShowHelplineModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createHelpline} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const palette = {
  primary: '#2b6cb0',
  muted: '#f2f6fb',
  card: '#ffffff',
  danger: '#ff6b6b',
  subtle: '#6b7280',
};

const styles: any = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7fafc' },
  container: { flex: 1, padding: 12 },

  // Users list - hierarchical view styles
  wingContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  wingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  wingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 8,
  },
  flatContainer: {
    marginVertical: 4,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  flatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  flatTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: 8,
  },
  flatUsers: {
    paddingLeft: 32,
  },
  userItemContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  userIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  userRole: {
    fontSize: 12,
    color: '#6B7280',
  },
  containerRow: { flexDirection: 'row' },

  // mobile top bar
  mobileTopBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  hamburger: { padding: 8 },
  mobileTitle: { fontWeight: '700', fontSize: 16, marginLeft: 6, maxWidth: 180 },

  // SIDEBAR
  sidebar: {
    width: 260,
    backgroundColor: palette.primary,
    borderRightWidth: 1,
    borderColor: '#e6eef8',
    paddingTop: 12,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  sidebarTablet: { width: 220 },
  sidebarMobile: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sidebarHeader: { padding: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sidebarTitle: { fontWeight: '800', fontSize: 16, color: '#fff' },
  sidebarSub: { color: '#dfeeff', marginTop: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  menuItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  menuText: { marginLeft: 8, color: '#fff', fontWeight: '600' },
  sidebarQuick: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    borderRadius: 8,
  },
  quickBtnText: { marginLeft: 8, color: '#fff' },
  sidebarFooter: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  logoutRow: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { marginLeft: 8, color: '#ffdbdb' },

  // MAIN
  mainContent: { flex: 1, paddingLeft: 4, paddingRight: 4 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { color: palette.subtle, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 180,
    elevation: 2,
  },
  searchInput: { marginLeft: 8, minWidth: 120 },
  iconBtn: { padding: 8, marginLeft: 6, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  headerBadge: {
    position: 'absolute',
    right: 0,
    top: -6,
    backgroundColor: '#ff4757',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeSmall: {
    marginLeft: 8,
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  smallBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  topTabs: { flexDirection: 'row', marginBottom: 8 },
  topTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  topTabActive: { backgroundColor: palette.primary, elevation: 2 },
  topTabText: { color: '#374151' },
  topTabTextActive: { color: '#fff', fontWeight: '700' },

  secondaryTabs: { flexDirection: 'row', marginBottom: 12 },
  smallTab: { padding: 6, marginRight: 8, borderRadius: 6, backgroundColor: '#fff' },
  smallTabActive: { backgroundColor: '#edf2ff' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  statCard: {
    width: '48%',
    backgroundColor: palette.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  // keep two-column layout even on narrow screens for the main stat tiles
  statCardMobile: { width: '48%' },
  statTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statTitle: { marginLeft: 8, color: '#374151', fontWeight: '700' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },

  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  actionRow: { flexDirection: 'row', marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: 8,
    elevation: 2,
  },
  actionBtnText: { marginLeft: 8 },
  actionBtnOutline: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  actionBtnOutlineText: { color: '#374151' },

  listItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eef2f6',
    backgroundColor: '#fff',
    marginBottom: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  listTitle: { fontWeight: '700' },
  listSub: { color: '#6b7280' },
  listMeta: { color: '#6b7280', marginTop: 4, fontSize: 13 },
  listIcon: { padding: 6, marginLeft: 6 },

  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#fff',
  },

  // modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: { width: '92%', backgroundColor: '#fff', padding: 12, borderRadius: 10 },
  modalContentLarge: {
    width: '94%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e6eef8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  label: { fontWeight: '700', marginBottom: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6eef8',
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#eef2ff' },
  buildingChip: { padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#fff' },
  buildingChipActive: { backgroundColor: '#eef2ff' },

  errorBox: { backgroundColor: '#fff6f6', padding: 8, borderRadius: 8 },
  errorText: { color: palette.danger },

  // mobile drawer
  mobileDrawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  mobileDrawer: { width: '78%', height: '100%', backgroundColor: palette.primary, paddingTop: 36 },
});
