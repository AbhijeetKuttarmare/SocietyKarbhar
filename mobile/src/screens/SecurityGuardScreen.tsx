import React, { useEffect, useState, useRef, useContext, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Modal,
  Image,
  Linking,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { notify } from '../services/notifier';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import UserProfileForm from '../components/UserProfileForm';
import VisitorsScreen from './Admin/Visitors';
import CCTVScreen from './CCTVScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pickAndUploadProfile, { pickAndUploadFile } from '../services/uploadProfile';
import { BottomTabContext } from '../contexts/BottomTabContext';
type Props = { user: any; onLogout?: () => void; navigation?: any };

type TabKey = 'home' | 'scan' | 'cctv' | 'directory' | 'profile' | 'visitors';

export default function SecurityGuardScreen({ user, onLogout, navigation }: Props) {
  const ctx = useContext(BottomTabContext);
  const [activeTab, setActiveTab] = useState<TabKey>((ctx && (ctx.activeKey as TabKey)) || 'home');

  // Home state
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [insideCount, setInsideCount] = useState<number | null>(null);

  // Scan/New Visitor state
  const [manualName, setManualName] = useState('');
  const [manualFlat, setManualFlat] = useState('');
  const [manualWing, setManualWing] = useState('');
  const [manualWingLabel, setManualWingLabel] = useState('');
  const [manualFlatLabel, setManualFlatLabel] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualPeople, setManualPeople] = useState('1');
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [additionalVisitorsNames, setAdditionalVisitorsNames] = useState('');
  const [additionalSelfies, setAdditionalSelfies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Inside visitors list
  const [insideVisitors, setInsideVisitors] = useState<any[]>([]);
  const [loadingInside, setLoadingInside] = useState(false);

  // Flat directory
  const [flats, setFlats] = useState<any[]>([]);
  const [wings, setWings] = useState<any[]>([]);
  const [flatQuery, setFlatQuery] = useState('');
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Profile
  const [profile, setProfile] = useState<any | null>(null);
  const [showWingModal, setShowWingModal] = useState(false);
  const [showFlatModal, setShowFlatModal] = useState(false);
  const [directoryWing, setDirectoryWing] = useState('');
  const [wingModalTarget, setWingModalTarget] = useState<'manual' | 'directory'>('manual');
  const [flatModalTarget, setFlatModalTarget] = useState<'manual' | 'directory'>('manual');
  const [expandedWings, setExpandedWings] = useState<Record<string, boolean>>({});

  // Time / date
  const [now, setNow] = useState(new Date());

  // CCTV feeds
  const [cameras, setCameras] = useState<any[]>([]);
  const [loadingCams, setLoadingCams] = useState(false);
  const [guardFeedRtsp, setGuardFeedRtsp] = useState<string | null>(null);

  const pollRef = useRef<any>(null);

  useEffect(() => {
    // update clock every second
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // initial load
    refreshAll();
    // polling every 30s
    pollRef.current = setInterval(() => refreshAll(), 30 * 1000);
    return () => clearInterval(pollRef.current);
  }, []);

  // add header buttons (notifications + logout) on the right
  useLayoutEffect(() => {
    try {
      navigation.setOptions({
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <TouchableOpacity
              style={{ padding: 8, marginRight: 6 }}
              onPress={() => {
                try {
                  // Navigate to Notifications screen if available
                  navigation.navigate && navigation.navigate('Notifications');
                } catch (e) {
                  notify({ type: 'info', message: 'Notifications screen not available' });
                }
              }}
            >
              <Ionicons name="notifications-outline" size={22} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={async () => {
                try {
                  if (typeof onLogout === 'function') return onLogout();
                  // fallback: clear token and try navigate to Login
                  try {
                    await AsyncStorage.removeItem('token');
                  } catch (er) {}
                  if (navigation.reset) {
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  } else if (navigation.navigate) {
                    navigation.navigate('Login');
                  }
                } catch (e) {
                  notify({ type: 'error', message: 'Logout failed' });
                }
              }}
            >
              <MaterialIcons name="logout" size={22} color="#111" />
            </TouchableOpacity>
          </View>
        ),
      });
    } catch (e) {}
  }, [navigation, onLogout]);

  useEffect(() => {
    // when tab changes, refresh relevant data immediately
    if (activeTab === 'home') fetchCounts();
    else if (activeTab === 'cctv') {
      // when CCTV tab selected, fetch camera list
      fetchCCTVs();
      // check if a camera RTSP was requested to open
      (async () => {
        try {
          const rt = await AsyncStorage.getItem('openCameraRtsp');
          if (rt) {
            await AsyncStorage.removeItem('openCameraRtsp');
            setGuardFeedRtsp(rt);
          }
        } catch (e) {}
      })();
    } else if (activeTab === 'directory') fetchFlats();
    else if (activeTab === 'scan') fetchFlats();
    else if (activeTab === 'profile') fetchProfile();
    // keep global BottomTab in sync
    try {
      if (ctx && ctx.activeKey !== activeTab) ctx.setActiveKey(activeTab);
    } catch (e) {}
  }, [activeTab]);

  // Keep local activeTab in sync when global BottomTab changes
  useEffect(() => {
    try {
      if (ctx && ctx.activeKey && ctx.activeKey !== activeTab) {
        const k = ctx.activeKey as TabKey;
        // only accept keys that this screen understands
        const allowed: TabKey[] = ['home', 'scan', 'cctv', 'directory', 'profile'];
        if (allowed.includes(k)) setActiveTab(k);
      }
    } catch (e) {}
  }, [ctx?.activeKey]);

  async function refreshAll() {
    fetchCounts();
    fetchInsideVisitors();
    fetchFlats(false);
    fetchProfile();
  }

  async function fetchCCTVs() {
    setLoadingCams(true);
    try {
      // Prefer tenant/guard-accessible cameras. Try admin cameras endpoint first (may be shared),
      // then fall back to a tenant-specific /api/cctvs if available. If both fail, show empty list
      // so UI indicates there are no configured cameras instead of showing dummy feeds.
      let cams: any[] = [];
      // try admin cameras (some deployments expose this read-only to tenants/guards)
      try {
        const r1 = await api.get('/api/admin/cameras');
        console.debug('[SecurityGuard] /api/admin/cameras ->', r1 && r1.status, r1 && r1.data);
        if (r1 && r1.data && Array.isArray(r1.data.cameras)) cams = r1.data.cameras;
      } catch (e) {
        const err: any = e;
        console.warn(
          '[SecurityGuard] /api/admin/cameras error',
          err && (err.response || err.message || err)
        );
      }

      if (!cams.length) {
        try {
          // tenant/guard-facing endpoint
          const r2 = await api.get('/api/cctvs');
          console.debug('[SecurityGuard] /api/cctvs ->', r2 && r2.status, r2 && r2.data);
          if (r2 && r2.data && Array.isArray(r2.data.cameras)) cams = r2.data.cameras;
        } catch (e) {
          const err: any = e;
          console.warn(
            '[SecurityGuard] /api/cctvs error',
            err && (err.response || err.message || err)
          );
        }
      }

      setCameras(cams || []);
    } catch (e) {
      setCameras([]);
    } finally {
      setLoadingCams(false);
    }
  }

  async function fetchCounts() {
    try {
      const r1 = await api.get('/api/visitors', { params: { period: 'daily', limit: 1 } });
      const todayItems = (r1 && r1.data && r1.data.visitors) || [];
      setTodayCount(Array.isArray(todayItems) ? todayItems.length : 0);
    } catch (e) {
      setTodayCount(null);
    }

    try {
      const r2 = await api.get('/api/visitors', { params: { status: 'IN', limit: 1000 } });
      const inside = (r2 && r2.data && r2.data.visitors) || [];
      setInsideCount(Array.isArray(inside) ? inside.length : 0);
    } catch (e) {
      setInsideCount(null);
    }
  }

  async function fetchInsideVisitors() {
    setLoadingInside(true);
    try {
      const r = await api.get('/api/visitors', { params: { status: 'IN', limit: 500 } });
      setInsideVisitors((r && r.data && r.data.visitors) || []);
    } catch (e) {
      setInsideVisitors([]);
    } finally {
      setLoadingInside(false);
    }
  }

  async function fetchFlats(resetQuery = true) {
    setLoadingFlats(true);
    try {
      // Fetch wings->flats->users structure (tenant-scoped) so guards see same data as admin users tab
      const r = await api.get('/api/users');
      const wingsData = (r && r.data && r.data.wings) || [];
      setWings(wingsData || []);
      // flatten wings -> flats for quick flat list
      const flatList: any[] = [];
      for (const w of wingsData || []) {
        const flatsInW = (w.flats || []).map((f: any) => ({
          ...(f || {}),
          building: w,
          buildingName: w.name,
          wingName: w.name,
          wingId: w.id,
        }));
        flatList.push(...flatsInW);
      }
      try {
        console.log(
          '[SecurityGuard] fetched wings=',
          (wingsData || []).length,
          'flats=',
          flatList.length
        );
      } catch (e) {}
      setFlats(flatList);
      if (resetQuery) setFlatQuery('');
    } catch (e) {
      setFlats([]);
    } finally {
      setLoadingFlats(false);
    }
  }

  async function fetchProfile() {
    try {
      const r = await api.get('/api/guard/me');
      setProfile(r && r.data && r.data.guard ? r.data.guard : r.data.user || null);
    } catch (e) {
      // fallback to passed user
      setProfile(user || null);
    }
  }

  // Open configured Google Form or provided link
  function openFormLink() {
    const formUrl = (profile && profile.formUrl) || 'https://docs.google.com/forms';
    Linking.openURL(formUrl).catch(() => notify({ type: 'error', message: 'Failed to open form' }));
  }

  async function pickSelfie() {
    try {
      const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
      if (!cancelled && asset && asset.base64)
        setSelfieBase64(`data:image/jpg;base64,${asset.base64}`);
    } catch (e) {
      notify({ type: 'error', message: 'Camera error: ' + String(e) });
    }
  }

  async function pickAdditionalSelfies() {
    try {
      // allow multiple selection if available, otherwise pick repeatedly
      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.6,
        allowsMultipleSelection: true,
      });
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      if ((res as any).selected && Array.isArray((res as any).selected)) {
        const arr = (res as any).selected.map((a: any) => `data:image/jpg;base64,${a.base64}`);
        setAdditionalSelfies((s) => [...s, ...arr]);
      } else if (!cancelled) {
        const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
        if (asset && asset.base64)
          setAdditionalSelfies((s) => [...s, `data:image/jpg;base64,${asset.base64}`]);
      }
    } catch (e) {
      notify({ type: 'error', message: 'Pick photo error: ' + String(e) });
    }
  }

  async function submitManualVisitor() {
    // require a name and at least one of flat or wing; additional visitors are optional
    if (!manualName || (!manualFlat && !manualWing)) {
      notify({ type: 'warning', message: 'Please fill visitor name and select wing or flat' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        mainVisitorName: manualName,
        flatId: manualFlat,
        wingId: manualWing,
        reason: manualReason || null,
        numberOfPeople: Number(manualPeople) || 1,
        selfie: selfieBase64 || null,
        additionalVisitors: additionalVisitorsNames || null,
        additionalSelfies: additionalSelfies.length ? additionalSelfies : null,
        gateId: profile?.gateId || profile?.gateName || null,
      };
      // POST to user-provided endpoint
      const r = await api.post('/api/visitors', payload);
      if (r && r.data && (r.data.visitor || r.data.id)) {
        notify({ type: 'success', message: 'Visitor ID generated successfully' });
        // reset form
        setManualName('');
        setManualFlat('');
        setManualFlatLabel('');
        setManualWing('');
        setManualWingLabel('');
        setManualReason('');
        setManualPeople('1');
        setSelfieBase64(null);
        // refresh lists
        fetchCounts();
        fetchInsideVisitors();
      } else {
        notify({ type: 'info', message: 'Visitor added (no id returned)' });
      }
    } catch (e: any) {
      try {
        console.error(
          'submitManualVisitor failed',
          e && e.response ? e.response.data || e.response : e
        );
      } catch (er) {}
      const backendMsg =
        (e &&
          e.response &&
          e.response.data &&
          (e.response.data.error || JSON.stringify(e.response.data))) ||
        e.message ||
        String(e);
      notify({ type: 'error', message: String(backendMsg) });
    } finally {
      setSubmitting(false);
    }
  }

  async function checkoutVisitor(id: string) {
    try {
      await api.patch(`/api/visitors/${id}`, { status: 'OUT' });
      // refresh
      fetchCounts();
      fetchInsideVisitors();
    } catch (e) {
      notify({ type: 'error', message: 'Checkout failed: ' + String(e) });
    }
  }

  // Simple search filter for flats
  const filteredFlats = flats
    .filter((f) => {
      if (directoryWing) {
        const w = f.building || f.wing || f.Wing || f.buildingName || f.wingName || f.wingId || '';
        const key = (w && (w.name || w.building_name || w)) || '';
        if (String(key) !== String(directoryWing)) return false;
      }
      return true;
    })
    .filter((f) => {
      if (!flatQuery) return true;
      const q = String(flatQuery).toLowerCase();
      return (
        String(f.flat_no || '')
          .toLowerCase()
          .includes(q) ||
        String(f.owner_name || f.owner?.name || '')
          .toLowerCase()
          .includes(q) ||
        String(f.tenant_name || f.tenant?.name || '')
          .toLowerCase()
          .includes(q)
      );
    });

  const societyName =
    (profile && (profile.society?.name || profile.societyName)) ||
    (user && (user.society?.name || user.societyName)) ||
    '';

  // Profile helpers: edit avatar and save profile (similar to AdminProfile)
  const onEditAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify({ type: 'warning', message: 'Permission to access photos is required' });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      const cancelled = (res as any).canceled === true || (res as any).cancelled === true;
      if (cancelled) return;
      const asset = (res as any).assets ? (res as any).assets[0] : (res as any);
      if (!asset || !asset.uri) {
        notify({ type: 'error', message: 'Could not read image data' });
        return;
      }
      const uri: string = asset.uri;
      setProfile((p: any) => ({ ...(p || {}), avatar: uri }));
    } catch (e) {
      console.warn('pick avatar failed', e);
      notify({ type: 'error', message: 'Could not pick image' });
    }
  };

  const saveProfile = async () => {
    try {
      const payload: any = {};
      for (const k of ['name', 'phone', 'address', 'email', 'emergency_contact']) {
        if (typeof (profile as any)[k] !== 'undefined') payload[k] = (profile as any)[k];
      }

      // If avatar is a local URI (not a remote http(s) URL or data:), upload it via multipart to /api/user/avatar
      const avatarVal = profile?.avatar;
      if (
        avatarVal &&
        typeof avatarVal === 'string' &&
        !/^https?:\/\//i.test(avatarVal) &&
        !/^data:/i.test(avatarVal)
      ) {
        try {
          const formData: any = new FormData();
          try {
            const resp = await fetch(avatarVal);
            const blob = await resp.blob();
            formData.append('file', blob, avatarVal.split('/').pop() || 'avatar.jpg');
          } catch (e) {
            // fallback for some RN environments
            formData.append('file', {
              uri: avatarVal,
              name: avatarVal.split('/').pop() || 'avatar.jpg',
            } as any);
          }

          const token = await AsyncStorage.getItem('token');
          const headers: any = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          const base = (api.defaults && (api.defaults as any).baseURL) || '';
          const uploadUrl = `${String(base).replace(/\/$/, '')}/api/user/avatar`;
          const resp = await fetch(uploadUrl, { method: 'POST', body: formData, headers });
          const jd = await resp.json().catch(() => ({} as any));
          if (resp.ok && jd && jd.user) {
            setProfile(jd.user);
            try {
              await AsyncStorage.setItem('user', JSON.stringify(jd.user));
            } catch (e) {}
          } else if (resp.ok && jd && jd.url) {
            profile.avatar = jd.url;
          }
        } catch (e) {
          console.warn('avatar upload failed', e);
        }
      }

      // update user fields
      try {
        const r = await api.put('/api/user', payload);
        if (r && r.data && r.data.user) {
          setProfile(r.data.user);
          try {
            await AsyncStorage.setItem('user', JSON.stringify(r.data.user));
          } catch (e) {}
        }
      } catch (e) {
        console.warn('save profile fields failed', e);
      }

      // finally refresh me
      try {
        const me = await api.get('/api/user/me');
        if (me && me.data && me.data.user) {
          setProfile(me.data.user);
          try {
            await AsyncStorage.setItem('user', JSON.stringify(me.data.user));
          } catch (e) {}
        }
      } catch (e) {}

      notify({ type: 'success', message: 'Profile saved' });
    } catch (e) {
      console.warn('saveProfile failed', e);
      notify({ type: 'error', message: 'Save failed' });
    }
  };

  return (
    <View style={styles.container}>
      {/* Mobile top bar (admin-style) */}
      <View style={styles.mobileTopBar}>
        <View style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
          <Text numberOfLines={1} style={styles.mobileTitle}>
            {societyName || 'Society Karbhar'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={styles.iconBtn}
            accessible
            accessibilityLabel="Visitors"
            onPress={() => setActiveTab('visitors')}
          >
            <Ionicons name="eye-outline" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              try {
                navigation && navigation.navigate && navigation.navigate('Notifications');
              } catch (e) {
                notify({ type: 'info', message: 'Notifications screen not available' });
              }
            }}
          >
            <Ionicons name="notifications-outline" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content area */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View>
              <Text style={styles.title}>Home</Text>
              <Text style={styles.timeStamp}>{now.toLocaleString()}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Gate</Text>
              <Text style={styles.cardValue}>
                {profile?.gateName || profile?.gateId || 'Main Gate'}
              </Text>
            </View>

            <View style={styles.row}>
              <View style={styles.smallCard}>
                <Text style={styles.smallTitle}>Today's Visitors</Text>
                <Text style={styles.smallValue}>{todayCount ?? '-'}</Text>
              </View>
              <View style={styles.smallCard}>
                <Text style={styles.smallTitle}>Active Inside</Text>
                <Text style={styles.smallValue}>{insideCount ?? '-'}</Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openFormLink()}>
                <Text style={styles.actionText}>Scan Visitor QR (Open Form)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: 8 }]}
                onPress={() => setActiveTab('scan')}
              >
                <Text style={styles.actionText}>Add New Visitor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: 8 }]}
                onPress={() => setActiveTab('directory')}
              >
                <Text style={styles.actionText}>Flat Directory</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {activeTab === 'scan' && (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.title}>Scan / New Visitor</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => openFormLink()}>
              <Text style={styles.actionText}>Scan QR (Open Form)</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>Visitor Name</Text>
              <TextInput style={styles.input} value={manualName} onChangeText={setManualName} />
              <Text style={styles.label}>Wing</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => (setWingModalTarget('manual'), setShowWingModal(true))}
              >
                <Text>{manualWingLabel || manualWing || 'Select Wing'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Flat</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={async () => {
                  setFlatModalTarget('manual');
                  // ensure flats are loaded for the dropdown
                  try {
                    await fetchFlats(false);
                  } catch (e) {}
                  setShowFlatModal(true);
                }}
              >
                <Text>{manualFlatLabel || manualFlat || 'Select Flat'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Reason</Text>
              <TextInput style={styles.input} value={manualReason} onChangeText={setManualReason} />
              <Text style={styles.label}>Number of People</Text>
              <TextInput
                style={styles.input}
                value={manualPeople}
                onChangeText={setManualPeople}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>Names of Additional Visitors</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={additionalVisitorsNames}
                onChangeText={setAdditionalVisitorsNames}
                multiline
              />

              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Selfie</Text>
                {selfieBase64 ? (
                  <Image
                    source={{ uri: selfieBase64 }}
                    style={{ width: 120, height: 120, borderRadius: 8 }}
                  />
                ) : (
                  <TouchableOpacity style={styles.cameraButton} onPress={() => pickSelfie()}>
                    <Text style={{ color: '#fff' }}>Take Photo</Text>
                  </TouchableOpacity>
                )}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.label}>Selfies of Additional Visitors</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.cameraButton, { width: 120 }]}
                      onPress={() => pickAdditionalSelfies()}
                    >
                      <Text style={{ color: '#fff' }}>Pick Photos</Text>
                    </TouchableOpacity>
                    <ScrollView horizontal>
                      {additionalSelfies.map((s, i) => (
                        <Image
                          key={i}
                          source={{ uri: s }}
                          style={{ width: 64, height: 64, borderRadius: 6, marginLeft: 8 }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => submitManualVisitor()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff' }}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {activeTab === 'cctv' && (
          <View style={{ flex: 1 }}>
            <CCTVScreen
              user={user}
              navigation={navigation}
              cameras={cameras}
              loading={loadingCams}
            />
          </View>
        )}

        {activeTab === 'visitors' && (
          <View style={{ flex: 1 }}>
            <VisitorsScreen useAdminApi={false} />
          </View>
        )}

        {activeTab === 'directory' && (
          <View style={{ flex: 1, padding: 12 }}>
            <Text style={styles.title}>Flat Directory</Text>
            {/* Wing chips */}
            {wings && wings.length > 0 ? (
              <ScrollView
                horizontal
                style={{ marginBottom: 8 }}
                showsHorizontalScrollIndicator={false}
              >
                <TouchableOpacity
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: directoryWing ? '#e6f4ff' : '#fff',
                    marginRight: 8,
                  }}
                  onPress={() => setDirectoryWing('')}
                >
                  <Text style={{ color: '#111' }}>All</Text>
                </TouchableOpacity>
                {wings.map((w: any) => (
                  <TouchableOpacity
                    key={w.id || w.key || w.name}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: directoryWing === (w.name || w.label) ? '#e6f4ff' : '#fff',
                      marginRight: 8,
                    }}
                    onPress={() => setDirectoryWing(w.name || w.label)}
                  >
                    <Text>{w.name || w.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Search by flat no or name"
              value={flatQuery}
              onChangeText={setFlatQuery}
            />

            {loadingFlats ? (
              <ActivityIndicator style={{ marginTop: 24 }} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
                {(wings || [])
                  .filter((w: any) =>
                    directoryWing ? (w.name || w.label) === directoryWing : true
                  )
                  .map((wingItem: any) => {
                    const isOpen = !!expandedWings[wingItem.id];
                    return (
                      <View key={wingItem.id} style={styles.wingContainer}>
                        <TouchableOpacity
                          style={styles.wingHeader}
                          onPress={() =>
                            setExpandedWings((s) => ({ ...s, [wingItem.id]: !s[wingItem.id] }))
                          }
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="business" size={20} color="#374151" />
                            <Text style={styles.wingTitle}>{wingItem.name || wingItem.label}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: '#6b7280', marginRight: 8 }}>
                              {wingItem.flats ? wingItem.flats.length : 0} flats
                            </Text>
                            <Ionicons
                              name={isOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#6B7280"
                            />
                          </View>
                        </TouchableOpacity>

                        {isOpen &&
                          (wingItem.flats || [])
                            .filter((f: any) => {
                              if (!flatQuery) return true;
                              const q = String(flatQuery).toLowerCase();
                              return (
                                String(f.flat_no || '')
                                  .toLowerCase()
                                  .includes(q) ||
                                String((f.owner && f.owner.name) || '')
                                  .toLowerCase()
                                  .includes(q) ||
                                String((f.tenant && f.tenant.name) || '')
                                  .toLowerCase()
                                  .includes(q)
                              );
                            })
                            .map((flatItem: any) => (
                              <View
                                key={flatItem.id || flatItem.flat_no}
                                style={styles.flatContainer}
                              >
                                <View style={styles.flatHeader}>
                                  <Ionicons name="home" size={18} color="#4B5563" />
                                  <Text style={styles.flatTitle}>Flat {flatItem.flat_no}</Text>
                                </View>

                                <View style={styles.flatUsers}>
                                  {(flatItem.users || []).map((u: any, ui: number) => {
                                    const avatarUri = u?.avatar || u?.image || u?.photo || null;
                                    const initials = (u?.name || u?.phone || '')
                                      .split(' ')
                                      .map((p: string) => p[0])
                                      .join('')
                                      .slice(0, 2)
                                      .toUpperCase();
                                    return (
                                      <View
                                        key={`${u.id || u.phone || 'u'}-${ui}`}
                                        style={styles.userItemContainer}
                                      >
                                        <TouchableOpacity
                                          style={styles.userItem}
                                          onPress={() => {
                                            notify({
                                              type: 'info',
                                              title: u?.name || 'User',
                                              message: u?.phone || 'No phone',
                                            });
                                          }}
                                        >
                                          <View style={styles.userAvatarWrap}>
                                            {avatarUri ? (
                                              <Image
                                                source={{ uri: avatarUri }}
                                                style={styles.userAvatar}
                                              />
                                            ) : (
                                              <View
                                                style={[
                                                  styles.userAvatar,
                                                  styles.userAvatarFallback,
                                                ]}
                                              >
                                                <Text
                                                  style={{ color: '#374151', fontWeight: '700' }}
                                                >
                                                  {initials}
                                                </Text>
                                              </View>
                                            )}
                                          </View>

                                          <View style={styles.userInfo}>
                                            <Text style={styles.userName}>{u.name || u.phone}</Text>
                                            <Text style={styles.userRole}>
                                              {u.role || 'Resident'} • {u.phone || ''}
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
                  })}
              </ScrollView>
            )}
          </View>
        )}

        {activeTab === 'profile' && (
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.title}>Profile</Text>
            <UserProfileForm
              profile={profile || user || {}}
              onChange={(patch: any) =>
                setProfile((p: any) => ({ ...(p || {}), ...(patch || {}) }))
              }
              onEditAvatar={onEditAvatar}
              onCall={(p: string) => {
                try {
                  (require('react-native').Linking as any).openURL(`tel:${p}`);
                } catch (e) {}
              }}
              onSave={saveProfile}
              documents={[]}
              pickAndUploadFile={pickAndUploadFile}
              saveDocumentToServer={async () => null}
              uploadingDocId={null}
            />

            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 36 }} />
          </ScrollView>
        )}
      </View>

      {/* Wing / Flat selection modals (used by manual visitor form) */}
      <Modal visible={showWingModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#fff',
              maxHeight: 420,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
          >
            <View style={{ padding: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Select Wing</Text>
            </View>
            <FlatList
              data={wings}
              keyExtractor={(w) => String(w.id || w.name || w.label || Math.random())}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                  onPress={() => {
                    const name = item.name || item.label || item.name;
                    if (wingModalTarget === 'manual') {
                      // store id for payload and label for display
                      // Prefer storing the building UUID (item.id). If missing, leave blank so backend fallback can resolve by name.
                      setManualWing(item.id || '');
                      setManualWingLabel(name);
                      setManualFlat('');
                      setManualFlatLabel('');
                    } else setDirectoryWing(name);
                    setShowWingModal(false);
                  }}
                >
                  <Text>{item.name || item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => setShowWingModal(false)}
                style={{ alignItems: 'center' }}
              >
                <Text style={{ color: '#2563eb' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFlatModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#fff',
              maxHeight: 420,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
          >
            <View style={{ padding: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Select Flat</Text>
            </View>
            <FlatList
              data={flats.filter((f) => {
                if (!manualWing) return true;
                const wingId =
                  f.wingId || (f.building && (f.building.id || f.buildingId)) || f.Wing || '';
                // compare IDs as strings
                return String(wingId) === String(manualWing);
              })}
              keyExtractor={(f) => String(f.id || f.flat_no || Math.random())}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                  onPress={() => {
                    if (flatModalTarget === 'manual') {
                      setManualFlat(item.id || item.flat_no || '');
                      setManualFlatLabel(String(item.flat_no || item.name || item.id || ''));
                    }
                    setShowFlatModal(false);
                  }}
                >
                  <Text>{String(item.flat_no || item.id || 'Flat')}</Text>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>
                    {item.owner_name || item.owner?.name || ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => setShowFlatModal(false)}
                style={{ alignItems: 'center' }}
              >
                <Text style={{ color: '#2563eb' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Auto-opened camera feed modal for guards (when admin requested Open in CCTV tab) */}
      <Modal visible={!!guardFeedRtsp} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View
            style={{
              margin: 20,
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: 16,
              elevation: 4,
            }}
          >
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Camera Feed</Text>
            <Text numberOfLines={2} style={{ color: '#6b7280', marginBottom: 12 }}>
              {guardFeedRtsp}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{ marginRight: 12 }}
                onPress={() => {
                  try {
                    Linking.openURL(String(guardFeedRtsp));
                  } catch (e) {
                    notify({ type: 'error', message: 'Could not open URL' });
                  }
                }}
              >
                <Text style={{ color: '#2563eb' }}>Open in external player</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setGuardFeedRtsp(null);
                }}
              >
                <Text style={{ color: '#6b7280' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom tab bar */}
      <View style={styles.bottomBar}>
        <TabButton
          icon={
            <Ionicons name="home" size={20} color={activeTab === 'home' ? '#0ea5a4' : '#6b7280'} />
          }
          label="Home"
          onPress={() => setActiveTab('home')}
          active={activeTab === 'home'}
        />
        <TabButton
          icon={
            <MaterialIcons
              name="qr-code-scanner"
              size={20}
              color={activeTab === 'scan' ? '#0ea5a4' : '#6b7280'}
            />
          }
          label="Scan"
          onPress={() => setActiveTab('scan')}
          active={activeTab === 'scan'}
        />
        <TabButton
          icon={
            <Ionicons
              name="videocam"
              size={20}
              color={activeTab === 'cctv' ? '#0ea5a4' : '#6b7280'}
            />
          }
          label="CCTV"
          onPress={() => setActiveTab('cctv')}
          active={activeTab === 'cctv'}
        />
        <TabButton
          icon={
            <Ionicons
              name="business"
              size={20}
              color={activeTab === 'directory' ? '#0ea5a4' : '#6b7280'}
            />
          }
          label="Directory"
          onPress={() => setActiveTab('directory')}
          active={activeTab === 'directory'}
        />
        <TabButton
          icon={
            <Ionicons
              name="person"
              size={20}
              color={activeTab === 'profile' ? '#0ea5a4' : '#6b7280'}
            />
          }
          label="Profile"
          onPress={() => setActiveTab('profile')}
          active={activeTab === 'profile'}
        />
      </View>
    </View>
  );
}

function TabButton({ icon, label, onPress, active }: any) {
  return (
    <TouchableOpacity style={styles.tabButton} onPress={onPress}>
      {icon}
      <Text style={{ fontSize: 11, color: active ? '#0ea5a4' : '#6b7280', marginTop: 4 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  mobileTopBar: {
    height: Platform.OS === 'ios' ? 90 : 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
    backgroundColor: '#fff',
  },
  mobileTitle: { fontSize: 16, fontWeight: '700' },
  iconBtn: { padding: 8, marginLeft: 6 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  timeStamp: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'right' },
  card: { padding: 12, borderRadius: 10, backgroundColor: '#f8fafc', marginBottom: 12 },
  cardTitle: { color: '#6b7280', fontSize: 12 },
  cardValue: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  smallCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  smallTitle: { color: '#6b7280', fontSize: 12 },
  smallValue: { fontSize: 18, fontWeight: '700' },
  actionButton: { padding: 12, backgroundColor: '#eef2ff', borderRadius: 8, alignItems: 'center' },
  actionText: { color: '#3730a3', fontWeight: '700' },
  label: { color: '#374151', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', padding: 8, borderRadius: 6, marginTop: 6 },
  cameraButton: {
    backgroundColor: '#0ea5a4',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    width: 120,
  },
  primaryButton: { backgroundColor: '#0ea5a4', padding: 12, borderRadius: 8, alignItems: 'center' },
  visitorRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  checkoutButton: { backgroundColor: '#ef4444', padding: 8, borderRadius: 6 },
  flatRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  profileCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    backgroundColor: '#fff',
  },
  bottomBar: {
    height: Platform.OS === 'ios' ? 90 : 70,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e6e6e6',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    backgroundColor: '#fff',
  },
  tabButton: { alignItems: 'center' },
  secondary: { alignItems: 'center' },
  logoutBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  /* Directory / users styles (copied/adapted from AdminScreen) */
  wingContainer: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 0,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  wingHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  wingTitle: { marginLeft: 8, fontWeight: '700', fontSize: 15 },
  flatContainer: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  flatHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  flatTitle: { marginLeft: 8, fontWeight: '700' },
  flatUsers: { marginTop: 6 },
  userItemContainer: { marginBottom: 8 },
  userItem: { flexDirection: 'row', alignItems: 'center' },
  userAvatarWrap: { marginRight: 10 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6' },
  userAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  userInfo: { flex: 1 },
  userName: { fontWeight: '700' },
  userRole: { color: '#6b7280', fontSize: 12 },
});
