import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Button, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Dimensions, ScrollView, ActivityIndicator, Platform, StatusBar, useWindowDimensions } from 'react-native';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

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

  const [lastApiError, setLastApiError] = useState<string | null>(null);
  useEffect(()=>{
    try{
      const apiModule = require('../services/api');
      apiModule.attachErrorHandler((err:any)=>{
        try{ setLastApiError(JSON.stringify(err.response?.data || err.message || err)); }catch(e){ setLastApiError(String(err)); }
      });
    }catch(e){}
  },[]);

  // --- original state kept ---
  const [summary, setSummary] = useState<any>(null);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview'|'helplines'|'users'|'notices'>('overview');
  const [tab2, setTab2] = useState<'wings'|'logs'>('wings');
  const [q, setQ] = useState('');
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [newHelpline, setNewHelpline] = useState({ type: 'ambulance', name: '', phone: '', notes: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddFlatModal, setShowAddFlatModal] = useState(false);
  const [newFlat, setNewFlat] = useState({ flat_no: '', buildingId: '' });
  const [showAddWingModal, setShowAddWingModal] = useState(false);
  const [newWing, setNewWing] = useState({ name: '', number_of_floors: '1', flats_per_floor: '1' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStep, setAssignStep] = useState(1);
  const [assignState, setAssignState] = useState({ wingId: '', flatId: '', role: 'owner', name: '', phone: '', address: '', files: [] as any[] });
  const [newUser, setNewUser] = useState({ name: '', phone: '', role: 'owner', flat_no: '', buildingId: '' });
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [noticesCount, setNoticesCount] = useState<number>(0);

  // new: mobile sidebar drawer
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(()=>{ fetchSummary(); fetchHelplines(); fetchUsers(); fetchSocieties(); fetchBuildings(); fetchLogs(); }, []);
  useEffect(()=>{ fetchNoticesCount(); }, []);

  useEffect(()=>{
    if(tab === 'notices'){
      fetchNotices();
      fetchNoticesCount();
    }
  }, [tab]);

  async function fetchNotices(){
    try{ const r = await api.get('/api/notices'); setNotices(r.data.notices || []); }catch(e){ console.warn('fetch notices failed', e); }
  }

  async function fetchNoticesCount(){
    try{ const r = await api.get('/api/notices/count'); setNoticesCount(Number(r.data.count || 0)); }catch(e){ /* ignore */ }
  }

  // fetch flats for admin dashboard convenience
  const [flatsList, setFlatsList] = useState<any[]>([]);
  async function fetchFlats(){ try{ const r = await api.get('/api/admin/flats'); setFlatsList(r.data.flats || []); }catch(e){ console.warn('fetch flats failed', e); } }
  useEffect(()=>{ fetchFlats(); }, []);

  async function fetchSummary(){ try{ const res = await api.get('/api/admin/summary'); setSummary(res.data); }catch(e){ console.warn(e); } }
  async function fetchHelplines(){ try{ const res = await api.get('/api/admin/helplines'); setHelplines(res.data.helplines || []); }catch(e){ console.warn(e); } }
  async function fetchUsers(){ try{ const res = await api.get('/api/admin/users'); setUsers(res.data.users || []); }catch(e){ console.warn(e); } }
  async function fetchSocieties(){ try{ const r = await api.get('/api/admin/societies'); setSocieties(r.data.societies || []); }catch(e){ console.warn(e); } }
  async function fetchBuildings(){ try{ const r = await api.get('/api/admin/buildings'); setBuildings(r.data.buildings || []); }catch(e){ console.warn(e); } }
  async function fetchLogs(){ try{ const r = await api.get('/api/admin/logs'); setLogs(r.data.logs || []); }catch(e){ console.warn(e); } }

  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [agrFlatId, setAgrFlatId] = useState('');
  const [agrTenantId, setAgrTenantId] = useState('');
  const [agrUrl, setAgrUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', description: '', image_url: '', buildingIds: [] as string[], targetAll: false });

  const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dxdzlbvoj/image/upload';
  const CLOUDINARY_UPLOAD_PRESET = 'dev_preset';

  async function createHelpline(){ try{ await api.post('/api/admin/helplines', newHelpline); setShowHelplineModal(false); setNewHelpline({ type: 'ambulance', name: '', phone: '', notes: '' }); fetchHelplines(); fetchSummary(); }catch(e){ console.warn(e); } }
  async function deleteHelpline(id:string){ try{ await api.delete('/api/admin/helplines/'+id); fetchHelplines(); fetchSummary(); }catch(e){ console.warn(e); } }
  async function searchUsers(){ try{ const res = await api.get('/api/admin/search/users?q=' + encodeURIComponent(q)); setUsers(res.data.users || []); }catch(e){ console.warn(e); } }
  async function createUser(){ try{ await api.post('/api/admin/users', newUser); setShowUserModal(false); setNewUser({ name: '', phone: '', role: 'owner', flat_no: '', buildingId: '' }); fetchUsers(); fetchSummary(); }catch(e){ console.warn(e); } }
  async function openUserDetail(u:any){ setDetailUser(null); setShowUserDetail(true); try{ const r = await api.get('/api/admin/users/'+u.id+'/documents'); const his = await api.get('/api/admin/users/'+u.id+'/history'); setDetailUser({ user: u, documents: r.data.documents || [], history: his.data }); }catch(e){ console.warn(e); } }

  async function pickAndUploadFile(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      const doc: any = res as any;
      if(doc.type !== 'success') return;
      let uploadedUrl = null;
      try{
        await new Promise<void>(async (resolve, reject) => {
          const formData = new FormData();
          formData.append('file', { uri: doc.uri, name: doc.name, type: doc.mimeType || 'application/octet-stream' } as any);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', CLOUDINARY_UPLOAD_URL);
          xhr.onload = () => {
            if(xhr.status >= 200 && xhr.status < 300){
              try{ const resp = JSON.parse(xhr.responseText); uploadedUrl = resp.secure_url || resp.url || null; setUploadProgress(null); resolve(); }catch(err){ reject(err); }
            }else{ reject(new Error('Cloudinary upload failed status ' + xhr.status)); }
          };
          xhr.onerror = (e) => { reject(new Error('Cloudinary upload network error')); };
          xhr.upload.onprogress = (e:any) => { if(e.lengthComputable){ const pct = Math.round((e.loaded / e.total) * 100); setUploadProgress(pct); } };
          xhr.send(formData as any);
        });
      }catch(err){
        console.warn('Direct Cloudinary upload failed, falling back to backend upload', err);
        setUploadProgress(null);
        const base64 = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.Base64 });
        const dataUrl = `data:${doc.mimeType || 'application/octet-stream'};base64,${base64}`;
        const upl = await api.post('/api/admin/upload', { dataUrl, filename: doc.name });
        uploadedUrl = upl.data.url;
      }

      const url = uploadedUrl;
      if(detailUser && detailUser.user){ const r = await api.post('/api/admin/users/'+detailUser.user.id+'/documents', { title: doc.name, file_url: url, file_type: doc.mimeType }); setDetailUser((s:any)=>({...s, documents: [...(s?.documents||[]), r.data.document]})); fetchLogs(); }
    }catch(e){ console.warn('pick/upload failed', e); }
  }

  async function createBuilding(){ try{ await api.post('/api/admin/buildings', { name: 'New Wing', address: '' }); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); } }
  async function createWing(){ try{ if(!newWing.name) return alert('Wing name required'); const r = await api.post('/api/admin/addWing', { name: newWing.name, number_of_floors: Number(newWing.number_of_floors), flats_per_floor: Number(newWing.flats_per_floor) }); setShowAddWingModal(false); setNewWing({ name: '', number_of_floors: '1', flats_per_floor: '1' }); fetchBuildings(); fetchFlats(); fetchSummary(); alert('Wing created with ' + (r.data?.flats?.length || 0) + ' flats'); }catch(e){ console.warn('create wing failed', e); alert('Create wing failed'); } }

  async function createNotice(){
    try{
      if(!newNotice.title) return alert('Title required');
      const payload: any = { title: newNotice.title, description: newNotice.description, image_url: newNotice.image_url };
      if(newNotice.targetAll){ payload.targetAll = true; }
      else if(Array.isArray(newNotice.buildingIds) && newNotice.buildingIds.length){ payload.buildingIds = newNotice.buildingIds; }
      const r = await api.post('/api/admin/notices', payload);
      setShowCreateNoticeModal(false);
      setNewNotice({ title: '', description: '', image_url: '', buildingIds: [], targetAll: false });
      fetchNoticesCount();
      fetchNotices();
      alert('Notice created');
    }catch(e){ console.warn('create notice failed', e); alert('Failed to create notice'); }
  }

  async function startAssign(){ setAssignStep(1); setAssignState({ wingId: '', flatId: '', role: 'owner', name: '', phone: '', address: '', files: [] }); setShowAssignModal(true); }
  async function loadFlatsForWing(wingId:string){ try{ const r = await api.get('/api/admin/getFlatsByWing/'+wingId); return r.data.flats || []; }catch(e){ console.warn('load flats failed', e); return []; } }
  async function submitAssign(){ try{ const payload = { wingId: assignState.wingId, flatId: assignState.flatId, role: assignState.role, name: assignState.name, phone: assignState.phone, address: assignState.address }; const r = await api.post('/api/admin/assignUserToFlat', payload); if(r.data && r.data.success){ alert('Assigned successfully'); setShowAssignModal(false); fetchFlats(); fetchUsers(); } else alert('Assign failed'); }catch(e:any){ console.warn('assign failed', e); alert((e && e.response?.data?.error) || 'Assign failed'); } }
  const [assignFlats, setAssignFlats] = useState<any[]>([]);
  async function goToStep2(){ if(!assignState.wingId) return alert('Choose wing'); try{ const flats = await loadFlatsForWing(assignState.wingId); setAssignFlats(flats); setAssignStep(2); }catch(e){ alert('Failed to load flats'); } }
  async function createFlat(){ try{ if(!newFlat.flat_no) return alert('flat no required'); await api.post('/api/admin/flats', { flat_no: newFlat.flat_no, buildingId: newFlat.buildingId || undefined }); setShowAddFlatModal(false); setNewFlat({ flat_no: '', buildingId: '' }); fetchFlats(); fetchSummary(); }catch(e){ console.warn(e); alert('Failed to create flat'); } }
  async function editBuilding(id:string, patch:any){ try{ await api.put('/api/admin/buildings/'+id, patch); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); } }
  async function deleteBuilding(id:string){ try{ await api.delete('/api/admin/buildings/'+id); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); } }
  function editHelpline(id:string){ const h = helplines.find(x=>x.id===id); if(!h) return; setNewHelpline({ type: h.type, name: h.name || '', phone: h.phone || '', notes: h.notes || '' }); setShowHelplineModal(true); }

  // small helper to render stat cards responsively
  const renderStatCard = (title:string, value:any, iconName?:string) => (
    <View style={[styles.statCard, isMobile ? styles.statCardMobile : {}]}>
      <View style={styles.statTop}>
        {iconName ? <Ionicons name={iconName as any} size={18} /> : null}
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value ?? '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'} />

      {/* Mobile top nav */}
      {isMobile && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity onPress={()=>setShowSidebar(true)} style={styles.hamburger}><Ionicons name="menu" size={22} color="#111"/></TouchableOpacity>
          <Text numberOfLines={1} style={styles.mobileTitle}>Society Karbhar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="notifications-outline" size={20} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={()=>setShowHeaderMenu(true)}><Ionicons name="ellipsis-vertical" size={20} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onLogout}><Ionicons name="log-out-outline" size={20} /></TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.container, isDesktop ? styles.containerRow : {}]}>

        {/* SIDEBAR for tablet/desktop */}
        {!isMobile && (
          <View style={[styles.sidebar, isDesktop ? {} : styles.sidebarTablet]} accessibilityRole="menu">
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Society Karbhar</Text>
              <Text style={styles.sidebarSub}>{user?.name || 'Admin'}</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              <TouchableOpacity style={[styles.menuItem, tab==='overview' && styles.menuItemActive]} onPress={()=>{ setTab('overview'); setTab2('wings'); }}>
                <Ionicons name="speedometer" size={18} color="#fff" />
                <Text style={styles.menuText}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='helplines' && styles.menuItemActive]} onPress={()=>setTab('helplines')}>
                <Ionicons name="call-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Helplines</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='notices' && styles.menuItemActive]} onPress={()=>{ setTab('notices'); fetchNotices(); }}>
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Notices</Text>
                {noticesCount > 0 ? <View style={styles.badgeSmall}><Text style={styles.badgeSmallText}>{noticesCount}</Text></View> : null}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='users' && styles.menuItemActive]} onPress={()=>setTab('users')}>
                <Ionicons name="people-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Users</Text>
              </TouchableOpacity>

              <View style={styles.sidebarQuick}>
                <TouchableOpacity style={styles.quickBtn} onPress={()=>setShowHelplineModal(true)}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Helpline</Text>
                </TouchableOpacity>
                {/* Removed Add User from sidebar per UI preference */}
                <TouchableOpacity style={styles.quickBtn} onPress={()=>setShowAddWingModal(true)}>
                  <Ionicons name="business" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Wing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={()=>setShowAddFlatModal(true)}>
                  <Ionicons name="home" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Flat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={startAssign}>
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Assign Owner/Tenant</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={onLogout} style={styles.logoutRow}><Ionicons name="log-out-outline" size={18} color="#ffdbdb" /><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
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
                <Text style={styles.subtitle}>Manage societies, users, helplines and documents</Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} />
                  <TextInput placeholder="Search users or helplines" value={q} onChangeText={setQ} style={styles.searchInput} onSubmitEditing={searchUsers} />
                </View>
                <TouchableOpacity onPress={()=>{ setTab('notices'); fetchNotices(); }} style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={20} />
                  {noticesCount > 0 ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{noticesCount}</Text></View> : null}
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setShowHeaderMenu(true)} style={styles.iconBtn}><Ionicons name="ellipsis-vertical" size={20} /></TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.topTabs}>
            <TouchableOpacity style={[styles.topTab, tab==='overview' && styles.topTabActive]} onPress={()=>setTab('overview')}><Text style={[styles.topTabText, tab==='overview' && styles.topTabTextActive]}>Overview</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.topTab, tab==='helplines' && styles.topTabActive]} onPress={()=>setTab('helplines')}><Text style={[styles.topTabText, tab==='helplines' && styles.topTabTextActive]}>Helplines</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.topTab, tab==='users' && styles.topTabActive]} onPress={()=>setTab('users')}><Text style={[styles.topTabText, tab==='users' && styles.topTabTextActive]}>Users</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.topTab, tab==='notices' && styles.topTabActive]} onPress={()=>{ setTab('notices'); fetchNotices(); }}><Text style={[styles.topTabText, tab==='notices' && styles.topTabTextActive]}>Notices</Text></TouchableOpacity>
          </View>

          <View style={styles.secondaryTabs}>
            <TouchableOpacity style={[styles.smallTab, tab2==='wings' && styles.smallTabActive]} onPress={()=>setTab2('wings')}><Text>Wings</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.smallTab, tab2==='logs' && styles.smallTabActive]} onPress={()=>setTab2('logs')}><Text>Logs</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>

            {tab === 'overview' && (
              <View style={{ paddingVertical: 8 }}>
                {lastApiError ? <View style={styles.errorBox}><Text style={styles.errorText}>API Error: {lastApiError}</Text></View> : null}

                <View style={[styles.statsRow, isMobile && { paddingHorizontal: 6 }] }>
                  {renderStatCard('Owners', summary?.totalOwners, 'person')}
                  {renderStatCard('Tenants', summary?.totalTenants, 'people')}
                  {renderStatCard('Wings', summary?.totalWings, 'business')}
                  {renderStatCard('Services', summary?.totalHelplines, 'call')}
                </View>

                <View style={{ marginTop: 12, paddingHorizontal: isMobile ? 6 : 0 }}>
                  <Text style={styles.sectionTitle}>Quick actions</Text>
                  <View style={[styles.actionRow, isMobile && { flexDirection: 'column' }]}>
                    <TouchableOpacity style={[styles.actionBtn, isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 }]} onPress={()=>setShowHelplineModal(true)}>
                      <Ionicons name="add" size={16} />
                      <Text style={styles.actionBtnText}>Add Helpline</Text>
                    </TouchableOpacity>

                    {/* Add Owner/Tenant - restores quick action on Overview */}
                      {/* Add Owner/Tenant quick action removed from Overview per UI preference */}

                    {/* Assign Owner/Tenant - quick access to the multi-step assign flow */}
                    <TouchableOpacity style={[styles.actionBtn, isMobile && { width: '100%', justifyContent: 'center', marginBottom: 8 }]} onPress={startAssign}>
                      <Ionicons name="people" size={16} />
                      <Text style={styles.actionBtnText}>Assign Owner/Tenant</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {tab === 'helplines' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={{ marginBottom: 8 }}>
                  <Button title="Create Helpline" onPress={()=>setShowHelplineModal(true)} />
                </View>
                <FlatList data={helplines} keyExtractor={(h:any)=>h.id} renderItem={({item})=>(
                  <View style={styles.listItem}>
                    <View style={{flex:1}}><Text style={styles.listTitle}>{item.name || item.type}</Text><Text style={styles.listSub}>{item.phone}</Text></View>
                    <View style={{flexDirection:'row'}}>
                      <TouchableOpacity onPress={()=>editHelpline(item.id)} style={styles.listIcon}><Ionicons name="create-outline" size={18} /></TouchableOpacity>
                      <TouchableOpacity onPress={()=>deleteHelpline(item.id)} style={styles.listIcon}><Ionicons name="trash-outline" size={18} color="#ff6b6b" /></TouchableOpacity>
                    </View>
                  </View>
                )} />
              </View>
            )}

            {tab === 'notices' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Notices</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.smallBtn} onPress={()=>{ fetchNotices(); fetchNoticesCount(); }}><Text style={{color:'#fff'}}>Refresh</Text></TouchableOpacity>
                    <View style={{ width: 8 }} />
                    <TouchableOpacity style={styles.smallBtn} onPress={()=>setShowCreateNoticeModal(true)}><Text style={{color:'#fff'}}>Create</Text></TouchableOpacity>
                  </View>
                </View>
                <FlatList data={notices} keyExtractor={(n:any)=>n.id} renderItem={({item})=> (
                  <View style={styles.listItem}>
                    <View style={{flex:1}}>
                      <Text style={styles.listTitle}>{item.title}</Text>
                      <Text style={styles.listSub}>{item.description}</Text>
                    </View>
                    <Text style={{color:'#6b7280'}}>{item.createdAt ? (new Date(item.createdAt)).toLocaleDateString() : ''}</Text>
                  </View>
                )} />
              </View>
            )}

            {tab === 'users' && (
              <View style={{ paddingVertical: 8 }}>
                <View style={[styles.rowBetween, { paddingHorizontal: isMobile ? 6 : 0 }]}>
                  <View style={{flex:1, marginRight:8}}>
                    <TextInput placeholder="Search name or phone" value={q} onChangeText={setQ} style={styles.search} />
                  </View>
                  <Button title="Search" onPress={searchUsers} />
                </View>

                <View style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: isMobile ? 6 : 0 }}>
                  <Button title="Add Owner/Tenant" onPress={()=>setShowUserModal(true)} />
                </View>

                <FlatList data={users} keyExtractor={(i:any)=>i.id} renderItem={({item})=> (
                  <View style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{item.name || item.phone}</Text>
                      <Text style={styles.listSub}>{item.role} • {item.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={()=>openUserDetail(item)} style={styles.listIcon}><Ionicons name="chevron-forward" size={18} /></TouchableOpacity>
                  </View>
                )} />
              </View>
            )}

          </ScrollView>
        </View>
      </View>

      {/* MOBILE: Sidebar drawer as modal */}
      <Modal visible={showSidebar} animationType="slide" transparent>
        <TouchableOpacity style={styles.mobileDrawerBackdrop} onPress={()=>setShowSidebar(false)} activeOpacity={1}>
          <View style={styles.mobileDrawer}>
            <View style={styles.sidebarHeader}
              >
              <Text style={styles.sidebarTitle}>Society Karbhar</Text>
              <Text style={styles.sidebarSub}>{user?.name || 'Admin'}</Text>
            </View>
            <ScrollView>
              <TouchableOpacity style={[styles.menuItem, tab==='overview' && styles.menuItemActive]} onPress={()=>{ setTab('overview'); setShowSidebar(false); setTab2('wings'); }}>
                <Ionicons name="speedometer" size={18} color="#fff" />
                <Text style={styles.menuText}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='helplines' && styles.menuItemActive]} onPress={()=>{ setTab('helplines'); setShowSidebar(false); }}>
                <Ionicons name="call-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Helplines</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='notices' && styles.menuItemActive]} onPress={()=>{ setTab('notices'); setShowSidebar(false); fetchNotices(); }}>
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Notices</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, tab==='users' && styles.menuItemActive]} onPress={()=>{ setTab('users'); setShowSidebar(false); }}>
                <Ionicons name="people-outline" size={18} color="#fff" />
                <Text style={styles.menuText}>Users</Text>
              </TouchableOpacity>

              <View style={styles.sidebarQuick}>
                <TouchableOpacity style={styles.quickBtn} onPress={()=>{ setShowHelplineModal(true); setShowSidebar(false); }}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Helpline</Text>
                </TouchableOpacity>
                {/* Removed Add User from sidebar per UI preference */}
                <TouchableOpacity style={styles.quickBtn} onPress={()=>{ setShowAddWingModal(true); setShowSidebar(false); }}>
                  <Ionicons name="business" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Wing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={()=>{ setShowAddFlatModal(true); setShowSidebar(false); }}>
                  <Ionicons name="home" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Add Flat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={()=>{ startAssign(); setShowSidebar(false); }}>
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.quickBtnText}>Assign Owner/Tenant</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={()=>{ setShowSidebar(false); onLogout(); }} style={styles.logoutRow}><Ionicons name="log-out-outline" size={18} color="#ffdbdb" /><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Notice modal */}
      <Modal visible={showCreateNoticeModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Notice</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput value={newNotice.title} onChangeText={(t)=>setNewNotice(s=>({...s, title: t}))} style={styles.input} />
            <Text style={styles.label}>Description</Text>
            <TextInput value={newNotice.description} onChangeText={(t)=>setNewNotice(s=>({...s, description: t}))} style={[styles.input, { height: 100 }]} multiline />
            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput value={newNotice.image_url} onChangeText={(t)=>setNewNotice(s=>({...s, image_url: t}))} style={styles.input} />
            <Text style={[styles.label,{marginTop:8}]}>Target Wings</Text>
            <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:8}}>
              <TouchableOpacity onPress={()=>setNewNotice(s=>({...s, targetAll: !s.targetAll, buildingIds: []}))} style={[styles.pill, newNotice.targetAll ? styles.pillActive : {}]}><Text>All wings</Text></TouchableOpacity>
              {buildings.map(b=> (
                <TouchableOpacity key={b.id} onPress={()=>{
                  if(newNotice.targetAll) return; // ignore when all selected
                  const exists = (newNotice.buildingIds||[]).includes(b.id);
                  if(exists) setNewNotice(s=>({...s, buildingIds: (s.buildingIds||[]).filter(x=>x!==b.id)}));
                  else setNewNotice(s=>({...s, buildingIds: [ ...(s.buildingIds||[]), b.id ] }));
                }} style={[styles.buildingChip, (newNotice.buildingIds||[]).includes(b.id) ? styles.buildingChipActive : {}]}>
                  <Text>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={()=>setShowCreateNoticeModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createNotice} />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODALS: keep behavior but mobile-friendly sizes */}

      {/* Add Wing modal */}
      <Modal visible={showAddWingModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Wing (Generate Flats)</Text>
            <Text style={styles.label}>Wing Name</Text>
            <TextInput value={newWing.name} onChangeText={(t)=>setNewWing(s=>({...s, name: t}))} style={styles.input} />
            <Text style={styles.label}>Number of Floors</Text>
            <TextInput value={newWing.number_of_floors} onChangeText={(t)=>setNewWing(s=>({...s, number_of_floors: t}))} style={styles.input} keyboardType="numeric" />
            <Text style={styles.label}>Flats per Floor</Text>
            <TextInput value={newWing.flats_per_floor} onChangeText={(t)=>setNewWing(s=>({...s, flats_per_floor: t}))} style={styles.input} keyboardType="numeric" />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button title="Cancel" onPress={()=>setShowAddWingModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create Wing" onPress={createWing} />
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
                <FlatList data={buildings} horizontal keyExtractor={(b:any)=>b.id} renderItem={({item})=> (
                  <TouchableOpacity onPress={()=>setAssignState(s=>({...s, wingId: item.id}))} style={[styles.buildingChip, assignState.wingId===item.id && styles.buildingChipActive]}>
                    <Text>{item.name}</Text>
                  </TouchableOpacity>
                )} />
                <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop:12}}>
                  <Button title="Next" onPress={goToStep2} />
                </View>
              </>
            )}
            {assignStep === 2 && (
              <>
                <Text style={styles.label}>Select Flat</Text>
                <FlatList data={assignFlats} keyExtractor={(f:any)=>f.id} renderItem={({item})=> (
                  <TouchableOpacity onPress={()=>setAssignState(s=>({...s, flatId: item.id}))} style={[styles.buildingChip, assignState.flatId===item.id && styles.buildingChipActive]}>
                    <Text>{item.flat_no}</Text>
                  </TouchableOpacity>
                )} horizontal />
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                  <Button title="Back" onPress={()=>setAssignStep(1)} />
                  <Button title="Next" onPress={()=>{ if(!assignState.flatId) return alert('Choose flat'); setAssignStep(3); }} />
                </View>
              </>
            )}
            {assignStep === 3 && (
              <>
                <Text style={styles.label}>Role</Text>
                <View style={{flexDirection:'row', marginBottom:8}}>
                  <TouchableOpacity onPress={()=>setAssignState(s=>({...s, role: 'owner'}))} style={[styles.pill, assignState.role==='owner' && styles.pillActive]}><Text>Owner</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>setAssignState(s=>({...s, role: 'tenant'}))} style={[styles.pill, assignState.role==='tenant' && styles.pillActive]}><Text>Tenant</Text></TouchableOpacity>
                </View>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                  <Button title="Back" onPress={()=>setAssignStep(2)} />
                  <Button title="Next" onPress={()=>setAssignStep(4)} />
                </View>
              </>
            )}
            {assignStep === 4 && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput value={assignState.name} onChangeText={(t)=>setAssignState(s=>({...s, name: t}))} style={styles.input} />
                <Text style={styles.label}>Phone</Text>
                <TextInput value={assignState.phone} onChangeText={(t)=>setAssignState(s=>({...s, phone: t}))} style={styles.input} keyboardType="phone-pad" />
                <Text style={styles.label}>Address</Text>
                <TextInput value={assignState.address} onChangeText={(t)=>setAssignState(s=>({...s, address: t}))} style={styles.input} />
                {/* Document upload area for tenants: simple URL input or picker */}
                {assignState.role === 'tenant' && (
                  <>
                    <Text style={[styles.sectionTitle,{marginTop:8}]}>Upload Documents (Aadhaar, PAN, Agreement)</Text>
                    <TextInput placeholder="Document URL" onChangeText={(t)=>setAssignState(s=>({...s, files: [...s.files, { file_url: t }]}))} style={styles.input} />
                  </>
                )}
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                  <Button title="Back" onPress={()=>setAssignStep(3)} />
                  <Button title="Submit" onPress={submitAssign} />
                </View>
              </>
            )}
            <View style={{height:12}} />
            <Button title="Close" onPress={()=>setShowAssignModal(false)} />
          </View>
        </View>
      </Modal>
      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentLarge}>
            <Text style={styles.modalTitle}>Add Owner / Tenant</Text>
            <ScrollView>
              <Text style={styles.label}>Name</Text>
              <TextInput value={newUser.name} onChangeText={(t)=>setNewUser(s=>({...s,name:t}))} style={styles.input} />
              <Text style={styles.label}>Phone</Text>
              <TextInput value={newUser.phone} onChangeText={(t)=>setNewUser(s=>({...s,phone:t}))} style={styles.input} keyboardType="phone-pad" />
              <Text style={styles.label}>Role</Text>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <TouchableOpacity onPress={()=>setNewUser(s=>({...s,role:'owner'}))} style={[styles.pill, newUser.role==='owner' && styles.pillActive]}><Text>Owner</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>setNewUser(s=>({...s,role:'tenant'}))} style={[styles.pill, newUser.role==='tenant' && styles.pillActive]}><Text>Tenant</Text></TouchableOpacity>
              </View>

              <Text style={styles.label}>Wing</Text>
              <FlatList data={buildings} horizontal keyExtractor={(b:any)=>b.id} renderItem={({item})=> (
                <TouchableOpacity onPress={()=>setNewUser(s=>({...s,buildingId:item.id}))} style={[styles.buildingChip, newUser.buildingId===item.id && styles.buildingChipActive]}>
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )} />

              <Text style={styles.label}>Flat / Apartment</Text>
              <TextInput value={newUser.flat_no} onChangeText={(t)=>setNewUser(s=>({...s,flat_no:t}))} style={styles.input} />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button title="Cancel" onPress={()=>setShowUserModal(false)} />
                <View style={{ width: 8 }} />
                <Button title="Create" onPress={createUser} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header three-dot menu modal */}
      <Modal visible={showHeaderMenu} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={()=>setShowHeaderMenu(false)}>
          <View style={[styles.modalContent, { width: 260, alignSelf: 'flex-end', marginRight: 12 }]}>
            <TouchableOpacity style={{ padding: 12 }} onPress={()=>{ setShowHeaderMenu(false); setShowAddWingModal(true); }}><Text style={{ fontWeight: '700' }}>Add Wing</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={()=>{ setShowHeaderMenu(false); setShowAddFlatModal(true); }}><Text style={{ fontWeight: '700' }}>Add Flat</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={()=>{ setShowHeaderMenu(false); setShowCreateNoticeModal(true); }}><Text style={{ fontWeight: '700' }}>Create Notice</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={()=>setShowHeaderMenu(false)}><Text style={{ color: '#666' }}>Cancel</Text></TouchableOpacity>
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
              <FlatList data={detailUser?.documents || []} keyExtractor={(d:any)=>d.id} renderItem={({item})=> (<View style={{ padding: 8 }}><Text style={styles.listTitle}>{item.title || item.file_type}</Text><Text style={styles.listSub}>{item.file_url}</Text></View>)} />

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Upload / Link Document</Text>
              <TextInput placeholder="Document title" value={docTitle} onChangeText={setDocTitle} style={styles.input} />
              <TextInput placeholder="Document URL (or data URL)" value={docUrl} onChangeText={setDocUrl} style={styles.input} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Button title="Pick & Upload File" onPress={pickAndUploadFile} />
                <View style={{ width: 12 }} />
                <Button title="Link URL" onPress={async ()=>{ try{ const r = await api.post('/api/admin/users/'+detailUser.user.id+'/documents', { title: docTitle, file_url: docUrl }); setDetailUser((s:any)=>({...s, documents: [...(s?.documents||[]), r.data.document]})); fetchLogs(); }catch(e){ console.warn(e); } }} />
              </View>

              {uploadProgress !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginLeft: 8 }}>{uploadProgress}%</Text>
                </View>
              )}

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Agreements / History</Text>
              <FlatList data={detailUser?.history?.agreements || []} keyExtractor={(a:any)=>a.id} renderItem={({item})=> (<View style={{ padding: 6 }}><Text>Agreement {item.id}</Text><Text style={styles.listSub}>{item.file_url}</Text></View>)} />

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Create Agreement</Text>
              <TextInput placeholder="Flat ID" value={agrFlatId} onChangeText={setAgrFlatId} style={styles.input} />
              <TextInput placeholder="Tenant ID" value={agrTenantId} onChangeText={setAgrTenantId} style={styles.input} />
              <TextInput placeholder="Agreement URL" value={agrUrl} onChangeText={setAgrUrl} style={styles.input} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Button title="Save Agreement" onPress={async ()=>{ try{ const r = await api.post('/api/admin/agreements', { flatId: agrFlatId, ownerId: detailUser.user.id, tenantId: agrTenantId, file_url: agrUrl }); setDetailUser((s:any)=>({...s, history: {...s.history, agreements: [...(s.history?.agreements||[]), r.data.agreement]}})); fetchLogs(); }catch(e){ console.warn(e); } }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button title="Close" onPress={()=>setShowUserDetail(false)} />
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
            <FlatList data={buildings} horizontal keyExtractor={(b:any)=>b.id} renderItem={({item})=> (
              <TouchableOpacity onPress={()=>setNewFlat(s=>({...s, buildingId: item.id}))} style={[styles.buildingChip, newFlat.buildingId===item.id && styles.buildingChipActive]}>
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )} />

            <Text style={styles.label}>Flat / Apartment No.</Text>
            <TextInput value={newFlat.flat_no} onChangeText={(t)=>setNewFlat(s=>({...s,flat_no:t}))} style={styles.input} />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button title="Cancel" onPress={()=>setShowAddFlatModal(false)} />
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
            <TextInput value={newHelpline.type} onChangeText={(t)=>setNewHelpline(s=>({...s,type:t}))} style={styles.input} />
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput value={newHelpline.name} onChangeText={(t)=>setNewHelpline(s=>({...s,name:t}))} style={styles.input} />
            <Text style={styles.label}>Phone</Text>
            <TextInput value={newHelpline.phone} onChangeText={(t)=>setNewHelpline(s=>({...s,phone:t}))} style={styles.input} keyboardType="phone-pad" />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={newHelpline.notes} onChangeText={(t)=>setNewHelpline(s=>({...s,notes:t}))} style={styles.input} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={()=>setShowHelplineModal(false)} />
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
  subtle: '#6b7280'
};

const styles: any = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7fafc' },
  container: { flex: 1, padding: 12 },
  containerRow: { flexDirection: 'row' },

  // mobile top bar
  mobileTopBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  hamburger: { padding: 8 },
  mobileTitle: { fontWeight: '700', fontSize: 16, marginLeft: 6, maxWidth: 180 },

  // SIDEBAR
  sidebar: { width: 260, backgroundColor: palette.primary, borderRightWidth: 1, borderColor: '#e6eef8', paddingTop: 12, borderRadius: 8, marginRight: 12, overflow: 'hidden' },
  sidebarTablet: { width: 220 },
  sidebarMobile: { width: '100%', flexDirection: 'row', paddingHorizontal: 8, alignItems: 'center' },
  sidebarHeader: { padding: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sidebarTitle: { fontWeight: '800', fontSize: 16, color: '#fff' },
  sidebarSub: { color: '#dfeeff', marginTop: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginVertical: 4, backgroundColor: 'transparent', borderRadius: 8 },
  menuItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  menuText: { marginLeft: 8, color: '#fff', fontWeight: '600' },
  sidebarQuick: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  quickBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)', padding: 8, borderRadius: 8 },
  quickBtnText: { marginLeft: 8, color: '#fff' },
  sidebarFooter: { padding: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  logoutRow: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { marginLeft: 8, color: '#ffdbdb' },

  // MAIN
  mainContent: { flex: 1, paddingLeft: 4, paddingRight: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { color: palette.subtle, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: Platform.OS==='ios'?10:6, borderRadius: 8, marginRight: 8, minWidth: 180, elevation: 2 },
  searchInput: { marginLeft: 8, minWidth: 120 },
  iconBtn: { padding: 8, marginLeft: 6, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  headerBadge: { position: 'absolute', right: 0, top: -6, backgroundColor: '#ff4757', minWidth: 18, height:18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeSmall: { marginLeft: 8, backgroundColor: '#ff6b6b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeSmallText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  smallBtn: { backgroundColor: '#6C5CE7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },

  topTabs: { flexDirection: 'row', marginBottom: 8 },
  topTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, backgroundColor: 'transparent' },
  topTabActive: { backgroundColor: palette.primary, elevation: 2 },
  topTabText: { color: '#374151' },
  topTabTextActive: { color: '#fff', fontWeight: '700' },

  secondaryTabs: { flexDirection: 'row', marginBottom: 12 },
  smallTab: { padding: 6, marginRight: 8, borderRadius: 6, backgroundColor: '#fff' },
  smallTabActive: { backgroundColor: '#edf2ff' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  statCard: { width: '48%', backgroundColor: palette.card, padding: 12, borderRadius: 10, marginBottom: 8, elevation: 1 },
  statCardMobile: { width: '100%' },
  statTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statTitle: { marginLeft: 8, color: '#374151', fontWeight: '700' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },

  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  actionRow: { flexDirection: 'row', marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#fff', marginRight: 8, elevation: 2 },
  actionBtnText: { marginLeft: 8 },
  actionBtnOutline: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  actionBtnOutlineText: { color: '#374151' },

  listItem: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#eef2f6', backgroundColor: '#fff', marginBottom: 6, borderRadius: 8, alignItems: 'center' },
  listTitle: { fontWeight: '700' },
  listSub: { color: '#6b7280' },
  listIcon: { padding: 6, marginLeft: 6 },

  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginRight: 8, backgroundColor: '#fff' },

  // modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '92%', backgroundColor: '#fff', padding: 12, borderRadius: 10 },
  modalContentLarge: { width: '94%', backgroundColor: '#fff', padding: 12, borderRadius: 10, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e6eef8', padding: 10, borderRadius: 8, marginBottom: 8, backgroundColor: '#fff' },
  label: { fontWeight: '700', marginBottom: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e6eef8', marginRight: 8 },
  pillActive: { backgroundColor: '#eef2ff' },
  buildingChip: { padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#fff' },
  buildingChipActive: { backgroundColor: '#eef2ff' },

  errorBox: { backgroundColor: '#fff6f6', padding: 8, borderRadius: 8 },
  errorText: { color: palette.danger },

  // mobile drawer
  mobileDrawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  mobileDrawer: { width: '78%', height: '100%', backgroundColor: palette.primary, paddingTop: 36 }
});
