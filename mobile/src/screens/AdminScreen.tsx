import React, { useEffect, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import { defaultBaseUrl } from '../services/config';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabContext } from '../contexts/BottomTabContext';
// Use legacy expo-file-system API for compatibility with readAsStringAsync usage
import * as FileSystem from 'expo-file-system/legacy';
import ProfileCard from '../components/ProfileCard';
import pickAndUploadProfile, {
  pickAndUploadFile as sharedPickAndUploadFile,
} from '../services/uploadProfile';
import AdminProfile from './AdminProfile';
import StaffManagement from './StaffManagement';
import VisitorsScreen from './Admin/Visitors';
import CamerasScreen from './Admin/Cameras';

// Responsive Admin Screen
// - Preserves all API calls / logic from your original file
// - Improves mobile responsiveness by switching to a top navbar + drawer-style sidebar
// - Uses useWindowDimensions for runtime layout decisions

type Props = { user: any; onLogout: () => void; setUser?: (u: any) => void };

export default function AdminScreen({ user, onLogout, setUser }: Props) {
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
  const [tab, setTab] = useState<
    | 'dashboard'
    | 'helplines'
    | 'users'
    | 'notices'
    | 'maintenance'
    | 'profile'
    | 'staff'
    | 'visitors'
    | 'cameras'
  >('dashboard');
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
  // navigate to staff tab instead of modal
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
  // profile is now a tab (renders full page) instead of a modal
  const [userAvatar, setUserAvatar] = useState<string | undefined>(
    (user as any)?.avatar || (user as any)?.image
  );
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  // Staff page controls
  const [staffQuery, setStaffQuery] = useState('');
  const [staffAddVisible, setStaffAddVisible] = useState(false);
  const [staffRefreshKey, setStaffRefreshKey] = useState(0);
  // de-duplicate buildings client-side to avoid duplicate-key issues when backend returns
  // repeated entries. Keep original order and filter by unique id.
  const uniqueBuildings = React.useMemo(() => {
    const seen = new Set<string | number>();
    const out: any[] = [];
    for (const b of buildings || []) {
      const id = b && (b.id ?? b._id ?? b.name);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(b);
    }
    return out;
  }, [buildings]);
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

  // Proof overview modal state: when Actions -> View proofs is selected
  const [proofOverview, setProofOverview] = useState<null | { owner: any; proofs: any[] }>(null);

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
      // Deduplicate nested users per flat to avoid repeated tenant entries
      const wingsRaw = res.data.wings || [];
      const wings = (wingsRaw || []).map((w: any) => {
        const nw = { ...w };
        if (Array.isArray(nw.flats)) {
          nw.flats = nw.flats.map((f: any) => {
            const nf = { ...f };
            if (Array.isArray(nf.users)) {
              const seen = new Map();
              for (const u of nf.users) {
                const key =
                  u && (u.id || u.phone || (u.name && u.name.trim()) || JSON.stringify(u));
                if (!key) continue;
                if (!seen.has(key)) seen.set(key, u);
              }
              nf.users = Array.from(seen.values());
            }
            return nf;
          });
        }
        return nw;
      });
      setUsers(wings);
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
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
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
      // If the user object contains flat info, prefill the agreement flat id to help the admin
      // find the correct flat when creating an agreement.
      const possibleFlatId = (u && (u.flatId || u.flat_id || (u.flat && u.flat.id))) || '';
      if (possibleFlatId) setAgrFlatId(String(possibleFlatId));
    } catch (e) {
      console.warn(e);
    }
  }

  async function pickAndUploadFile(docType?: string) {
    try {
      if (docType && /aadhaar|aadhar/i.test(String(docType))) setUploadingAadhaar(true);
      if (docType && /\bpan\b/i.test(String(docType))) setUploadingPan(true);

      const url = await sharedPickAndUploadFile({
        accept: '*/*',
        fallbackApiPath: '/api/admin/upload',
      });
      if (!url) return;
      if (detailUser && detailUser.user) {
        const title = docType ? `${docType}` : '';
        const r = await api.post('/api/admin/users/' + detailUser.user.id + '/documents', {
          title,
          file_url: url,
          file_type: undefined,
        });
        setDetailUser((s: any) => ({
          ...s,
          documents: [...(s?.documents || []), r.data.document],
        }));
        fetchLogs();
      }
    } catch (e) {
      console.warn('pick/upload failed', e);
    } finally {
      if (docType && /aadhaar|aadhar/i.test(String(docType))) setUploadingAadhaar(false);
      if (docType && /\bpan\b/i.test(String(docType))) setUploadingPan(false);
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

  // Open or download agreement PDF/URL. Keep simple: open the URL using Linking.
  const openOrDownloadAgreement = async (url?: string) => {
    if (!url) return alert('No agreement URL available');
    try {
      // Prefer to open the URL in external browser / handler which will allow download
      await Linking.openURL(url);
    } catch (e) {
      console.warn('open agreement failed', e);
      alert('Failed to open agreement');
    }
  };

  // Pick the latest agreement from detailUser.history.agreements (by updated/created timestamp)
  const latestAgreement = React.useMemo(() => {
    const ags = (detailUser && detailUser.history && detailUser.history.agreements) || [];
    if (!Array.isArray(ags) || ags.length === 0) return null;
    const ts = (a: any) => {
      const d =
        a && (a.updatedAt || a.updated_at || a.createdAt || a.created_at || a.created)
          ? new Date(
              a.updatedAt || a.updated_at || a.createdAt || a.created_at || a.created
            ).getTime()
          : 0;
      return isNaN(d) ? 0 : d;
    };
    return ags.slice().sort((a: any, b: any) => ts(b) - ts(a))[0] || null;
  }, [detailUser]);

  // Normalize agreement URLs into a set to avoid showing agreements twice (as documents)
  const agreementUrls = React.useMemo(() => {
    const ags = (detailUser && detailUser.history && detailUser.history.agreements) || [];
    const set = new Set<string>();
    for (const a of ags || []) {
      const url = a && (a.file_url || a.fileUrl || a.url || a.path || a.path_url || '');
      if (url) set.add(String(url));
    }
    return set;
  }, [detailUser]);

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

  const bottomTab = React.useContext(BottomTabContext);

  // when bottom tab changes, switch admin 'tab' appropriately
  React.useEffect(() => {
    try {
      const k = bottomTab.activeKey;
      if (k === 'home') setTab('dashboard');
      else if (k === 'helplines') setTab('helplines');
      else if (k === 'bills' || k === 'maintenance') setTab('maintenance');
      else if (k === 'users') setTab('users');
      else if (k === 'notices') setTab('notices');
      else if (k === 'profile') setTab('profile');
      else if (k === 'cameras') setTab('cameras');
    } catch (e) {}
  }, [bottomTab.activeKey]);

  // push admin tab -> bottom tab context
  React.useEffect(() => {
    try {
      const map: any = {
        dashboard: 'home',
        helplines: 'helplines',
        maintenance: 'bills',
        users: 'users',
        notices: 'notices',
        profile: 'profile',
        cameras: 'cameras',
      };
      const k = map[tab] || 'home';
      if (bottomTab.activeKey !== k) bottomTab.setActiveKey(k);
    } catch (e) {}
  }, [tab]);

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
            {/* Visitor icon (opens Visitors tab) */}
            <TouchableOpacity
              style={styles.iconBtn}
              accessible
              accessibilityLabel="Visitors"
              onPress={() => setTab('visitors')}
            >
              <Ionicons name="eye-outline" size={20} />
            </TouchableOpacity>
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
                <TouchableOpacity style={styles.quickBtn} onPress={() => setTab('staff')}>
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Staff</Text>
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
        {/* When admin selects Staff tab, render the Staff page immediately under the header
            and collapse the normal mainContent so the staff UI starts at the top. */}
        {tab === 'staff' && (
          <View style={{ paddingVertical: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: isMobile ? 6 : 0,
                marginBottom: 8,
              }}
            >
              <Text style={styles.sectionTitle}>Staff</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => {
                    setStaffRefreshKey((k) => k + 1);
                    fetchBuildings();
                  }}
                >
                  <Text style={{ color: '#fff' }}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Controls: search + add placed directly under header */}
            <View style={{ paddingHorizontal: isMobile ? 6 : 0, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  placeholder="Search staff by name, phone or type"
                  value={staffQuery}
                  onChangeText={setStaffQuery}
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                />
                <TouchableOpacity
                  style={[styles.smallBtn, { paddingHorizontal: 12, paddingVertical: 8 }]}
                  onPress={() => setStaffAddVisible((s) => !s)}
                >
                  <Text style={{ color: '#fff' }}>{staffAddVisible ? 'Close' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <StaffManagement
              buildings={uniqueBuildings}
              hideControls={true}
              externalQuery={staffQuery}
              refreshKey={staffRefreshKey}
              addVisible={staffAddVisible}
              onAddToggle={setStaffAddVisible}
            />
          </View>
        )}

        <View
          style={[styles.mainContent, tab === 'staff' ? { height: 0, overflow: 'hidden' } : {}]}
        >
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
                {/* Visitor icon (opens Visitors tab) */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  accessible
                  accessibilityLabel="Visitors"
                  onPress={() => setTab('visitors')}
                >
                  <Ionicons name="eye-outline" size={20} />
                </TouchableOpacity>
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

          {/* Wing Analytics - show only on the Dashboard tab */}
          {tab === 'dashboard' && (
            <View style={{ marginTop: 12, paddingHorizontal: isMobile ? 6 : 0 }}>
              <Text style={styles.sectionTitle}>Wing Analytics</Text>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {uniqueBuildings.map((b, i) => (
                    <TouchableOpacity
                      key={`wing-${b.id}-${i}`}
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
              <View
                style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, elevation: 1 }}
              >
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
                        <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                          {b.key}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={{ flex: 1, paddingBottom: 48 }}>
            {tab === 'dashboard' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 8, paddingBottom: 96 }}
              >
                {/* {lastApiError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>API Error: {lastApiError}</Text>
                  </View>
                ) : null} */}

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

                    {/* Add Staff quick action - opens Staff page */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={() => setTab('staff')}
                    >
                      <Ionicons name="person-add" size={16} />
                      <Text style={styles.actionBtnText}>Add Staff</Text>
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

                    {/* Cameras quick action */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 },
                      ]}
                      onPress={() => setTab('cameras')}
                    >
                      <Ionicons name="videocam" size={16} />
                      <Text style={styles.actionBtnText}>Cameras</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
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
                <View
                  style={[
                    styles.rowBetween,
                    {
                      paddingHorizontal: isMobile ? 6 : 0,
                      // stack controls on narrow screens to avoid overlap
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'flex-start' : 'center',
                    },
                  ]}
                >
                  {/* Ensure the search row fills width on mobile so input + button are not squeezed */}
                  <View
                    style={{
                      width: isMobile ? '100%' : undefined,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TextInput
                      placeholder="Search name or phone"
                      value={q}
                      onChangeText={setQ}
                      style={[styles.search, { marginRight: 8 }]}
                      returnKeyType="search"
                      onSubmitEditing={searchUsers}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
                      <Text style={styles.searchBtnText}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Filters: wings / flats selector - ensure it sits below the search controls and wraps on small screens */}
                <View style={{ marginTop: 8, paddingHorizontal: isMobile ? 6 : 0 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'center', paddingVertical: 6 }}
                  >
                    {uniqueBuildings.map((b, i) => (
                      <TouchableOpacity
                        key={`filter-${b.id}-${i}`}
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
                {/* this has been moved to assign flow only */}
                {/* <View
                  style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: isMobile ? 6 : 0 }}
                >
                  <Button title="Add Owner/Tenant" onPress={() => setShowUserModal(true)} />
                </View> */}
                <FlatList
                  data={users}
                  keyExtractor={(w: any) => w.id}
                  contentContainerStyle={{ paddingBottom: 96, paddingTop: 8 }}
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
                                {(flat.users || []).map((user: any, ui: number) => {
                                  const avatarUri =
                                    user?.avatar ||
                                    user?.image ||
                                    user?.photo ||
                                    user?.profile_pic ||
                                    user?.image_url ||
                                    null;
                                  const isActiveUser = Boolean(
                                    user?.active ||
                                      user?.is_active ||
                                      user?.status === 'active' ||
                                      (user?.agreements && user.agreements.length > 0)
                                  );
                                  const initials = (user?.name || user?.phone || '')
                                    .split(' ')
                                    .map((p: string) => p[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();
                                  return (
                                    <View
                                      key={`${user.id || user.phone || 'u'}-${ui}`}
                                      style={styles.userItemContainer}
                                    >
                                      <TouchableOpacity
                                        style={styles.userItem}
                                        onPress={() => openUserDetail(user)}
                                      >
                                        <View style={styles.userAvatarWrap}>
                                          {avatarUri ? (
                                            <Image
                                              source={{ uri: avatarUri }}
                                              style={styles.userAvatar}
                                            />
                                          ) : (
                                            <View
                                              style={[styles.userAvatar, styles.userAvatarFallback]}
                                            >
                                              <Text style={{ color: '#374151', fontWeight: '700' }}>
                                                {initials}
                                              </Text>
                                            </View>
                                          )}
                                          {isActiveUser ? <View style={styles.activeDot} /> : null}
                                        </View>

                                        <View style={styles.userInfo}>
                                          <Text style={styles.userName}>
                                            {user.name || user.phone}
                                          </Text>
                                          <Text style={styles.userRole}>
                                            {user.role} • {user.phone}
                                          </Text>
                                        </View>
                                        <Ionicons
                                          name="chevron-forward"
                                          size={18}
                                          color="#9CA3AF"
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          ))}
                      </View>
                    );
                  }}
                />
              </View>
            )}

            {tab === 'profile' && (
              <View style={{ paddingVertical: 8 }}>
                <AdminProfile
                  user={user}
                  onLogout={onLogout}
                  userAvatar={userAvatar}
                  setUserAvatar={setUserAvatar}
                  setUser={setUser}
                />
              </View>
            )}

            {tab === 'visitors' && (
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <VisitorsScreen />
              </View>
            )}

            {tab === 'cameras' && (
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <CamerasScreen />
              </View>
            )}

            {tab === 'maintenance' && (
              <View style={{ paddingVertical: 8 }}>
                {maintenanceLoading ? (
                  <ActivityIndicator style={{ marginTop: 12 }} />
                ) : (
                  <FlatList
                    data={(maintenanceGroups || []).sort(
                      (a: any, b: any) => (b.unpaidAmount || 0) - (a.unpaidAmount || 0)
                    )}
                    keyExtractor={(g: any) => String(g.id || g.name)}
                    contentContainerStyle={{ paddingBottom: 96 }}
                    ListHeaderComponent={() => (
                      <View
                        style={{
                          paddingBottom: 8,
                          paddingHorizontal: isMobile ? 6 : 0,
                        }}
                      >
                        <View
                          style={[
                            styles.rowBetween,
                            {
                              // stack controls on narrow screens to avoid overlap
                              flexDirection: isMobile ? 'column' : 'row',
                              alignItems: isMobile ? 'flex-start' : 'center',
                            },
                          ]}
                        >
                          <View
                            style={{
                              width: isMobile ? '100%' : undefined,
                              marginRight: isMobile ? 0 : 8,
                            }}
                          >
                            <Text style={styles.sectionTitle}>Maintenance Settings</Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Text style={{ color: '#6b7280', marginRight: 8 }}>
                                Monthly amount: ₹
                              </Text>
                              <TextInput
                                value={maintenanceEditAmount}
                                onChangeText={setMaintenanceEditAmount}
                                keyboardType="numeric"
                                style={[styles.input, { width: 140, paddingVertical: 6 }]}
                                placeholder="0"
                              />
                              <View style={{ width: 8 }} />
                              <TouchableOpacity
                                style={[styles.smallBtn, { marginTop: 6 }]}
                                onPress={() => {
                                  const v = Number(
                                    (maintenanceEditAmount || '').replace(/[^0-9.-]/g, '')
                                  );
                                  if (Number.isNaN(v)) return alert('Enter a valid amount');
                                  saveMaintenanceSetting(v);
                                }}
                              >
                                <Text style={{ color: '#fff' }}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <View
                            style={{
                              width: isMobile ? '100%' : undefined,
                              marginTop: isMobile ? 8 : 0,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: isMobile ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: '#1e90ff' }]}
                                onPress={() => setShowGenerateConfirm(true)}
                              >
                                <Text style={{ color: '#fff' }}>Generate</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <Text style={styles.sectionTitle}>Monthly Maintenance - Owners</Text>
                        </View>
                      </View>
                    )}
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
                              // Open the Verify Payment modal directly with proofs for this owner
                              const raw = (item.bills || []).slice();
                              const base =
                                (api.defaults && (api.defaults as any).baseURL) || defaultBaseUrl();
                              const proofs = raw
                                .map((x: any) => {
                                  const url =
                                    x.payment_proof_url || x.file_url || x.proof_url || x.url;
                                  if (!url) return null;
                                  const resolved = /^https?:\/\//i.test(String(url))
                                    ? String(url)
                                    : `${String(base).replace(/\/$/, '')}/${String(url).replace(
                                        /^\//,
                                        ''
                                      )}`;
                                  return {
                                    id: x.id || x._id || x.billId,
                                    title: x.title || x.name || 'Maintenance',
                                    description: x.description || '',
                                    cost: x.cost || x.amount || 0,
                                    payment_proof_url: resolved,
                                    raw: x,
                                  };
                                })
                                .filter(Boolean) as any[];

                              // Set the proofOverview state so the existing Verify Payment modal appears
                              setProofOverview({ owner: item, proofs });
                            }}
                          >
                            <Text style={{ color: '#fff' }}>Actions</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  />
                )}
              </View>
            )}
          </View>
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
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => {
                    setTab('staff');
                    setShowSidebar(false);
                  }}
                >
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Staff</Text>
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

      {/* Image preview is rendered inside the User Detail modal so it appears above the form. */}

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
              {uniqueBuildings.map((b, i) => (
                <TouchableOpacity
                  key={`notice-${b.id}-${i}`}
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

      {/* BottomTab moved to App.tsx — AdminScreen syncs with BottomTabContext */}

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
      {/* Profile page is now a full screen tab rendered when tab === 'profile' */}

      {/* Assign Owner/Tenant multi-step modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Assign Owner / Tenant</Text>
            {assignStep === 1 && (
              <>
                <Text style={styles.label}>Select Wing</Text>
                <FlatList
                  data={uniqueBuildings}
                  horizontal
                  keyExtractor={(b: any, idx: number) => `${b.id || idx}-${idx}`}
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
            <View>
              <Text style={styles.modalTitle}>{detailUser?.user?.name || 'User'}</Text>
              <Text style={styles.label}>Phone: {detailUser?.user?.phone}</Text>

              {/* Rent Agreement - show only the latest agreement (no raw URL) */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <Text style={[styles.label, { marginBottom: 0 }]}>Rent Agreement</Text>
                {latestAgreement ? (
                  <TouchableOpacity
                    style={[styles.actionBtnOutline, { minWidth: 96 }]}
                    onPress={() =>
                      openOrDownloadAgreement(
                        latestAgreement.file_url ||
                          latestAgreement.fileUrl ||
                          latestAgreement.url ||
                          latestAgreement.path
                      )
                    }
                  >
                    <Ionicons name="eye-outline" size={18} color="#374151" />
                    <Text style={[styles.actionBtnOutlineText, { marginLeft: 8 }]}>Open</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
              </View>

              {/* <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Documents</Text> */}
              <FlatList
                data={detailUser?.documents || []}
                keyExtractor={(d: any) => d.id}
                renderItem={({ item }) => {
                  // Skip rendering Aadhaar/PAN entries here — we show dedicated View buttons below
                  if (
                    item.file_url === aadhaarDoc?.file_url ||
                    item.file_url === panDoc?.file_url ||
                    (item.file_url && agreementUrls.has(item.file_url))
                  ) {
                    return null;
                  }

                  return (
                    <View
                      style={{
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{item.title || item.file_type}</Text>
                        {item.description ? (
                          <Text style={styles.listSub} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      {item.file_url ? (
                        <TouchableOpacity
                          style={[styles.actionBtnOutline, { marginLeft: 12 }]}
                          onPress={() => viewDocument(item.file_url)}
                        >
                          <Ionicons name="eye-outline" size={16} color="#374151" />
                          <Text style={[styles.actionBtnOutlineText, { marginLeft: 8 }]}>Open</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }}
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
                    disabled={uploadingAadhaar}
                  >
                    {uploadingAadhaar ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={16} />
                        <Text style={[styles.actionBtnText, { marginLeft: 8 }]}>
                          Upload Aadhaar Card
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 8 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { paddingVertical: 8, paddingHorizontal: 12 }]}
                    onPress={() => pickAndUploadFile('PAN Card')}
                    disabled={uploadingPan}
                  >
                    {uploadingPan ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={16} />
                        <Text style={[styles.actionBtnText, { marginLeft: 8 }]}>
                          Upload PAN Card
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Dedicated view buttons for Aadhaar / PAN (show when respective docs exist) */}
                <View
                  style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {aadhaarDoc ? (
                    <TouchableOpacity
                      style={[styles.actionBtnOutline, styles.docViewBtn]}
                      onPress={() => viewDocument(aadhaarDoc.file_url)}
                    >
                      <Ionicons name="eye-outline" size={18} color="#374151" />
                      <Text style={[styles.actionBtnOutlineText, { marginLeft: 8 }]}>
                        View Aadhaar Card
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {panDoc ? (
                    <TouchableOpacity
                      style={[styles.actionBtnOutline, styles.docViewBtn]}
                      onPress={() => viewDocument(panDoc.file_url)}
                    >
                      <Ionicons name="eye-outline" size={18} color="#374151" />
                      <Text style={[styles.actionBtnOutlineText, { marginLeft: 8 }]}>
                        View PAN Card
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Agreements are shown in the Rent Agreement section above (only latest is exposed). */}
                </View>
              </View>

              {uploadProgress !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginLeft: 8 }}>{uploadProgress}%</Text>
                </View>
              )}

              {/* Agreements are surfaced as View/Download buttons above. Raw URLs are hidden. */}

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Button
                  title="Save"
                  onPress={async () => {
                    try {
                      // Client-side validation to avoid sending incomplete requests
                      const missing: string[] = [];
                      if (!agrFlatId) missing.push('flatId');
                      if (!detailUser?.user?.id) missing.push('ownerId');
                      if (!agrTenantId) missing.push('tenantId');
                      if (!agrUrl) missing.push('file_url');
                      if (missing.length) return alert('Please provide: ' + missing.join(', '));

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
                      alert('Save failed');
                    }
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button title="Close" onPress={() => setShowUserDetail(false)} />
              </View>
            </View>

            {/* Inline preview overlay: appears above the form inside the same modal */}
            {showPreviewModal && (
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  right: 12,
                  bottom: 12,
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {previewImageUrl ? (
                  <Image
                    source={{ uri: previewImageUrl }}
                    style={{
                      width: '100%',
                      height: '80%',
                      resizeMode: 'contain',
                      backgroundColor: '#000',
                    }}
                  />
                ) : (
                  <Text style={{ color: '#fff' }}>No preview available</Text>
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
            )}
          </View>
        </View>
      </Modal>

      {/* Proof overview modal: lists payment_proof_url items for an owner */}
      <Modal visible={!!proofOverview} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: 520 }]}>
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Verify Payment</Text>
            {(proofOverview?.proofs || []).length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#666' }}>No proofs available.</Text>
              </View>
            ) : (
              (() => {
                const p = (proofOverview?.proofs || [])[0];
                return (
                  <View>
                    <Text style={{ fontWeight: '700' }}>{p.title || 'Maintenance'}</Text>
                    <Text style={{ color: '#666', marginBottom: 8 }}>{p.description || ''}</Text>
                    <Text style={{ marginBottom: 8 }}>Amount: ₹{p.cost || ''}</Text>

                    {p.payment_proof_url ? (
                      <Image
                        source={{ uri: String(p.payment_proof_url) } as any}
                        style={{ width: '100%', height: 220, borderRadius: 8, marginBottom: 12 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={{ padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                        <Text style={{ color: '#666' }}>No proof attached.</Text>
                      </View>
                    )}

                    <View
                      style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}
                    >
                      <TouchableOpacity
                        style={[styles.smallBtn, { marginRight: 8 }]}
                        onPress={() => setProofOverview(null)}
                      >
                        <Text style={{ color: '#fff' }}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={async () => {
                          try {
                            const billId = p && (p.id || p.billId || p._id);
                            if (!billId) throw new Error('bill id not found');
                            await adminVerifyBill(String(billId), 'approve');
                            // refresh list
                            fetchMaintenanceFees(maintenanceMonth || undefined, 'all');
                            setProofOverview(null);
                            Alert.alert('Bill marked as paid');
                          } catch (e) {
                            console.warn('admin mark paid failed', e);
                            Alert.alert('Failed to mark as paid');
                          }
                        }}
                      >
                        <Text style={{ color: '#fff' }}>Mark as Paid</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()
            )}
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
              data={uniqueBuildings}
              horizontal
              keyExtractor={(b: any, idx: number) => `${b.id || idx}-${idx}`}
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
  userAvatarWrap: {
    width: 36,
    height: 36,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    resizeMode: 'cover',
    backgroundColor: '#E5E7EB',
  },
  userAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
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
  searchBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
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

  // document view buttons inside user detail modal
  docViewBtn: {
    marginRight: 8,
    marginBottom: 8,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: { backgroundColor: '#fff6f6', padding: 8, borderRadius: 8 },
  errorText: { color: palette.danger },

  // mobile drawer
  mobileDrawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  mobileDrawer: { width: '78%', height: '100%', backgroundColor: palette.primary, paddingTop: 36 },
});
