import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
// Use dynamic require for DateTimePicker to avoid build-time type errors when package isn't installed
import { Ionicons } from '@expo/vector-icons';
// BottomTab removed for OwnerScreen (we render an inline bottom bar here)
import ProfileCard from '../components/ProfileCard';
// Use the legacy expo-file-system API to retain readAsStringAsync/EncodingType helpers
// The modern filesystem API uses File/Directory classes; migrating is possible but larger.
import * as FileSystem from 'expo-file-system/legacy';
import api, { setAuthHeader, attachErrorHandler } from '../services/api';
// WebView for in-app PDF rendering on native
// attempt to require WebView optionally at runtime on native only.
// We avoid a static require so the web bundler doesn't try to resolve the module.
let WebView: any = null;
try {
  if (Platform && Platform.OS !== 'web') {
    // use eval('require') to prevent bundlers from statically resolving the module
    const _req: any = eval('require');
    WebView = _req('react-native-webview')?.WebView || null;
  }
} catch (e) {
  WebView = null;
  console.warn('[OwnerScreen] react-native-webview not available; in-app PDF viewing disabled');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wp, hp, useWindowSize } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';

type Props = {
  user: any;
  onLogout: () => void;
  openAddRequested?: boolean;
  onOpenHandled?: () => void;
};

// Sample data used for initial rendering and testing
const SAMPLE_TENANTS = [
  {
    id: 't1',
    name: 'Ravi Kumar',
    phone: '9777777777',
    address: 'A-101, Green Residency',
    gender: 'Male',
    family: [{ name: 'Sita', relation: 'Wife' }],
    moveIn: '2024-01-15',
    moveOut: null,
    rent: 12000,
    deposit: 36000,
    docs: [{ id: 'd1', name: 'Aadhaar.pdf', status: 'verified' }],
    status: 'active',
  },
  {
    id: 't2',
    name: 'Meera Joshi',
    phone: '9666666666',
    address: 'A-101, Green Residency',
    gender: 'Female',
    family: [],
    moveIn: '2022-05-01',
    moveOut: '2023-12-01',
    rent: 10000,
    deposit: 30000,
    docs: [],
    status: 'inactive',
  },
];

const SAMPLE_BILLS = [
  {
    id: 'm1',
    title: 'Water pump repair',
    description: 'Replace bearings',
    cost: 2500,
    date: '2025-10-01',
    status: 'pending',
  },
  {
    id: 'm2',
    title: 'Common area cleaning',
    description: 'Monthly cleaning',
    cost: 1200,
    date: '2025-09-15',
    status: 'completed',
  },
];

export default function OwnerScreen({ user, onLogout, openAddRequested, onOpenHandled }: Props) {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'tenants' | 'bills' | 'documents' | 'settings' | 'notices' | 'helplines'
  >('dashboard');
  // start with empty list; real data is fetched in useEffect via API
  const [tenants, setTenants] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>(SAMPLE_BILLS);
  const [myBills, setMyBills] = useState<any[]>([]); // bills assigned to this owner
  const [tenantBills, setTenantBills] = useState<any[]>([]); // bills raised by this owner
  // track which bottom nav item is selected for correct highlighting
  const [selectedBottom, setSelectedBottom] = useState<string>('dashboard');

  // Tenant modal state
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [showTenantConfirm, setShowTenantConfirm] = useState(false);
  const [editingPhoneError, setEditingPhoneError] = useState('');
  const [editingReadOnly, setEditingReadOnly] = useState(false);
  // Date picker state for move-in / move-out
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'moveIn' | 'moveOut' | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());

  function renderDatePicker() {
    if (!showDatePicker) return null;
    // On web we must not attempt to require native modules.
    if (Platform.OS === 'web') return null;
    let DatePicker: any = null;
    try {
      // use eval('require') to avoid static bundler resolution on web/webpack
      const _req: any = eval('require');
      DatePicker = _req('@react-native-community/datetimepicker');
    } catch (e) {
      DatePicker = null;
    }
    if (!DatePicker) return null;
    const initial =
      tempDate ||
      (datePickerField && editingTenant
        ? editingTenant[datePickerField]
          ? new Date(editingTenant[datePickerField])
          : new Date()
        : new Date());
    return (
      <DatePicker
        value={initial}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(ev: any, selectedDate: any) => {
          if (typeof selectedDate === 'undefined' || selectedDate === null) {
            setShowDatePicker(false);
            setDatePickerField(null);
            return;
          }
          const d = new Date(selectedDate);
          const iso = d.toISOString().slice(0, 10);
          setEditingTenant((s: any) => ({ ...s, [datePickerField as string]: iso }));
          setShowDatePicker(false);
          setDatePickerField(null);
        }}
      />
    );
  }
  // Fallback inline calendar when native DateTimePicker isn't present
  function renderInlineCalendar() {
    if (!showDatePicker) return null;
    const start =
      editingTenant && datePickerField && editingTenant[datePickerField]
        ? new Date(editingTenant[datePickerField])
        : new Date();
    // ensure calendar state reflects selected field when opening
    // (set by effect when picker opens)
    const calMonth = calendarMonth;
    const calYear = calendarYear;

    const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0..6
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const selectDate = (day: number) => {
      const d = new Date(calYear, calMonth, day);
      const iso = d.toISOString().slice(0, 10);
      setEditingTenant((s: any) => ({ ...s, [datePickerField as string]: iso }));
      setShowDatePicker(false);
      setDatePickerField(null);
    };

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => {
              if (calMonth === 0) {
                setCalendarMonth(11);
                setCalendarYear((y) => y - 1);
              } else setCalendarMonth((m) => m - 1);
            }}
          >
            <Text style={styles.calendarNav}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {new Date(calYear, calMonth).toLocaleString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (calMonth === 11) {
                setCalendarMonth(0);
                setCalendarYear((y) => y + 1);
              } else setCalendarMonth((m) => m + 1);
            }}
          >
            <Text style={styles.calendarNav}>{'›'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((h) => (
            <Text key={h} style={styles.calendarWeekday}>
              {h}
            </Text>
          ))}
          {days.map((day, idx) =>
            day === null ? (
              <View key={'empty-' + idx} style={styles.calendarCell} />
            ) : (
              <TouchableOpacity
                key={day}
                style={styles.calendarCell}
                onPress={() => selectDate(day as number)}
              >
                <Text style={styles.calendarDayText}>{String(day)}</Text>
              </TouchableOpacity>
            )
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => {
              setShowDatePicker(false);
              setDatePickerField(null);
            }}
            style={styles.smallBtn}
          >
            <Text style={{ color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  // per-tenant loading map for status toggles
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  // confirmation modal for status change
  const [confirmAction, setConfirmAction] = useState<{
    tenant: any;
    targetStatus: 'active' | 'inactive';
  } | null>(null);

  // Document upload state
  const [propertyDocs, setPropertyDocs] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTargetUrl, setPreviewTargetUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingPropertyDoc, setUploadingPropertyDoc] = useState(false);
  const [uploadingProof, setUploadingProof] = useState<Record<string, boolean>>({});
  // Owner-side verify modal state: when a tenant bill has payment_pending, owner can preview & verify
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyBill, setVerifyBill] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [selectedProofs, setSelectedProofs] = useState<Record<string, string>>({});
  const [billsView, setBillsView] = useState<'tenant' | 'my'>('tenant');
  const [deletingTenantField, setDeletingTenantField] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [flats, setFlats] = useState<any[]>([]);
  // Tenant / filter UI state
  const [tenantQ, setTenantQ] = useState('');
  const [tenantFilter, setTenantFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [noticesList, setNoticesList] = useState<any[]>([]);
  const [showNoticesModal, setShowNoticesModal] = useState(false);
  // Helplines state (missing previously and caused ReferenceError when OwnerScreen referenced showHelplineModal)
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [helplineName, setHelplineName] = useState('');
  const [helplinePhone, setHelplinePhone] = useState('');
  // Owner-level complaint & bills modals
  const [showOwnerComplaintModal, setShowOwnerComplaintModal] = useState(false);
  const [ownerComplaintForm, setOwnerComplaintForm] = useState({
    title: '',
    description: '',
    image: '',
  });
  const [showOwnerBillsModal, setShowOwnerBillsModal] = useState(false);
  const [ownerBillForm, setOwnerBillForm] = useState({
    tenantId: '',
    type: 'rent',
    amount: '',
    description: '',
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(
    (user as any)?.avatar || (user as any)?.image
  );
  // Local editable owner profile state (so owner can edit and save their details)
  const [ownerProfile, setOwnerProfile] = useState<any>({
    name: (user as any)?.name || '',
    phone: (user as any)?.phone || (user as any)?.mobile_number || '',
    email: (user as any)?.email || '',
    address: (user as any)?.address || '',
    emergency_contact: (user as any)?.emergency_contact || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    // keep local editable profile in sync when parent `user` prop changes
    setOwnerProfile({
      name: (user as any)?.name || '',
      phone: (user as any)?.phone || (user as any)?.mobile_number || '',
      email: (user as any)?.email || '',
      address: (user as any)?.address || '',
      emergency_contact: (user as any)?.emergency_contact || '',
    });
  }, [user]);

  // Derived tenant lists / due map
  const filteredTenants = useMemo(() => {
    let list = (tenants || []).slice();
    if (tenantFilter === 'active') list = list.filter((t) => t.status === 'active');
    if (tenantFilter === 'inactive') list = list.filter((t) => t.status !== 'active');
    if (tenantQ && String(tenantQ).trim()) {
      const q = String(tenantQ).toLowerCase();
      list = list.filter(
        (t) => (t.name || '').toString().toLowerCase().includes(q) || (t.phone || '').includes(q)
      );
    }
    return list;
  }, [tenants, tenantFilter, tenantQ]);

  const activeTenants = useMemo(
    () => filteredTenants.filter((t) => t.status === 'active'),
    [filteredTenants]
  );
  const inactiveTenants = useMemo(
    () => filteredTenants.filter((t) => t.status !== 'active'),
    [filteredTenants]
  );

  const tenantDueMap = useMemo(() => {
    const map: Record<string, number> = {};
    const allBills = [...(tenantBills || []), ...(myBills || [])];
    (allBills || []).forEach((b: any) => {
      const tid = b.tenantId || (b.tenant && b.tenant.id);
      if (!tid) return;
      const closed = String(b.status || '').toLowerCase() === 'closed';
      if (closed) return;
      map[tid] = (map[tid] || 0) + (Number(b.cost) || 0);
    });
    return map;
  }, [tenantBills, myBills]);

  // helper to open preview: on web open in new tab for reliability, on native show inline modal
  function handlePreview(url?: string | null) {
    if (!url) return;
    // simple helpers to detect content type by URL / data URL
    const isImage = (u: string) =>
      /^(data:image\/|.*\.(png|jpg|jpeg|gif|bmp|webp)(\?.*)?$)/i.test(u);
    const isPdf = (u: string) => /^(data:application\/pdf)|.*\.(pdf)(\?.*)?$/i.test(u);
    const isHtmlData = (u: string) => /^data:text\/html/i.test(u);

    async function openExternal(u: string) {
      try {
        // handle data:application/pdf on native by writing to file and opening it
        if (isPdf(u) && u.startsWith('data:application/pdf') && Platform.OS !== 'web') {
          try {
            const base64 = u.replace(/^data:application\/pdf;base64,/, '');
            const fname = `agreement_${Date.now()}.pdf`;
            const fileUri = FileSystem.cacheDirectory + fname;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await Linking.openURL(fileUri);
            return true;
          } catch (e) {
            console.warn('openExternal: write/open pdf failed', e);
          }
        }

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            window.open(u, '_blank');
            return true;
          } catch (e) {
            console.warn('openExternal window.open failed', e);
          }
        }

        try {
          await Linking.openURL(u);
          return true;
        } catch (e) {
          console.warn('openExternal Linking.openURL failed', e);
        }
      } catch (e) {
        console.warn('openExternal unexpected error', e);
      }
      return false;
    }

    (async () => {
      try {
        // If it's an image we can show inline in the modal
        if (isImage(url)) {
          setPreviewImageUrl(url);
          setPreviewTargetUrl(null);
          setShowPreviewModal(true);
          return;
        }

        // Try to open externally for non-image content (PDF/HTML/raw)
        const opened = await openExternal(url);
        if (opened) return;

        // If we couldn't open, show the modal with an "Open" button that retries
        setPreviewImageUrl(null);
        setPreviewTargetUrl(url);
        setShowPreviewModal(true);
      } catch (e) {
        console.warn('handlePreview failed', e);
      }
    })();
  }

  // Download agreement PDF (web + native). Attempts to save the file and open it.
  async function downloadAgreement(url?: string | null) {
    if (!url) return;
    const filename = `rent_agreement_${Date.now()}.pdf`;
    try {
      if (Platform.OS === 'web') {
        // For web, fetch and trigger a download via blob
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
          return;
        } catch (e) {
          console.warn('[downloadAgreement] web fetch/download failed, trying open', e);
          try {
            window.open(url, '_blank');
            return;
          } catch (ee) {
            console.warn('[downloadAgreement] window.open failed', ee);
          }
        }
      }

      // Native (expo): handle data:application/pdf or remote urls
      if (url.startsWith('data:application/pdf')) {
        const base64 = url.split(',')[1];
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        try {
          await Linking.openURL(fileUri);
        } catch (e) {
          console.warn('[downloadAgreement] open file failed', e);
        }
        Alert.alert('Downloaded', `Saved to ${fileUri}`);
        return;
      }

      // remote http(s) url: download to documentDirectory
      try {
        const fileUri = FileSystem.documentDirectory + filename;
        const dl = await FileSystem.downloadAsync(url, fileUri);
        try {
          await Linking.openURL(dl.uri);
        } catch (e) {
          console.warn('[downloadAgreement] open downloaded file failed', e);
        }
        Alert.alert('Downloaded', `Saved to ${dl.uri}`);
        return;
      } catch (e) {
        console.warn('[downloadAgreement] downloadAsync failed', e);
        // fallback: attempt to open URL externally
        try {
          await Linking.openURL(url);
          return;
        } catch (ee) {
          console.warn('[downloadAgreement] fallback openURL failed', ee);
        }
      }
    } catch (e) {
      console.warn('downloadAgreement failed', e);
      try {
        Alert.alert('Download failed', String(e));
      } catch (ee) {}
    }
  }

  const stats = useMemo(
    () => ({
      totalTenants: tenants.length,
      active: tenants.filter((t) => t.status === 'active').length,
      previous: tenants.filter((t) => t.status !== 'active').length,
      // show total outstanding amount (sum of open/payment_pending bills)
      billsAmount: bills
        .filter((b) => !b || !b.status || String(b.status).toLowerCase() !== 'closed')
        .reduce((s: number, b: any) => s + (Number(b.cost) || 0), 0),
      documents: propertyDocs.length,
    }),
    [tenants, bills, propertyDocs]
  );

  // Responsive breakpoints (reactive)
  const { width, height } = useWindowSize();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const isMobile = width < 600;
  const insets = useSafeAreaInsets();

  // derive society and flat/wing display values for header
  const societyName =
    (user &&
      (user.society?.name ||
        user.building?.name ||
        user.societyName ||
        (user.adminSocieties && user.adminSocieties[0]?.name))) ||
    'Society';
  const wingFlat = (() => {
    if (!user) return '';
    if (!(user.role === 'tenant' || user.role === 'owner')) return '';
    const wing = user.wing?.name || user.building?.name || user.buildingName || user.wing || '';
    const flat = user.flat?.flat_no || user.flat_no || user.flatNo || '';
    const parts: string[] = [];
    if (wing) parts.push(String(wing));
    if (flat) parts.push(String(flat));
    return parts.join(' / ');
  })();

  async function pickPropertyDoc() {
    try {
      setUploadingPropertyDoc(true);
      const url = await pickAndUploadFile({ accept: '*/*', fallbackApiPath: '/api/owner/upload' });
      if (!url) return;
      const newDoc = {
        id: String(Date.now()),
        name: String(new Date().getTime()),
        uri: url,
        file_url: url,
        uploadedAt: new Date().toISOString(),
      } as any;
      setPropertyDocs((s) => [newDoc, ...s]);
      try {
        // create document record
        await api.post('/api/owner/documents', {
          title: newDoc.name,
          file_url: url,
          file_type: 'application/octet-stream',
        });
      } catch (e: any) {
        console.warn(
          'create document record failed',
          e && ((e as any).response?.data || e.message)
        );
      }
    } catch (e: any) {
      console.warn('pick property doc failed', e && ((e as any).response?.data || e.message));
    } finally {
      setUploadingPropertyDoc(false);
    }
  }

  // helper: upload property/doc with a friendly tag title (Aadhaar/PAN)
  async function uploadPropertyDocAs(tagTitle: string) {
    try {
      setUploadingPropertyDoc(true);
      const url = await pickAndUploadFile({ accept: '*/*', fallbackApiPath: '/api/owner/upload' });
      if (!url) return;
      const newDoc = {
        id: String(Date.now()),
        name: tagTitle,
        uri: url,
        file_url: url,
        uploadedAt: new Date().toISOString(),
      } as any;
      setPropertyDocs((s) => [newDoc, ...(s || [])]);
      try {
        await api.post('/api/owner/documents', {
          title: tagTitle,
          file_url: url,
          file_type: 'application/octet-stream',
        });
      } catch (e: any) {
        console.warn(
          'create document record failed',
          e && ((e as any).response?.data || e.message)
        );
      }
    } catch (e: any) {
      console.warn('uploadPropertyDocAs failed', e);
    } finally {
      setUploadingPropertyDoc(false);
    }
  }

  // upload a picked image/file and return the uploaded URL (used by owner complaint/bill attachments)
  async function uploadFileAndGetUrl(uri: string, filename?: string) {
    try {
      // read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const dataUrl = `data:application/octet-stream;base64,${base64}`;
      const up = await api.post('/api/owner/upload', { dataUrl, filename: filename || 'file' });
      return up.data && (up.data.url || up.data.file_url);
    } catch (e) {
      console.warn('uploadFileAndGetUrl failed', e);
      return uri; // fallback to local uri
    }
  }

  // Robust multipart + JSON fallback uploader for local URIs
  async function uploadLocalUri(uri: string, filename?: string) {
    try {
      // build multipart formdata
      const formData: any = new FormData();
      try {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append('file', blob, filename || 'file');
      } catch (e) {
        // if fetch->blob fails (some local URIs), fallback to RN object
        formData.append('file', {
          uri,
          name: filename || 'file',
          type: 'application/octet-stream',
        } as any);
      }

      const base = (api.defaults && (api.defaults as any).baseURL) || '';
      if (!base) {
        console.warn('uploadLocalUri: api baseURL not set');
      }
      const uploadUrl = `${String(base).replace(/\/$/, '')}/api/upload_form`;
      let token: string | null = null;
      try {
        token = await AsyncStorage.getItem('token');
      } catch (ee) {}
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        console.debug('[uploadLocalUri] multipart uploadUrl=', uploadUrl);
        const r = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
        const text = await r.text().catch(() => '');
        let jd: any = {};
        try {
          jd = text ? JSON.parse(text) : {};
        } catch (e) {
          jd = { raw: text };
        }
        console.debug('[uploadLocalUri] multipart response status=', r.status, 'body=', jd);
        if (r.ok && jd && (jd.url || jd.file_url)) return jd.url || jd.file_url;
      } catch (e) {
        console.warn('[uploadLocalUri] multipart fetch failed', e);
      }

      // Fallback to base64 JSON upload
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const dataUrl = `data:application/octet-stream;base64,${base64}`;
        const uploadJsonUrl = uploadUrl.replace(/\/api\/upload_form$/, '/api/upload');
        const upHeaders: any = { 'Content-Type': 'application/json' };
        if (token) upHeaders.Authorization = `Bearer ${token}`;
        console.debug('[uploadLocalUri] attempting base64 fallback to', uploadJsonUrl);
        const r2 = await fetch(uploadJsonUrl, {
          method: 'POST',
          headers: upHeaders,
          body: JSON.stringify({ dataUrl, filename }),
        });
        const text2 = await r2.text().catch(() => '');
        let j2: any = {};
        try {
          j2 = text2 ? JSON.parse(text2) : {};
        } catch (e) {
          j2 = { raw: text2 };
        }
        console.debug('[uploadLocalUri] base64 fallback status=', r2.status, 'body=', j2);
        if (r2.ok && j2 && (j2.url || j2.file_url)) return j2.url || j2.file_url;
      } catch (e) {
        console.warn('[uploadLocalUri] base64 fallback failed', e);
      }
    } catch (e) {
      console.warn('uploadLocalUri unexpected error', e);
    }
    return null;
  }

  function openAddTenant(t?: any) {
    // normalize incoming tenant shape from API if present
    if (t) {
      // if caller provided history (agreements/documents), attach it so we don't re-fetch
      const client = clientShapeFromApi(t);
      if (t.history) client.history = t.history;
      else if (t.agreement || t.documents)
        client.history = {
          agreements: t.agreement ? [t.agreement] : [],
          documents: t.documents || [],
        };
      setEditingTenant(client);
      setEditingPhoneError('');
      setEditingReadOnly((t && t.status) === 'inactive');
      // fetch tenant history (agreements + documents) for owner view
      if (!t.history && !t.agreement && !t.documents) {
        (async () => {
          try {
            const r = await api.get(`/api/owner/tenants/${t.id}/history`);
            const hist = r.data || {};
            setEditingTenant((s: any) => ({ ...s, history: hist }));
          } catch (err) {
            // ignore history errors (older tenants may not have history)
            console.warn(
              'failed to load tenant history',
              err && ((err as any).response?.data || (err as any).message || err)
            );
          }
        })();
      }
    } else {
      setEditingTenant({
        id: null,
        name: '',
        phone: '',
        address: '',
        gender: '',
        family: [],
        moveIn: '',
        moveOut: '',
        rent: 0,
        deposit: 0,
        docs: [],
        status: 'active',
      });
      setEditingPhoneError('');
      setEditingReadOnly(false);
    }
    setShowTenantModal(true);
  }

  // If parent requests OwnerScreen to open the Add Tenant modal, respond to that.
  useEffect(() => {
    if (openAddRequested) {
      try {
        openAddTenant();
        if (onOpenHandled) onOpenHandled();
      } catch (e) {
        /* ignore */
      }
    }
  }, [openAddRequested]);

  function mapTenantForApi(t: any) {
    return {
      name: t.name,
      phone: t.phone,
      address: t.address,
      witness1: t.witness1 || undefined,
      witness2: t.witness2 || undefined,
      gender: t.gender ? String(t.gender).toLowerCase() : null,
      move_in: t.moveIn ? new Date(t.moveIn).toISOString() : null,
      // move_out intentionally omitted per new UX
      rent: t.rent ? Number(t.rent) : null,
      deposit: t.deposit ? Number(t.deposit) : null,
      aadhaar_url: t.aadhaar_url || undefined,
      pan_url: t.pan_url || undefined,
      family: Array.isArray(t.family)
        ? t.family
            .map((f: any) => ({ name: f && f.name ? String(f.name).trim() : '' }))
            .filter((f: any) => f.name)
        : undefined,
      flatId: t.flat && t.flat.id ? t.flat.id : undefined,
      status: t.status,
    };
  }

  function clientShapeFromApi(u: any) {
    return {
      ...u,
      moveIn: u.move_in ? new Date(u.move_in).toISOString().slice(0, 10) : '',
      moveOut: u.move_out ? new Date(u.move_out).toISOString().slice(0, 10) : '',
      rent: u.rent || 0,
      deposit: u.deposit || 0,
      gender: u.gender || '',
      status: u.status || 'active',
    };
  }

  function saveTenant(t: any) {
    (async () => {
      try {
        // Client-side validation: required fields
        const name = t && t.name ? String(t.name).trim() : '';
        const phone = t && t.phone ? String(t.phone).trim() : '';
        const address = t && t.address ? String(t.address).trim() : '';
        const gender = t && t.gender ? String(t.gender).trim() : '';
        const moveIn = t && t.moveIn ? String(t.moveIn).trim() : '';
        const rentVal = t && (t.rent || t.rent === 0) ? t.rent : null;
        const depositVal = t && (t.deposit || t.deposit === 0) ? t.deposit : null;

        if (
          !name ||
          !phone ||
          !address ||
          !gender ||
          !moveIn ||
          rentVal === null ||
          depositVal === null
        ) {
          Alert.alert('Validation', 'Please fill all required fields marked with *');
          return;
        }
        if (!/^[0-9]{10}$/.test(phone)) {
          setEditingPhoneError('Please enter a valid 10-digit mobile number');
          return;
        }

        if (!t.id) {
          const payload = mapTenantForApi(t);
          const r = await api.post('/api/owner/tenants', payload);
          const created = r.data && r.data.user;
          if (created) {
            const client = clientShapeFromApi(created);
            // attach any immediate history returned (older backend still returned agreement/docs)
            const agreement = r.data && r.data.agreement;
            const documents = r.data && r.data.documents;
            client.history = {
              agreements: agreement ? [agreement] : [],
              documents: Array.isArray(documents) ? documents : [],
            };
            // add to list and set editing tenant so modal stays open
            setTenants((s) => [client, ...s]);
            setEditingTenant(client);
            setEditingReadOnly((client && client.status) === 'inactive');

            // If a flat is assigned, trigger server-side agreement generation
            try {
              const flatId = payload.flatId;
              if (flatId) {
                const genBody: any = {
                  flatId,
                  move_in: payload.move_in,
                  rent: payload.rent,
                  deposit: payload.deposit,
                  witness1: payload.witness1,
                  witness2: payload.witness2,
                };
                const g = await api.post(
                  `/api/owner/tenants/${created.id}/generate-agreement`,
                  genBody
                );
                const genAgreement = g.data && g.data.agreement;
                const genDocuments = g.data && g.data.documents;
                // attach generated agreement/docs to tenant history so icons show immediately
                setEditingTenant((s: any) => ({
                  ...(s || {}),
                  history: {
                    agreements: genAgreement
                      ? [genAgreement]
                      : (s && s.history && s.history.agreements) || [],
                    documents: Array.isArray(genDocuments)
                      ? genDocuments
                      : (s && s.history && s.history.documents) || [],
                  },
                }));
                // update list entry too
                setTenants((list) =>
                  list.map((it) =>
                    it.id === client.id
                      ? {
                          ...it,
                          history: {
                            agreements: genAgreement
                              ? [genAgreement]
                              : (it.history && it.history.agreements) || [],
                            documents: Array.isArray(genDocuments)
                              ? genDocuments
                              : (it.history && it.history.documents) || [],
                          },
                        }
                      : it
                  )
                );
              }
            } catch (e: any) {
              console.warn(
                'generate-agreement (post-create) failed',
                e && (e.response?.data || e.message)
              );
            }
          }
        } else {
          const payload = mapTenantForApi(t);
          const r = await api.put(`/api/owner/tenants/${t.id}`, payload);
          const updated = r.data && r.data.user;
          if (updated) {
            const clientUpdated = clientShapeFromApi(updated);
            setTenants((s) => s.map((x) => (x.id === updated.id ? clientUpdated : x)));
            // If flatId provided in update, trigger agreement generation
            try {
              const flatId = payload.flatId;
              if (flatId) {
                const genBody: any = {
                  flatId,
                  move_in: payload.move_in || updated.move_in,
                  rent: payload.rent || updated.rent,
                  deposit: payload.deposit || updated.deposit,
                  witness1: t.witness1 || undefined,
                  witness2: t.witness2 || undefined,
                };
                const g = await api.post(
                  `/api/owner/tenants/${updated.id}/generate-agreement`,
                  genBody
                );
                const genAgreement = g.data && g.data.agreement;
                const genDocuments = g.data && g.data.documents;
                // update tenant in list with new history
                setTenants((list) =>
                  list.map((it) =>
                    it.id === updated.id
                      ? {
                          ...it,
                          history: {
                            agreements: genAgreement
                              ? [genAgreement]
                              : (it.history && it.history.agreements) || [],
                            documents: Array.isArray(genDocuments)
                              ? genDocuments
                              : (it.history && it.history.documents) || [],
                          },
                        }
                      : it
                  )
                );
                // if modal is open for this tenant, attach history
                setEditingTenant((s: any) =>
                  s && s.id === updated.id
                    ? {
                        ...clientUpdated,
                        history: {
                          agreements: genAgreement
                            ? [genAgreement]
                            : (s.history && s.history.agreements) || [],
                          documents: Array.isArray(genDocuments)
                            ? genDocuments
                            : (s.history && s.history.documents) || [],
                        },
                      }
                    : s
                );
              }
            } catch (e: any) {
              console.warn(
                'generate-agreement (post-update) failed',
                e && (e.response?.data || e.message)
              );
            }
          }
        }
        // clear any phone error on successful save
        setEditingPhoneError('');
      } catch (e: any) {
        console.warn('save tenant failed', e && ((e as any).response?.data || (e as any).message));
      }
      // For create flow we keep modal open (editingTenant now contains history/docs).
      // For update flow we close the modal — infer by presence of editingTenant.id
      if (editingTenant && editingTenant.id) setShowTenantModal(false);
    })();
  }

  // open confirmation modal (client) — actual API call performed in confirmToggleExecute
  function toggleTenantStatus(tenant: any, targetStatus: 'active' | 'inactive') {
    setConfirmAction({ tenant, targetStatus });
  }

  async function confirmToggleExecute() {
    if (!confirmAction) return;
    const { tenant, targetStatus } = confirmAction;
    setStatusLoading((s) => ({ ...s, [tenant.id]: true }));
    try {
      const r = await api.post(`/api/owner/tenants/${tenant.id}/status`, { status: targetStatus });
      const updated = r.data && r.data.user;
      if (updated)
        setTenants((s) => s.map((x) => (x.id === updated.id ? clientShapeFromApi(updated) : x)));
      setConfirmAction(null);
    } catch (err: any) {
      console.warn(
        'toggle status failed',
        err && ((err as any).response?.data || (err as any).message)
      );
      Alert.alert(
        'Error',
        (err && err.response && err.response.data && err.response.data.error) ||
          (err && err.message) ||
          'Failed to update status'
      );
    } finally {
      setStatusLoading((s) => ({ ...s, [tenant.id]: false }));
    }
  }

  async function createBill(m: any) {
    try {
      const r = await api.post('/api/owner/bills', m);
      const created = r.data && r.data.bill;
      if (created) setBills((s) => [created, ...s]);
    } catch (e: any) {
      console.warn('create bill failed', e && ((e as any).response?.data || (e as any).message));
    }
  }

  function deletePropertyDoc(id: string) {
    setPropertyDocs((s) => s.filter((d) => d.id !== id));
  }

  // Load initial data
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [t, m, assigned, d] = await Promise.all([
          api.get('/api/owner/tenants'),
          api.get('/api/owner/bills'), // bills raised by this owner
          api.get('/api/owner/bills/assigned'), // bills assigned to this owner (my bills)
          api.get('/api/owner/documents'),
        ]);
        if (!mounted) return;
        if (t.data && t.data.users) setTenants(t.data.users.map((u: any) => clientShapeFromApi(u)));
        if (m.data && m.data.bills) setTenantBills(m.data.bills);
        if (assigned.data && assigned.data.bills) setMyBills(assigned.data.bills);
        if (d.data && d.data.documents)
          setPropertyDocs(
            d.data.documents.map((x: any) => ({
              id: x.id,
              name: x.title || x.file_url,
              uri: x.file_url,
              file_url: x.file_url,
              uploadedAt: x.createdAt,
            }))
          );
        try {
          // Owners must fetch their flats via owner-scoped endpoint (admin endpoint is restricted)
          const f = await api.get('/api/owner/flats');
          if (f.data && f.data.flats) setFlats(f.data.flats);
        } catch (e: any) {
          console.warn(
            'failed to load flats for owner',
            e && ((e as any).response?.data || e.message)
          );
        }
        try {
          const c = await api.get('/api/notices/count');
          setNoticesCount(Number(c.data.count || 0));
        } catch (e: any) {}
        // fetch helplines once so we can show primary number in the UI
        try {
          const h = await api.get('/api/owner/helplines');
          setHelplines(h.data.helplines || h.data || []);
        } catch (e: any) {
          /* ignore */
        }
      } catch (e: any) {
        console.warn(
          'owner initial load failed',
          e && ((e as any).response?.data || (e as any).message)
        );
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // refresh bills only
  async function refreshBills() {
    try {
      const [raisedRes, assignedRes] = await Promise.all([
        api.get('/api/owner/bills'),
        api.get('/api/owner/bills/assigned'),
      ]);
      if (raisedRes.data && raisedRes.data.bills) setTenantBills(raisedRes.data.bills);
      if (assignedRes.data && assignedRes.data.bills) setMyBills(assignedRes.data.bills);
    } catch (e) {
      console.warn('refresh bills failed', e);
    }
  }

  async function fetchNotices() {
    try {
      const r = await api.get('/api/notices');
      setNoticesList(r.data.notices || []);
    } catch (e: any) {
      console.warn('fetch notices failed', e);
    }
  }

  async function fetchHelplines() {
    try {
      const r = await api.get('/api/owner/helplines');
      setHelplines(r.data.helplines || r.data || []);
    } catch (e: any) {
      console.warn('fetch helplines failed', e);
    }
  }

  // When desktop user navigates via sidebar, fetch list data for notices/helplines
  useEffect(() => {
    if (activeTab === 'notices') fetchNotices();
    if (activeTab === 'helplines') fetchHelplines();
  }, [activeTab]);

  // Simple card UI components
  const StatCard = ({ title, value }: any) => (
    <View style={[styles.statCard, isMobile ? styles.statCardMobile : {}]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  // Bottom navigation for mobile/tablet is provided by shared BottomTab component

  // make bottom items explicit and available to UI for debugging
  // Owner bottom tab: Home → Support → My Tenants → Profile
  // Use keys that match `activeTab` so highlighting/selection works correctly.
  const bottomItems = [
    { key: 'dashboard', label: 'Home', icon: 'home' },
    { key: 'helplines', label: 'Helplines', icon: 'call' },
    { key: 'bills', label: 'Bills', icon: 'cash' },
    { key: 'tenants', label: 'My Tenants', icon: 'people' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];
  try {
    console.log(
      '[OwnerScreen] BottomTab items =',
      bottomItems.map((b) => b.key)
    );
  } catch (e) {}

  return (
    <View style={[styles.container, isDesktop ? styles.row : {}]}>
      {/* Sidebar for desktop, compact header for mobile/tablet */}
      {isDesktop ? (
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>O</Text>
            </View>
            {/* Name and phone removed as requested */}
          </View>
          <View style={styles.menu}>
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'dashboard' && styles.menuActive]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Ionicons name="home" size={18} color="#fff" />
              <Text style={styles.menuText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'notices' && styles.menuActive]}
              onPress={() => setActiveTab('notices')}
            >
              <Ionicons name="notifications" size={18} color="#fff" />
              <Text style={styles.menuText}>Notices</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'helplines' && styles.menuActive]}
              onPress={() => {
                // Always open the helplines list so owner can view/add numbers.
                setActiveTab('helplines');
              }}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.menuText}>
                {helplines && helplines.length ? helplines[0].phone || 'Helplines' : 'Helplines'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, activeTab === 'tenants' && styles.menuActive]}
              onPress={() => setActiveTab('tenants')}
            >
              <Ionicons name="people" size={18} color="#fff" />
              <Text style={styles.menuText}>My Tenants</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowProfileModal(true)}>
              <Ionicons name="person" size={18} color="#fff" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>
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
      ) : (
        <View style={styles.mobileTopBar}>
          {/* Compact header - show society name and (for owner/tenant) wing/flat */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>{societyName}</Text>
            {wingFlat ? (
              <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{wingFlat}</Text>
            ) : null}
          </View>
          {/* Keep only notifications + logout controls (upload/person removed) */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => {
                fetchNotices();
                setShowNoticesModal(true);
              }}
              style={styles.iconAction}
            >
              <Ionicons name="notifications" size={20} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout} style={[styles.iconAction, { marginLeft: 8 }]}>
              <Ionicons name="log-out" size={20} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main area */}
      <View style={styles.main}>
        <View style={styles.headerRow}>
          {/* Owner Dashboard label removed per request */}
          <View />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Tenant header buttons removed per request */}
            <Image source={{ uri: 'https://placekitten.com/80/80' }} style={styles.profilePic} />
          </View>
        </View>

        {/* Debug strip removed per request */}

        {/* If the My Tenants tab is active, show a persistent full-width header banner with a large Add Tenant CTA
            This makes the action obvious in web responsive and wide viewports where FABs or small icons may be missed */}
        {/* Tenants header banner removed per request */}

        <View style={{ flex: 1 }}>
          {activeTab === 'dashboard' && (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: 120 + insets.bottom,
                paddingHorizontal: isMobile ? 6 : 0,
              }}
            >
              <View>
                {/* Stats arranged as requested: first row -> Total Tenants & Active; second row -> Previous & Maintenance
                  Docs kept below and a Raise Complaint button added. */}
                <View style={styles.statsRowRow}>
                  <StatCard title="Total Tenants" value={stats.totalTenants} />
                  <StatCard title="Active" value={stats.active} />
                </View>
                <View style={styles.statsRowRow}>
                  <StatCard title="Previous" value={stats.previous} />
                  <StatCard title="Bills" value={stats.billsAmount ? `₹${stats.billsAmount}` : 0} />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <StatCard title="Docs" value={stats.documents} />
                </View>
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.smallBtn, { alignSelf: 'flex-start', marginRight: 8 }]}
                    onPress={() => setShowOwnerComplaintModal(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Raise Complaint</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.smallBtn,
                      { alignSelf: 'flex-start', backgroundColor: '#1abc9c' },
                    ]}
                    onPress={() => setShowOwnerBillsModal(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Bills</Text>
                  </TouchableOpacity>
                </View>
                {/* Tenant financial summary: rent and documents (best-effort - payments/bills may not be tracked) */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.sectionTitle}>Tenant Financials (current month)</Text>
                  {tenants.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#666' }}>No tenants available.</Text>
                    </View>
                  ) : (
                    tenants.map((t) => (
                      <View
                        key={t.id}
                        style={{
                          padding: 12,
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <View>
                            <Text style={{ fontWeight: '700' }}>{t.name}</Text>
                            <Text style={{ color: '#666' }}>{t.phone}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text>Rent: ₹{t.rent || '—'}</Text>
                            <View style={{ marginTop: 6, alignItems: 'flex-end' }}>
                              {tenantDueMap[t.id] && tenantDueMap[t.id] > 0 ? (
                                <View style={[styles.badge, { backgroundColor: '#e67e22' }]}>
                                  <Text style={{ color: '#fff' }}>Due: ₹{tenantDueMap[t.id]}</Text>
                                </View>
                              ) : (
                                <View style={[styles.badge, { backgroundColor: '#2ecc71' }]}>
                                  <Text style={{ color: '#fff' }}>No due</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
                {/* Quick Actions moved to My Tenants - hidden on Dashboard per request */}
              </View>
            </ScrollView>
          )}

          {activeTab === 'notices' && (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.sectionTitle}>Notices</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={() => fetchNotices()}>
                  <Text style={{ color: '#fff' }}>Refresh</Text>
                </TouchableOpacity>
              </View>
              {noticesList.length === 0 ? (
                <View style={{ padding: 24 }}>
                  <Text style={{ color: '#666' }}>No notices found.</Text>
                </View>
              ) : (
                <FlatList
                  data={noticesList}
                  keyExtractor={(n: any) => n.id}
                  renderItem={({ item }) => (
                    <View style={{ paddingVertical: 8 }}>
                      <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                      <Text style={{ color: '#666', marginTop: 4 }}>{item.description}</Text>
                      <Text style={{ color: '#999', marginTop: 6 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {activeTab === 'helplines' && (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.sectionTitle}>Helplines</Text>
                {/* Only owners can add helplines */}
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
                  <Text style={{ color: '#666' }}>No helplines configured.</Text>
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

          {activeTab === 'tenants' && (
            <View>
              {/* If no tenants yet, show a clear empty state with big Add Tenant CTA (helps Expo web responsive) */}
              {tenants.length === 0 && (
                <View
                  style={{
                    padding: 18,
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
                    No tenants found
                  </Text>
                  <Text style={{ color: '#666', marginBottom: 12 }}>
                    You haven't added any tenants yet.
                  </Text>
                  {/* Add Tenant action removed per request */}
                </View>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#666' }}>{tenants.length} tenants</Text>
                <TouchableOpacity
                  style={[styles.smallBtn, { paddingHorizontal: 12 }]}
                  onPress={() => openAddTenant()}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Add Tenant</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.filterRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color="#666" />
                  <TextInput
                    placeholder="Search"
                    value={tenantQ}
                    onChangeText={setTenantQ}
                    style={{ marginLeft: 8, flex: 1 }}
                  />
                </View>
                <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                  <TouchableOpacity
                    style={[styles.filterBtn, tenantFilter === 'all' && styles.filterActive]}
                    onPress={() => setTenantFilter('all')}
                  >
                    <Text>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, tenantFilter === 'active' && styles.filterActive]}
                    onPress={() => setTenantFilter('active')}
                  >
                    <Text>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, tenantFilter === 'inactive' && styles.filterActive]}
                    onPress={() => setTenantFilter('inactive')}
                  >
                    <Text>Inactive</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {tenantFilter === 'all' ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Active Tenants</Text>
                  {activeTenants.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#666' }}>No active tenants.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={activeTenants}
                      keyExtractor={(i: any) => i.id}
                      renderItem={({ item }) => (
                        <View style={styles.tenantCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tenantName}>{item.name}</Text>
                            <Text style={styles.tenantMeta}>
                              {item.role || 'Tenant'} • {item.phone}
                            </Text>
                            {item.flat ? (
                              <Text style={styles.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                            ) : null}
                            <Text style={styles.tenantDates}>
                              Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                              {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <View
                              style={[
                                styles.badge,
                                item.status === 'active'
                                  ? styles.badgeActive
                                  : styles.badgeInactive,
                              ]}
                            >
                              <Text style={{ color: '#fff' }}>
                                {item.status === 'active' ? 'Active' : 'Inactive'}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                style={{ marginTop: 8, marginRight: 8 }}
                                onPress={() => openAddTenant(item)}
                              >
                                <Ionicons name="eye" size={18} />
                              </TouchableOpacity>
                              {/* show agreement / document quick icons when available */}
                              {item.history?.agreements && item.history.agreements.length > 0 ? (
                                <TouchableOpacity
                                  style={{ marginTop: 8, marginRight: 8 }}
                                  onPress={() => {
                                    try {
                                      const agr = item.history.agreements[0];
                                      const url =
                                        agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                                      if (url) downloadAgreement(url);
                                    } catch (e) {}
                                  }}
                                >
                                  <Ionicons name="document-text" size={18} color="#374151" />
                                </TouchableOpacity>
                              ) : null}
                              {item.history?.documents && item.history.documents.length > 0 ? (
                                <TouchableOpacity
                                  style={{ marginTop: 8, marginRight: 8 }}
                                  onPress={() => {
                                    try {
                                      const doc = item.history.documents[0];
                                      const url =
                                        doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                                      if (url) handlePreview(url);
                                    } catch (e) {}
                                  }}
                                >
                                  <Ionicons name="document-attach" size={18} color="#374151" />
                                </TouchableOpacity>
                              ) : null}
                              {statusLoading[item.id] ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#fff"
                                  style={{ marginTop: 8 }}
                                />
                              ) : (
                                <TouchableOpacity
                                  style={[
                                    styles.smallBtn,
                                    { backgroundColor: '#e74c3c', marginTop: 8 },
                                  ]}
                                  onPress={() => toggleTenantStatus(item, 'inactive')}
                                >
                                  <Text style={{ color: '#fff' }}>Deactivate</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      )}
                    />
                  )}

                  <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Inactive Tenants</Text>
                  {inactiveTenants.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#666' }}>No inactive tenants.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={inactiveTenants}
                      keyExtractor={(i: any) => i.id}
                      renderItem={({ item }) => (
                        <View style={styles.tenantCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tenantName}>{item.name}</Text>
                            <Text style={styles.tenantMeta}>
                              {item.role || 'Tenant'} • {item.phone}
                            </Text>
                            {item.flat ? (
                              <Text style={styles.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                            ) : null}
                            <Text style={styles.tenantDates}>
                              Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                              {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <View
                              style={[
                                styles.badge,
                                item.status === 'active'
                                  ? styles.badgeActive
                                  : styles.badgeInactive,
                              ]}
                            >
                              <Text style={{ color: '#fff' }}>
                                {item.status === 'active' ? 'Active' : 'Inactive'}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity
                                style={{ marginTop: 8, marginRight: 8 }}
                                onPress={() => openAddTenant(item)}
                              >
                                <Ionicons name="eye" size={18} />
                              </TouchableOpacity>
                              {/* show agreement / document quick icons when available */}
                              {item.history?.agreements && item.history.agreements.length > 0 ? (
                                <TouchableOpacity
                                  style={{ marginTop: 8, marginRight: 8 }}
                                  onPress={() => {
                                    try {
                                      const agr = item.history.agreements[0];
                                      const url =
                                        agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                                      if (url) downloadAgreement(url);
                                    } catch (e) {}
                                  }}
                                >
                                  <Ionicons name="document-text" size={18} color="#374151" />
                                </TouchableOpacity>
                              ) : null}
                              {item.history?.documents && item.history.documents.length > 0 ? (
                                <TouchableOpacity
                                  style={{ marginTop: 8, marginRight: 8 }}
                                  onPress={() => {
                                    try {
                                      const doc = item.history.documents[0];
                                      const url =
                                        doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                                      if (url) handlePreview(url);
                                    } catch (e) {}
                                  }}
                                >
                                  <Ionicons name="document-attach" size={18} color="#374151" />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      )}
                    />
                  )}
                </>
              ) : (
                <FlatList
                  data={filteredTenants}
                  keyExtractor={(i: any) => i.id}
                  renderItem={({ item }) => (
                    <View style={styles.tenantCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tenantName}>{item.name}</Text>
                        <Text style={styles.tenantMeta}>
                          {item.role || 'Tenant'} • {item.phone}
                        </Text>
                        {item.flat ? (
                          <Text style={styles.tenantMeta}>Flat: {item.flat.flat_no}</Text>
                        ) : null}
                        <Text style={styles.tenantDates}>
                          Rent: ₹{item.rent} • Move-in: {item.moveIn}{' '}
                          {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View
                          style={[
                            styles.badge,
                            item.status === 'active' ? styles.badgeActive : styles.badgeInactive,
                          ]}
                        >
                          <Text style={{ color: '#fff' }}>
                            {item.status === 'active' ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            style={{ marginTop: 8, marginRight: 8 }}
                            onPress={() => openAddTenant(item)}
                          >
                            <Ionicons name="eye" size={18} />
                          </TouchableOpacity>
                          {item.history?.agreements && item.history.agreements.length > 0 ? (
                            <TouchableOpacity
                              style={{ marginTop: 8, marginRight: 8 }}
                              onPress={() => {
                                try {
                                  const agr = item.history.agreements[0];
                                  const url =
                                    agr && (agr.file_url || agr.fileUrl || agr.url || agr.path);
                                  if (url) downloadAgreement(url);
                                } catch (e) {}
                              }}
                            >
                              <Ionicons name="document-text" size={18} color="#374151" />
                            </TouchableOpacity>
                          ) : null}
                          {item.history?.documents && item.history.documents.length > 0 ? (
                            <TouchableOpacity
                              style={{ marginTop: 8, marginRight: 8 }}
                              onPress={() => {
                                try {
                                  const doc = item.history.documents[0];
                                  const url =
                                    doc && (doc.file_url || doc.fileUrl || doc.url || doc.path);
                                  if (url) handlePreview(url);
                                } catch (e) {}
                              }}
                            >
                              <Ionicons name="document-attach" size={18} color="#374151" />
                            </TouchableOpacity>
                          ) : null}
                          {statusLoading[item.id] ? (
                            <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
                          ) : item.status === 'active' ? (
                            <TouchableOpacity
                              style={[
                                styles.smallBtn,
                                { backgroundColor: '#e74c3c', marginTop: 8 },
                              ]}
                              onPress={() => toggleTenantStatus(item, 'inactive')}
                            >
                              <Text style={{ color: '#fff' }}>Deactivate</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {activeTab === 'bills' && (
            <View>
              {/* bills toggle: tenant (raised by you) or my (assigned to you) */}
              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                <TouchableOpacity
                  style={[styles.segment, billsView === 'tenant' ? styles.segmentActive : {}]}
                  onPress={() => setBillsView('tenant')}
                >
                  <Text style={billsView === 'tenant' ? { color: '#fff' } : {}}>Tenant Bills</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, billsView === 'my' ? styles.segmentActive : {}]}
                  onPress={() => setBillsView('my')}
                >
                  <Text style={billsView === 'my' ? { color: '#fff' } : {}}>My Bills</Text>
                </TouchableOpacity>
              </View>

              {/* My Bills view */}
              {billsView === 'my' && (
                <>
                  <Text style={styles.sectionTitle}>My Bills</Text>
                  {myBills.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#666' }}>No bills assigned to you.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={myBills}
                      keyExtractor={(m: any) => m.id}
                      nestedScrollEnabled={true}
                      contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
                      renderItem={({ item }) => (
                        <View style={styles.maintCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                            <Text style={{ color: '#666' }}>{item.description}</Text>
                            {item.payment_proof_url ? (
                              <Text style={{ color: '#666', marginTop: 6 }}>Proof attached</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text>₹{item.cost}</Text>
                            <Text
                              style={{
                                color:
                                  item.status === 'payment_pending'
                                    ? '#e67e22'
                                    : item.status === 'closed'
                                    ? '#2ecc71'
                                    : '#6b7280',
                              }}
                            >
                              {item.status}
                            </Text>
                            <View style={{ height: 8 }} />
                            {/* Upload flow: pick image locally first, preview, then submit (same as tenant flow) */}
                            {!selectedProofs[item.id] ? (
                              <TouchableOpacity
                                style={styles.smallBtn}
                                disabled={!!uploadingProof[item.id]}
                                onPress={async () => {
                                  try {
                                    // pick image locally (native uses expo-image-picker for gallery UX)
                                    if (Platform.OS !== 'web') {
                                      try {
                                        const ImagePicker: any = await import('expo-image-picker');
                                        const perm =
                                          await ImagePicker.requestMediaLibraryPermissionsAsync();
                                        if (!perm.granted) {
                                          alert('Permission to access photos is required');
                                          return;
                                        }
                                        const res = await ImagePicker.launchImageLibraryAsync({
                                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                          allowsEditing: true,
                                          quality: 0.8,
                                          base64: false,
                                        });
                                        const cancelled =
                                          (res as any).canceled === true ||
                                          (res as any).cancelled === true;
                                        if (cancelled) return;
                                        const assets = (res as any).assets;
                                        const uri =
                                          Array.isArray(assets) && assets.length
                                            ? assets[0].uri
                                            : (res as any).uri;
                                        if (uri)
                                          setSelectedProofs((s) => ({
                                            ...(s || {}),
                                            [item.id]: uri,
                                          }));
                                      } catch (e) {
                                        console.warn('image pick failed', e);
                                        alert('Failed to pick image');
                                      }
                                    } else {
                                      // web fallback: reuse pickAndUploadFile which returns an uploaded url (preview will be remote)
                                      try {
                                        const url = await pickAndUploadFile({
                                          accept: 'image/*',
                                          fallbackApiPath: '/api/owner/upload',
                                        });
                                        if (url)
                                          setSelectedProofs((s) => ({
                                            ...(s || {}),
                                            [item.id]: url,
                                          }));
                                      } catch (e) {
                                        console.warn('web pick failed', e);
                                        alert('Failed to pick file');
                                      }
                                    }
                                  } catch (e) {
                                    console.warn('pick image error', e);
                                  }
                                }}
                              >
                                <Text style={{ color: '#fff' }}>Upload Proof</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Image
                                  source={{ uri: selectedProofs[item.id] }}
                                  style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 6,
                                    marginBottom: 8,
                                  }}
                                  resizeMode="cover"
                                />
                                <View style={{ flexDirection: 'row' }}>
                                  <TouchableOpacity
                                    style={[styles.smallBtn, { marginRight: 8 }]}
                                    onPress={async () => {
                                      // submit selected proof: upload if local uri, else use directly
                                      try {
                                        setUploadingProof((s) => ({
                                          ...(s || {}),
                                          [item.id]: true,
                                        }));
                                        const localUri = selectedProofs[item.id];
                                        let url = localUri;
                                        if (!/^https?:\/\//.test(String(localUri))) {
                                          // upload local file to server (better multipart + fallback)
                                          url = await uploadLocalUri(localUri);
                                        }
                                        if (!url) throw new Error('upload failed');
                                        const r = await api.post(
                                          `/api/bills/${item.id}/mark-paid`,
                                          { payment_proof_url: url }
                                        );
                                        const updated = r.data && r.data.bill;
                                        if (updated) {
                                          setMyBills((s) =>
                                            s.map((it) => (it.id === updated.id ? updated : it))
                                          );
                                          alert('Payment proof submitted. Verification pending.');
                                        } else {
                                          alert('Submitted');
                                        }
                                        // clear selected preview
                                        setSelectedProofs((s) => {
                                          const copy = { ...(s || {}) };
                                          delete copy[item.id];
                                          return copy;
                                        });
                                      } catch (e: any) {
                                        console.warn('submit proof failed', e);
                                        // show server response if available for easier debugging
                                        let msg = 'Failed to submit proof';
                                        try {
                                          if (e && e.response && e.response.data)
                                            msg = JSON.stringify(e.response.data);
                                          else if (e && e.message) msg = e.message;
                                        } catch (ee) {}
                                        alert(msg);
                                      } finally {
                                        setUploadingProof((s) => ({
                                          ...(s || {}),
                                          [item.id]: false,
                                        }));
                                      }
                                    }}
                                  >
                                    {uploadingProof[item.id] ? (
                                      <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                      <Text style={{ color: '#fff' }}>Submit Proof</Text>
                                    )}
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.smallBtnClose}
                                    onPress={() =>
                                      setSelectedProofs((s) => {
                                        const copy = { ...(s || {}) };
                                        delete copy[item.id];
                                        return copy;
                                      })
                                    }
                                  >
                                    <Text style={styles.closeText}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    />
                  )}
                </>
              )}

              {/* Tenant Bills view */}
              {billsView === 'tenant' && (
                <>
                  <View style={{ height: 12 }} />
                  <View
                    style={[
                      {
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text style={styles.sectionTitle}>Tenant Bills (raised by you)</Text>
                    {/* New Bill action removed per UI request */}
                  </View>
                  {tenantBills.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: '#666' }}>No bills raised by you.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={tenantBills}
                      keyExtractor={(m: any) => m.id}
                      nestedScrollEnabled={true}
                      contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.maintCard}
                          onPress={() => {
                            try {
                              const st = String(item.status || '').toLowerCase();
                              if (st === 'payment_pending' || st === 'payment-pending') {
                                setVerifyBill(item);
                                setShowVerifyModal(true);
                              }
                            } catch (e) {}
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                            <Text style={{ color: '#666' }}>{item.description}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text>₹{item.cost}</Text>
                            <Text
                              style={{
                                color:
                                  String(item.status).toLowerCase() === 'payment_pending' ||
                                  String(item.status).toLowerCase() === 'payment-pending'
                                    ? '#e67e22'
                                    : String(item.status).toLowerCase() === 'closed'
                                    ? '#2ecc71'
                                    : '#6b7280',
                              }}
                            >
                              {item.status}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              )}

              {/* Verify payment modal - owner can preview proof and mark as paid */}
              <Modal visible={showVerifyModal} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                  <View style={[styles.modalContent, { maxHeight: 520 }]}>
                    <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
                      Verify Payment
                    </Text>
                    {verifyBill ? (
                      <View>
                        <Text style={{ fontWeight: '700' }}>{verifyBill.title}</Text>
                        <Text style={{ color: '#666', marginBottom: 8 }}>
                          {verifyBill.description}
                        </Text>
                        <Text style={{ marginBottom: 8 }}>Amount: ₹{verifyBill.cost}</Text>

                        {verifyBill.payment_proof_url ? (
                          <Image
                            source={{ uri: verifyBill.payment_proof_url }}
                            style={{
                              width: '100%',
                              height: 220,
                              borderRadius: 8,
                              marginBottom: 12,
                            }}
                            resizeMode="contain"
                          />
                        ) : (
                          <View
                            style={{ padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8 }}
                          >
                            <Text style={{ color: '#666' }}>No proof attached.</Text>
                          </View>
                        )}

                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'flex-end',
                            marginTop: 12,
                          }}
                        >
                          <TouchableOpacity
                            style={[styles.smallBtn, { marginRight: 8 }]}
                            onPress={() => {
                              setShowVerifyModal(false);
                              setVerifyBill(null);
                            }}
                            disabled={verifying}
                          >
                            <Text style={{ color: '#fff' }}>Cancel</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.smallBtn}
                            onPress={async () => {
                              if (!verifyBill) return;
                              try {
                                setVerifying(true);
                                const r = await api.post(
                                  `/api/owner/bills/${verifyBill.id}/verify`,
                                  {
                                    action: 'approve',
                                  }
                                );
                                const updated =
                                  r.data && (r.data.bill || r.data.updatedBill || r.data.updated);
                                if (updated) {
                                  setTenantBills((s) =>
                                    (s || []).map((it: any) =>
                                      it.id === updated.id ? updated : it
                                    )
                                  );
                                }
                                setShowVerifyModal(false);
                                setVerifyBill(null);
                                alert('Bill marked as paid');
                              } catch (e) {
                                console.warn('verify approve failed', e);
                                alert('Failed to verify bill');
                              } finally {
                                setVerifying(false);
                              }
                            }}
                            disabled={verifying}
                          >
                            {verifying ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={{ color: '#fff' }}>Mark as Paid</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Modal>
            </View>
          )}

          {activeTab === 'documents' && (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.sectionTitle}>Property Documents</Text>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={pickPropertyDoc}
                  disabled={uploadingPropertyDoc}
                >
                  {uploadingPropertyDoc ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff' }}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
              {propertyDocs.length === 0 ? (
                <View style={{ padding: 24 }}>
                  <Text style={{ color: '#666' }}>
                    No documents yet. Upload using the button above.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={propertyDocs}
                  keyExtractor={(d: any) => d.id}
                  renderItem={({ item }) => (
                    <View style={styles.docRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                        <Text style={{ color: '#666' }}>{item.uploadedAt}</Text>
                      </View>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          style={{ marginRight: 8 }}
                          onPress={() => {
                            /* TODO: preview */
                          }}
                        >
                          <Ionicons name="eye" size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deletePropertyDoc(item.id)}>
                          <Ionicons name="trash" size={18} color="#900" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {activeTab === 'settings' && (
            <View>
              <Text style={styles.sectionTitle}>Profile</Text>
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={ownerProfile.name}
                  onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), name: t }))}
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={ownerProfile.phone}
                  onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), phone: t }))}
                  keyboardType="phone-pad"
                />

                <Text style={styles.label}>Full address</Text>
                <TextInput
                  style={styles.input}
                  value={ownerProfile.address}
                  onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), address: t }))}
                />

                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  value={ownerProfile.email}
                  onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), email: t }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Emergency contact number</Text>
                <TextInput
                  style={styles.input}
                  value={ownerProfile.emergency_contact}
                  onChangeText={(t) =>
                    setOwnerProfile((s: any) => ({ ...(s || {}), emergency_contact: t }))
                  }
                  keyboardType="phone-pad"
                />

                <View style={{ height: 12 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={async () => {
                      try {
                        setSavingProfile(true);
                        const payload: any = {
                          name: ownerProfile.name || null,
                          phone: ownerProfile.phone || null,
                          email: ownerProfile.email || null,
                          address: ownerProfile.address || null,
                          emergency_contact: ownerProfile.emergency_contact || null,
                        };
                        // remove nulls (backend expects only sent fields)
                        Object.keys(payload).forEach((k) => {
                          if (payload[k] === null) delete payload[k];
                        });
                        const r = await api.put('/api/user', payload);
                        if (r && r.data && r.data.user) {
                          const u = r.data.user;
                          setOwnerProfile({
                            name: u.name || '',
                            phone: u.phone || u.mobile_number || '',
                            email: u.email || '',
                            address: u.address || '',
                            emergency_contact: u.emergency_contact || '',
                          });
                          setUserAvatar(u.avatar || u.image || userAvatar);
                          try {
                            await AsyncStorage.setItem('user', JSON.stringify(u));
                          } catch (e) {}
                        }
                        alert('Profile saved');
                      } catch (e: any) {
                        console.warn(
                          'save owner profile failed',
                          e && (e.response?.data || e.message)
                        );
                        alert('Failed to save profile');
                      } finally {
                        setSavingProfile(false);
                      }
                    }}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff' }}>Save</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.smallBtnClose}
                    onPress={() =>
                      setOwnerProfile({
                        name: (user as any)?.name || '',
                        phone: (user as any)?.phone || (user as any)?.mobile_number || '',
                        email: (user as any)?.email || '',
                        address: (user as any)?.address || '',
                        emergency_contact: (user as any)?.emergency_contact || '',
                      })
                    }
                  >
                    <Text style={styles.closeText}>Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.smallBtn}>
                    <Text style={{ color: '#fff' }}>Change Password</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Tenant modal */}
      <Modal visible={showTenantModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
                {editingReadOnly ? 'View Tenant' : editingTenant?.id ? 'Edit Tenant' : 'Add Tenant'}
              </Text>

              <Text style={styles.label}>
                Full name <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={editingTenant?.name}
                onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, name: t }))}
                editable={!editingReadOnly}
              />

              <Text style={styles.label}>
                Mobile <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={editingTenant?.phone}
                onChangeText={(t) => {
                  setEditingTenant((s: any) => ({ ...s, phone: t }));
                  setEditingPhoneError('');
                }}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!editingReadOnly}
              />
              {editingPhoneError ? (
                <Text style={styles.inlineError}>{editingPhoneError}</Text>
              ) : null}

              <Text style={styles.label}>
                Address <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={editingTenant?.address}
                onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, address: t }))}
                editable={!editingReadOnly}
              />

              <Text style={styles.label}>
                Gender <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {['Male', 'Female', 'Other'].map((g) => {
                  const lower = (g || '').toLowerCase();
                  const active = (editingTenant?.gender || '').toString().toLowerCase() === lower;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() =>
                        !editingReadOnly && setEditingTenant((s: any) => ({ ...s, gender: lower }))
                      }
                      style={[styles.segment, active ? styles.segmentActive : {}]}
                    >
                      <Text style={active ? { color: '#fff' } : {}}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Family members</Text>
              <View style={{ marginBottom: 8 }}>
                {(editingTenant?.family || []).map((f: any, idx: number) => (
                  <View
                    key={idx}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                  >
                    <Text style={{ width: 28, textAlign: 'center', color: '#333' }}>{idx + 1}</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={f.name}
                      onChangeText={(val) => {
                        setEditingTenant((s: any) => {
                          const fam = (s.family || []).slice();
                          fam[idx] = { name: val };
                          return { ...s, family: fam };
                        });
                      }}
                      editable={!editingReadOnly}
                      placeholder="Full name"
                    />
                  </View>
                ))}
                {!editingReadOnly && (
                  <TouchableOpacity
                    onPress={() =>
                      setEditingTenant((s: any) => ({
                        ...s,
                        family: [...(s.family || []), { name: '' }],
                      }))
                    }
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name="add" size={18} color="#6C5CE7" />
                    <Text style={{ marginLeft: 8, color: '#6C5CE7' }}>Add member</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>
                Move-in date <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  value={editingTenant?.moveIn}
                  onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, moveIn: t }))}
                  placeholder="YYYY-MM-DD"
                  editable={!editingReadOnly}
                />
              </View>

              <View style={{ marginBottom: 8 }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#e6e6e6',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <PickerLike
                    flats={flats}
                    value={editingTenant?.flat?.id || ''}
                    onChange={(flatId: any) =>
                      setEditingTenant((s: any) => ({
                        ...s,
                        flat: flats.find((f: any) => f.id === flatId) || null,
                      }))
                    }
                    disabled={editingReadOnly}
                  />
                </View>
              </View>

              <Text style={styles.label}>
                Deposit amount <Text style={{ color: '#d00' }}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={String(editingTenant?.deposit || '')}
                onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, deposit: Number(t) }))}
                keyboardType="numeric"
                editable={!editingReadOnly}
              />

              <Text style={[styles.label, { marginTop: 10 }]}>Witness 1</Text>
              <TextInput
                style={styles.input}
                value={editingTenant?.witness1 || ''}
                onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, witness1: t }))}
                editable={!editingReadOnly}
                placeholder="Name & contact"
              />

              <Text style={[styles.label, { marginTop: 8 }]}>Witness 2</Text>
              <TextInput
                style={styles.input}
                value={editingTenant?.witness2 || ''}
                onChangeText={(t) => setEditingTenant((s: any) => ({ ...s, witness2: t }))}
                editable={!editingReadOnly}
                placeholder="Name & contact"
              />

              <Text style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
                please verify with witness if he knows the tenant personally.
              </Text>

              {/* Aadhaar / PAN uploads for tenant (owner can attach documents that tenant can view) */}
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Identity Documents</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text>Aadhaar</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {editingTenant?.aadhaar_url ? (
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => handlePreview(editingTenant.aadhaar_url)}
                      >
                        <Ionicons name="eye-outline" size={20} color="#2563eb" />
                      </TouchableOpacity>
                    ) : null}
                    {!editingReadOnly && (
                      <TouchableOpacity
                        style={{ padding: 8, marginLeft: 6 }}
                        onPress={async () => {
                          try {
                            const url = await pickAndUploadFile({
                              accept: '*/*',
                              fallbackApiPath: '/api/owner/upload',
                            });
                            if (!url) return;
                            setEditingTenant((s: any) => ({ ...s, aadhaar_url: url }));
                          } catch (e) {
                            console.warn('aadhaar upload failed', e);
                            alert('Upload failed');
                          }
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={20} color="#2563eb" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text>PAN</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {editingTenant?.pan_url ? (
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => {
                          setPreviewImageUrl(editingTenant.pan_url);
                          setShowPreviewModal(true);
                        }}
                      >
                        <Ionicons name="eye-outline" size={20} color="#2563eb" />
                      </TouchableOpacity>
                    ) : null}
                    {!editingReadOnly && (
                      <TouchableOpacity
                        style={{ padding: 8, marginLeft: 6 }}
                        onPress={async () => {
                          try {
                            const url = await pickAndUploadFile({
                              accept: '*/*',
                              fallbackApiPath: '/api/owner/upload',
                            });
                            if (!url) return;
                            setEditingTenant((s: any) => ({ ...s, pan_url: url }));
                          } catch (e) {
                            console.warn('pan upload failed', e);
                            alert('Upload failed');
                          }
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={20} color="#2563eb" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: '#ccc', marginRight: 8 }]}
                  onPress={() => setShowTenantModal(false)}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                {!editingReadOnly ? (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => setShowTenantConfirm(true)}
                  >
                    <Text style={{ color: '#fff' }}>Save</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tenant confirmation modal before creating/updating tenant and generating agreement */}
      <Modal visible={showTenantConfirm} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { width: Math.min(360, wp(95)) }]}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Please confirm</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={{ fontWeight: '700' }}>{editingTenant?.name}</Text>
              <Text style={{ color: '#666', marginTop: 6 }}>{editingTenant?.phone}</Text>
              <Text style={{ color: '#666', marginTop: 6 }}>{editingTenant?.address}</Text>
              <View style={{ height: 8 }} />
              <Text>Flat: {editingTenant?.flat?.flat_no || '—'}</Text>
              <Text>Rent: ₹{editingTenant?.rent || '—'}</Text>
              <Text>Deposit: ₹{editingTenant?.deposit || '—'}</Text>
              <View style={{ height: 8 }} />
              <Text style={{ fontWeight: '700', marginTop: 8 }}>Witnesses</Text>
              <Text>{editingTenant?.witness1 || '—'}</Text>
              <Text>{editingTenant?.witness2 || '—'}</Text>
              <View style={{ height: 12 }} />
              <Text style={{ color: '#444' }}>
                Please verify all the information — based on these details the rent agreement will
                be generated.
              </Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallBtnClose, { marginRight: 8 }]}
                onPress={() => setShowTenantConfirm(false)}
              >
                <Text style={styles.closeText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => {
                  // proceed with actual save
                  setShowTenantConfirm(false);
                  saveTenant(editingTenant);
                }}
              >
                <Text style={{ color: '#fff' }}>Confirm & Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation modal for activate/deactivate */}
      <Modal visible={!!confirmAction} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { width: Math.min(320, wp(90)) }]}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Confirm action</Text>
            <Text style={{ color: '#333', marginBottom: 12 }}>
              {confirmAction
                ? confirmAction.targetStatus === 'inactive'
                  ? 'Are you sure you want to deactivate this tenant?'
                  : 'Are you sure you want to activate this tenant?'
                : ''}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: '#ccc', marginRight: 8 }]}
                onPress={() => setConfirmAction(null)}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={confirmToggleExecute}>
                <Text style={{ color: '#fff' }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notices modal */}
      <Modal visible={showNoticesModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Notices</Text>
            <FlatList
              data={noticesList}
              keyExtractor={(n: any) => n.id}
              renderItem={({ item }) => (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>{item.description}</Text>
                  <Text style={{ color: '#999', marginTop: 6 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </Text>
                </View>
              )}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => {
                  setShowNoticesModal(false);
                }}
              >
                <Text style={{ color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/** Inline bottom bar (temporary hotfix) to force exact Owner order: Home, Support, My Tenants, Profile */}
      <View style={styles.bottomNavBar}>
        {bottomItems.map((it) => (
          <TouchableOpacity
            key={it.key}
            style={styles.bottomNavItem}
            onPress={() => {
              // mark selected for highlight
              setSelectedBottom(it.key);

              // Support / helplines: prefer direct call to primary number if available,
              // otherwise navigate to helplines tab.
              if (it.key === 'helplines') {
                // Always navigate to the helplines list so owner can see and add numbers.
                setActiveTab('helplines');
                return;
              }

              // Profile: open profile modal (Owner uses a modal for profile)
              if (it.key === 'profile') {
                setShowProfileModal(true);
                return;
              }

              // default: change active tab
              setActiveTab(it.key as any);
            }}
            accessibilityRole="button"
          >
            <Ionicons
              name={it.icon as any}
              size={22}
              color={selectedBottom === it.key ? '#6C5CE7' : '#666'}
            />
            <Text
              style={
                selectedBottom === it.key
                  ? [styles.label, { color: '#6C5CE7', fontWeight: '700' }]
                  : styles.label
              }
            >
              {it.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Floating quick-access controls removed per request */}

      {/* Profile modal for Owner (opened from top-right icon or BottomTab 'Profile') */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxWidth: Math.min(420, wp(98)) }]}>
            <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 8 }}>Profile</Text>
            <ProfileCard
              name={ownerProfile?.name || user?.name}
              phone={ownerProfile?.phone || user?.phone}
              email={ownerProfile?.email || user?.email}
              address={ownerProfile?.address || user?.address || ''}
              imageUri={
                userAvatar ||
                ownerProfile?.avatar ||
                ownerProfile?.image ||
                user?.avatar ||
                user?.image
              }
              onEdit={async () => {
                try {
                  console.debug('[OwnerScreen] starting profile pickAndUploadProfile');
                  const url = await pickAndUploadProfile();
                  console.debug('[OwnerScreen] pickAndUploadProfile returned', url);
                  if (!url) return; // cancelled
                  const r = await api.put('/api/user', { avatar: url });
                  console.debug('[OwnerScreen] PUT /api/user response', r && r.data);
                  if (r && r.data && r.data.user) {
                    const u = r.data.user;
                    setUserAvatar(u.avatar || u.image || url);
                    setOwnerProfile({
                      name: u.name || '',
                      phone: u.phone || u.mobile_number || '',
                      email: u.email || '',
                      address: u.address || '',
                      emergency_contact: u.emergency_contact || '',
                    });
                    try {
                      await AsyncStorage.setItem('user', JSON.stringify(u));
                    } catch (e) {}
                  } else {
                    setUserAvatar(url);
                  }
                  alert('Profile photo updated');
                } catch (err: any) {
                  // show detailed error for debugging in dev
                  const msg =
                    (err && (err.response?.data || err.message)) || String(err) || 'unknown error';
                  console.error('[OwnerScreen] owner profile upload failed', err);
                  try {
                    // show a helpful alert in the browser when testing
                    alert('Upload failed: ' + (msg && JSON.stringify(msg)));
                  } catch (e) {}
                }
              }}
              onCall={(p) => {
                try {
                  Linking.openURL(`tel:${p}`);
                } catch (e) {}
              }}
            />
            {/* Editable fields shown inside the Profile modal so owner can edit inline */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Full address</Text>
              <TextInput
                style={styles.input}
                value={ownerProfile.address}
                onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), address: t }))}
              />

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={ownerProfile.email}
                onChangeText={(t) => setOwnerProfile((s: any) => ({ ...(s || {}), email: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Emergency contact number</Text>
              <TextInput
                style={styles.input}
                value={ownerProfile.emergency_contact}
                onChangeText={(t) =>
                  setOwnerProfile((s: any) => ({ ...(s || {}), emergency_contact: t }))
                }
                keyboardType="phone-pad"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.smallBtnClose, { marginRight: 8 }]}
                  onPress={() =>
                    setOwnerProfile({
                      name: (user as any)?.name || '',
                      phone: (user as any)?.phone || (user as any)?.mobile_number || '',
                      email: (user as any)?.email || '',
                      address: (user as any)?.address || '',
                      emergency_contact: (user as any)?.emergency_contact || '',
                    })
                  }
                >
                  <Text style={styles.closeText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={async () => {
                    try {
                      setSavingProfile(true);
                      const payload: any = {
                        name: ownerProfile.name || null,
                        phone: ownerProfile.phone || null,
                        email: ownerProfile.email || null,
                        address: ownerProfile.address || null,
                        emergency_contact: ownerProfile.emergency_contact || null,
                      };
                      Object.keys(payload).forEach((k) => {
                        if (payload[k] === null) delete payload[k];
                      });
                      const r = await api.put('/api/user', payload);
                      // If server returns updated user, update local state and persist
                      if (r && r.data && r.data.user) {
                        const u = r.data.user;
                        setOwnerProfile({
                          name: u.name || '',
                          phone: u.phone || u.mobile_number || '',
                          email: u.email || '',
                          address: u.address || '',
                          emergency_contact: u.emergency_contact || '',
                        });
                        setUserAvatar(u.avatar || u.image || userAvatar);
                        try {
                          await AsyncStorage.setItem('user', JSON.stringify(u));
                        } catch (e) {
                          /* ignore persistence errors */
                        }
                      }
                      alert('Profile saved');
                      // close modal to reflect updated profile
                      setShowProfileModal(false);
                    } catch (e: any) {
                      console.warn(
                        'save owner profile failed',
                        e && (e.response?.data || e.message)
                      );
                      alert('Failed to save profile');
                    } finally {
                      setSavingProfile(false);
                    }
                  }}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff' }}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {/* Aadhaar / ID documents if available (show view/upload buttons) */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '700' }}>Aadhaar / ID</Text>
              {(() => {
                const findDoc = (regex: RegExp) =>
                  (propertyDocs || []).find((d: any) =>
                    Boolean(
                      (d.name && regex.test(String(d.name))) ||
                        (d.title && regex.test(String(d.title))) ||
                        (d.file_url && regex.test(String(d.file_url)))
                    )
                  );
                const aadhaar = findDoc(/aadhaar|aadhar/i);
                const pan = findDoc(/\bpan\b/i);

                return (
                  <>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      {aadhaar ? (
                        <TouchableOpacity
                          style={[
                            styles.smallBtnClose,
                            { flexDirection: 'row', alignItems: 'center' },
                          ]}
                          onPress={() => handlePreview(aadhaar.file_url || aadhaar.uri || null)}
                        >
                          <Ionicons name="eye-outline" size={16} color="#374151" />
                          <Text style={{ marginLeft: 8 }}>View Aadhaar Card</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => uploadPropertyDocAs('Aadhaar')}
                          disabled={uploadingPropertyDoc}
                        >
                          {uploadingPropertyDoc ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                              <Text style={{ color: '#fff', marginLeft: 8 }}>Upload Aadhaar</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {pan ? (
                        <TouchableOpacity
                          style={[
                            styles.smallBtnClose,
                            { flexDirection: 'row', alignItems: 'center' },
                          ]}
                          onPress={() => handlePreview(pan.file_url || pan.uri || null)}
                        >
                          <Ionicons name="eye-outline" size={16} color="#374151" />
                          <Text style={{ marginLeft: 8 }}>View PAN Card</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => uploadPropertyDocAs('PAN')}
                          disabled={uploadingPropertyDoc}
                        >
                          {uploadingPropertyDoc ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                              <Text style={{ color: '#fff', marginLeft: 8 }}>Upload PAN</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    {/* Fallback message */}
                    {(propertyDocs || []).length === 0 ? (
                      <Text style={{ color: '#666', marginTop: 6 }}>No documents uploaded</Text>
                    ) : null}
                  </>
                );
              })()}
            </View>
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
                <Text style={{ color: '#fff' }}>Logout</Text>
              </TouchableOpacity>
            </View>

            {/* removed duplicate inline preview overlay to avoid duplicates; global modal below is used */}
          </View>
        </View>
      </Modal>

      {/* Global preview modal for Aadhaar/PAN and other files (shows when handlePreview is called) */}
      <Modal visible={showPreviewModal} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: Math.min(820, wp(98)),
              borderRadius: 10,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* top-right close */}
            <TouchableOpacity
              onPress={() => {
                setShowPreviewModal(false);
                setPreviewImageUrl(null);
              }}
              style={{ position: 'absolute', right: 8, top: 8, zIndex: 20, padding: 8 }}
              accessibilityLabel="Close preview"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            {previewImageUrl ? (
              // show image inline when possible; non-image URLs will fallback to the "no preview" block
              <Image
                source={{ uri: previewImageUrl }}
                style={{
                  width: '100%',
                  height: hp(60),
                  resizeMode: 'contain',
                  backgroundColor: '#000',
                }}
              />
            ) : previewTargetUrl ? (
              (() => {
                const url = previewTargetUrl;
                const isPdf = /^(data:application\/pdf)|.*\.(pdf)(\?.*)?$/i.test(url);
                if (isPdf) {
                  if (Platform.OS === 'web') {
                    try {
                      if (typeof window !== 'undefined') window.open(url, '_blank');
                    } catch (e) {}
                    return (
                      <View
                        style={{
                          backgroundColor: '#111',
                          padding: 18,
                          minHeight: 240,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', marginBottom: 12 }}>
                          Opened PDF in a new tab.
                        </Text>
                        <TouchableOpacity
                          style={[styles.smallBtn, { paddingHorizontal: 16 }]}
                          onPress={() => setShowPreviewModal(false)}
                        >
                          <Text style={{ color: '#fff' }}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  let sourceUri = url;
                  if (/^https?:\/\//i.test(url)) {
                    sourceUri = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
                      url
                    )}`;
                  }
                  return (
                    <View style={{ width: '100%', height: hp(65), backgroundColor: '#000' }}>
                      <WebView
                        source={{ uri: sourceUri }}
                        style={{ flex: 1 }}
                        onLoadStart={() => setPreviewLoading(true)}
                        onLoadEnd={() => setPreviewLoading(false)}
                        onError={(e: any) => {
                          console.warn('[OwnerScreen] WebView load error', e);
                          setPreviewLoading(false);
                        }}
                      />
                      {previewLoading ? (
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            zIndex: 50,
                          }}
                        >
                          <ActivityIndicator size="large" color="#fff" />
                          <Text style={{ color: '#fff', marginTop: 12 }}>Loading preview...</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                }

                // not pdf: show fallback with open button
                return (
                  <View
                    style={{
                      backgroundColor: '#111',
                      padding: 18,
                      minHeight: 240,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', marginBottom: 12 }}>
                      No inline preview available for this file.
                    </Text>
                    <TouchableOpacity
                      style={[styles.smallBtn, { paddingHorizontal: 16 }]}
                      onPress={async () => {
                        try {
                          const target = previewTargetUrl;
                          if (!target) return;
                          if (Platform.OS === 'web' && typeof window !== 'undefined') {
                            window.open(target, '_blank');
                            return;
                          }
                          await Linking.openURL(target);
                        } catch (e) {
                          console.warn('open external preview failed', e);
                          try {
                            const msg = e && (e as any).message ? (e as any).message : String(e);
                            alert('Cannot open preview: ' + msg);
                          } catch (ee) {}
                        }
                      }}
                    >
                      <Text style={{ color: '#fff' }}>Open in browser / external viewer</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()
            ) : (
              <View
                style={{
                  backgroundColor: '#111',
                  padding: 18,
                  minHeight: 240,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', marginBottom: 12 }}>
                  No inline preview available for this file.
                </Text>
                <TouchableOpacity
                  style={[styles.smallBtn, { paddingHorizontal: 16 }]}
                  onPress={async () => {
                    try {
                      const target = previewTargetUrl;
                      if (!target) return;
                      // attempt same openExternal logic: handle data: application/pdf -> write to file
                      const isPdf = /^(data:application\/pdf)|.*\.(pdf)(\?.*)?$/i.test(target);
                      if (
                        isPdf &&
                        target.startsWith('data:application/pdf') &&
                        Platform.OS !== 'web'
                      ) {
                        try {
                          const base64 = target.replace(/^data:application\/pdf;base64,/, '');
                          const fname = `agreement_retry_${Date.now()}.pdf`;
                          const fileUri = FileSystem.cacheDirectory + fname;
                          await FileSystem.writeAsStringAsync(fileUri, base64, {
                            encoding: FileSystem.EncodingType.Base64,
                          });
                          await Linking.openURL(fileUri);
                          return;
                        } catch (e) {
                          console.warn('retry open pdf failed', e);
                        }
                      }
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(target, '_blank');
                        return;
                      }
                      await Linking.openURL(target);
                    } catch (e) {
                      console.warn('open external preview failed', e);
                      try {
                        const msg = e && (e as any).message ? (e as any).message : String(e);
                        alert('Cannot open preview: ' + msg);
                      } catch (ee) {}
                    }
                  }}
                >
                  <Text style={{ color: '#fff' }}>Open in browser / external viewer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* footer kept for accessibility on small screens */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                padding: 12,
                alignItems: 'center',
              }}
            >
              {(previewImageUrl || previewTargetUrl) && (
                <TouchableOpacity
                  style={[styles.smallBtn, { marginRight: 8 }]}
                  onPress={() => {
                    try {
                      downloadAgreement(previewImageUrl || previewTargetUrl);
                    } catch (e) {
                      console.warn('download from preview failed', e);
                    }
                  }}
                >
                  <Text style={{ color: '#fff' }}>Download</Text>
                </TouchableOpacity>
              )}

              {previewLoading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              ) : null}

              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => {
                  setShowPreviewModal(false);
                  setPreviewImageUrl(null);
                }}
              >
                <Text style={{ color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Helpline add modal */}
      <Modal visible={showHelplineModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { width: Math.min(360, wp(95)) }]}>
            <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 8 }}>Add Helpline</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={helplineName}
              onChangeText={setHelplineName}
              placeholder="E.g. Security"
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={helplinePhone}
              onChangeText={setHelplinePhone}
              placeholder="10/11/12 digit number"
              keyboardType="phone-pad"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallBtnClose, { marginRight: 8 }]}
                onPress={() => setShowHelplineModal(false)}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={async () => {
                  try {
                    await api.post('/api/owner/helplines', {
                      name: helplineName,
                      phone: helplinePhone,
                    });
                    // refresh list
                    try {
                      const r = await api.get('/api/owner/helplines');
                      setHelplines(r.data.helplines || r.data || []);
                    } catch (e) {}
                    setShowHelplineModal(false);
                  } catch (e: any) {
                    console.warn('add helpline failed', e && (e.response?.data || e.message));
                    alert('Failed to add helpline');
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Owner: Raise Complaint modal */}
      <Modal visible={showOwnerComplaintModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raise Complaint</Text>
            <TextInput
              placeholder="Title"
              style={styles.input}
              value={ownerComplaintForm.title}
              onChangeText={(t) => setOwnerComplaintForm((s) => ({ ...s, title: t }))}
            />
            <TextInput
              placeholder="Description"
              style={[styles.input, { height: 120 }]}
              value={ownerComplaintForm.description}
              onChangeText={(t) => setOwnerComplaintForm((s) => ({ ...s, description: t }))}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={async () => {
                  try {
                    const url = await pickAndUploadFile({
                      accept: 'image/*',
                      fallbackApiPath: '/api/owner/upload',
                    });
                    if (url) setOwnerComplaintForm((s) => ({ ...s, image: url }));
                  } catch (e) {
                    console.warn('pick image failed', e);
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>Attach Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={async () => {
                  try {
                    const payload: any = {
                      title: ownerComplaintForm.title,
                      description: ownerComplaintForm.description,
                    };
                    if (ownerComplaintForm.image) payload.file_url = ownerComplaintForm.image;
                    await api.post('/api/complaints', payload);
                    alert('Complaint raised');
                    setShowOwnerComplaintModal(false);
                    setOwnerComplaintForm({ title: '', description: '', image: '' });
                  } catch (e) {
                    console.warn('raise complaint failed', e);
                    alert('Failed to raise complaint');
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>Raise</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={styles.smallBtnClose}
                onPress={() => setShowOwnerComplaintModal(false)}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Owner: Bills creation modal */}
      <Modal visible={showOwnerBillsModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Bill</Text>
            <Text style={styles.label}>
              Select Tenant <Text style={{ color: '#d00' }}>*</Text>
            </Text>
            <View style={{ marginBottom: 8 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#e6e6e6',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <PickerLike
                  flats={tenants.map((t) => ({ id: t.id, flat_no: t.name }))}
                  value={ownerBillForm.tenantId}
                  onChange={(id: any) => setOwnerBillForm((s) => ({ ...s, tenantId: id }))}
                  placeholder="Select tenant (required)"
                />
              </View>
            </View>
            <Text style={styles.label}>Type</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {['rent', 'electricity', 'other'].map((tp) => (
                <TouchableOpacity
                  key={tp}
                  onPress={() => setOwnerBillForm((s) => ({ ...s, type: tp }))}
                  style={[styles.segment, ownerBillForm.type === tp ? styles.segmentActive : {}]}
                >
                  <Text style={ownerBillForm.type === tp ? { color: '#fff' } : {}}>
                    {tp === 'rent' ? 'Rent' : tp === 'electricity' ? 'Electricity' : 'Other'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={ownerBillForm.amount}
              onChangeText={(t) => setOwnerBillForm((s) => ({ ...s, amount: t }))}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={ownerBillForm.description}
              onChangeText={(t) => setOwnerBillForm((s) => ({ ...s, description: t }))}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallBtn, { marginRight: 8 }]}
                onPress={async () => {
                  try {
                    if (!ownerBillForm.tenantId) {
                      Alert.alert('Validation', 'Please select a tenant before creating a bill');
                      return;
                    }
                    const payload: any = {
                      title:
                        ownerBillForm.type === 'rent'
                          ? 'Monthly Rent'
                          : ownerBillForm.type === 'electricity'
                          ? 'Electricity Bill'
                          : 'Other Bill',
                      type: ownerBillForm.type || 'other',
                      description: ownerBillForm.description,
                      cost: Number(ownerBillForm.amount) || 0,
                      tenantId: ownerBillForm.tenantId,
                      date: new Date().toISOString().slice(0, 10),
                      status: 'pending',
                    };
                    const r = await api.post('/api/owner/bills', payload);
                    const created = r.data && (r.data.bill || r.data);
                    if (created) setBills((s) => [created, ...s]);
                    alert('Bill created');
                    setShowOwnerBillsModal(false);
                    setOwnerBillForm({
                      tenantId: '',
                      type: 'rent',
                      amount: '',
                      description: '',
                    });
                  } catch (e) {
                    console.warn('create bill failed', e);
                    alert('Failed to create bill');
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallBtnClose}
                onPress={() => setShowOwnerBillsModal(false)}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// (uploadPropertyDocAs is implemented inside the component so it can access state setters)

// Small picker-like dropdown implemented using TouchableOpacity + modal for simplicity
function PickerLike({ flats, value, onChange, disabled, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const selected = flats.find((f: any) => f.id === value);
  const hint = placeholder || 'Select flat (optional)';
  return (
    <>
      <TouchableOpacity
        onPress={() => {
          if (disabled) return;
          setOpen(true);
        }}
        style={{ padding: 10, backgroundColor: '#fff' }}
      >
        <Text>{selected ? `${selected.flat_no}` : hint} </Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 8, maxHeight: 400 }}>
            <ScrollView>
              {flats.map((f: any) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                  style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
                >
                  <Text>{f.flat_no}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 8 }}>
                <Text>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  row: { flexDirection: 'row' },
  sidebar: { width: 260, padding: 16, backgroundColor: '#2d3436', justifyContent: 'space-between' },
  bottomNav: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: '#2d3436',
  },
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
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuText: { color: '#fff', marginLeft: 12 },
  menuActive: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 8 },
  sidebarFooter: { paddingVertical: 12 },
  main: { flex: 1, padding: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 20, fontWeight: '700' },
  profilePic: { width: 36, height: 36, borderRadius: 18, marginLeft: 12 },
  iconBtn: { padding: 6, marginRight: 8, backgroundColor: '#fff', borderRadius: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statsRowRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statCard: {
    width: 150,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginRight: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statCardMobile: { width: '48%', padding: 10 },
  statTitle: { color: '#888' },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#0984e3',
    marginRight: 8,
  },
  actionText: { color: '#fff', marginLeft: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    flex: 1,
  },
  filterBtn: { padding: 8, marginLeft: 6, borderRadius: 6, backgroundColor: '#fff' },
  filterActive: { backgroundColor: '#dfe6e9' },
  tenantCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tenantName: { fontWeight: '700' },
  tenantMeta: { color: '#666' },
  tenantDates: { color: '#666', marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeActive: { backgroundColor: '#00b894' },
  badgeInactive: { backgroundColor: '#636e72' },
  tenantList: { marginTop: 12 },
  maintCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
  },
  docRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  docRowMobile: { paddingVertical: 10 },
  mobileTopBar: {
    width: '100%',
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  avatarPlaceholderSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerNameMobile: { fontWeight: '700' },
  ownerMetaMobile: { color: '#666', fontSize: 12 },
  iconAction: { padding: 8, marginLeft: 8, borderRadius: 8, backgroundColor: '#fff' },
  headerBadge: {
    position: 'absolute',
    right: -2,
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
  bottomNavBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 18,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 12, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  label: { color: '#333', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  smallBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallBtnClose: {
    backgroundColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  closeText: { color: '#111' },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  segmentActive: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  calendarContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarNav: { fontSize: 20, color: '#333', paddingHorizontal: 8 },
  calendarTitle: { fontWeight: '700', color: '#222' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: '#666', marginBottom: 6 },
  calendarCell: {
    width: `${100 / 7}%`,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: { color: '#111' },
  inputWithIcon: { position: 'relative', justifyContent: 'center' },
  calendarIcon: { position: 'absolute', right: 12, top: 12 },
  inlineError: { color: '#ff4d4f', marginTop: 6, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 84,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    zIndex: 999,
  },
  debugBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 998,
  },
  debugText: { color: '#fff', fontSize: 12 },
  addFab: {
    position: 'absolute',
    right: 16,
    bottom: 150,
    backgroundColor: '#1abc9c',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 1001,
  },
  headerAddBtn: {
    backgroundColor: '#1abc9c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBigBtn: {
    backgroundColor: '#1abc9c',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugAlwaysBar: {
    width: '100%',
    backgroundColor: '#ffe6e6',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debugAlwaysText: { color: '#900', fontWeight: '700' },
  debugAlwaysBtn: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
