import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ScrollView, Image, useWindowDimensions, Alert, ActivityIndicator, Platform } from 'react-native';
// Use dynamic require for DateTimePicker to avoid build-time type errors when package isn't installed
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api, { setAuthHeader, attachErrorHandler } from '../services/api';

type Props = { user: any; onLogout: () => void };

// Sample data used for initial rendering and testing
const SAMPLE_TENANTS = [
  { id: 't1', name: 'Ravi Kumar', phone: '9777777777', address: 'A-101, Green Residency', gender: 'Male', family: [{name:'Sita', relation:'Wife'}], moveIn: '2024-01-15', moveOut: null, rent: 12000, deposit: 36000, docs: [{id:'d1',name:'Aadhaar.pdf', status:'verified'}], status: 'active' },
  { id: 't2', name: 'Meera Joshi', phone: '9666666666', address: 'A-101, Green Residency', gender: 'Female', family: [], moveIn: '2022-05-01', moveOut: '2023-12-01', rent: 10000, deposit: 30000, docs: [], status: 'inactive' }
];

const SAMPLE_MAINTENANCE = [
  { id: 'm1', title: 'Water pump repair', description: 'Replace bearings', cost: 2500, date: '2025-10-01', status: 'pending' },
  { id: 'm2', title: 'Common area cleaning', description: 'Monthly cleaning', cost: 1200, date: '2025-09-15', status: 'completed' }
];

export default function OwnerScreen({ user, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'overview'|'tenants'|'maintenance'|'documents'|'settings'>('overview');
  const [tenants, setTenants] = useState<any[]>(SAMPLE_TENANTS);
  const [maintenance, setMaintenance] = useState<any[]>(SAMPLE_MAINTENANCE);

  // Tenant modal state
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editingPhoneError, setEditingPhoneError] = useState('');
  const [editingReadOnly, setEditingReadOnly] = useState(false);
  // Date picker state for move-in / move-out
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'moveIn'|'moveOut'|null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());

  function renderDatePicker(){
    if(!showDatePicker) return null;
    let DatePicker: any = null;
    try{ DatePicker = require('@react-native-community/datetimepicker'); }catch(e){ DatePicker = null; }
    if(!DatePicker) return null;
    const initial = tempDate || (datePickerField && editingTenant ? (editingTenant[datePickerField] ? new Date(editingTenant[datePickerField]) : new Date()) : new Date());
    return (
      <DatePicker
        value={initial}
        mode="date"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(ev:any, selectedDate:any)=>{
          if(typeof selectedDate === 'undefined' || selectedDate === null){
            setShowDatePicker(false);
            setDatePickerField(null);
            return;
          }
          const d = new Date(selectedDate);
          const iso = d.toISOString().slice(0,10);
          setEditingTenant((s:any)=>({...s, [datePickerField as string]: iso}));
          setShowDatePicker(false);
          setDatePickerField(null);
        }}
      />
    );
  }
  // Fallback inline calendar when native DateTimePicker isn't present
  function renderInlineCalendar(){
    if(!showDatePicker) return null;
    const start = editingTenant && datePickerField && editingTenant[datePickerField] ? new Date(editingTenant[datePickerField]) : new Date();
    // ensure calendar state reflects selected field when opening
    // (set by effect when picker opens)
    const calMonth = calendarMonth;
    const calYear = calendarYear;

    const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0..6
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days: (number | null)[] = [];
    for(let i=0;i<firstDayOfMonth;i++) days.push(null);
    for(let d=1; d<=daysInMonth; d++) days.push(d);

    const selectDate = (day: number) => {
      const d = new Date(calYear, calMonth, day);
      const iso = d.toISOString().slice(0,10);
      setEditingTenant((s:any)=>({...s, [datePickerField as string]: iso}));
      setShowDatePicker(false);
      setDatePickerField(null);
    };

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={()=>{ if(calMonth===0){ setCalendarMonth(11); setCalendarYear(y=>y-1); } else setCalendarMonth(m=>m-1); }}><Text style={styles.calendarNav}>{'‹'}</Text></TouchableOpacity>
          <Text style={styles.calendarTitle}>{new Date(calYear, calMonth).toLocaleString(undefined,{ month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={()=>{ if(calMonth===11){ setCalendarMonth(0); setCalendarYear(y=>y+1); } else setCalendarMonth(m=>m+1); }}><Text style={styles.calendarNav}>{'›'}</Text></TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
          {['S','M','T','W','T','F','S'].map(h=> <Text key={h} style={styles.calendarWeekday}>{h}</Text>)}
          {days.map((day, idx)=> (
            day === null ? (
              <View key={"empty-"+idx} style={styles.calendarCell} />
            ) : (
              <TouchableOpacity key={day} style={styles.calendarCell} onPress={()=>selectDate(day as number)}>
                <Text style={styles.calendarDayText}>{String(day)}</Text>
              </TouchableOpacity>
            )
          ))}
        </View>
        <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop:12}}>
          <TouchableOpacity onPress={()=>{ setShowDatePicker(false); setDatePickerField(null); }} style={styles.smallBtn}><Text style={{color:'#fff'}}>Close</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  // per-tenant loading map for status toggles
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  // confirmation modal for status change
  const [confirmAction, setConfirmAction] = useState<{ tenant: any; targetStatus: 'active'|'inactive' } | null>(null);

  // Document upload state
  const [propertyDocs, setPropertyDocs] = useState<any[]>([]);
  const [flats, setFlats] = useState<any[]>([]);
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [noticesList, setNoticesList] = useState<any[]>([]);
  const [showNoticesModal, setShowNoticesModal] = useState(false);

  // Filters and search
  const [tenantFilter, setTenantFilter] = useState<'all'|'active'|'inactive'>('all');
  const [tenantQ, setTenantQ] = useState('');

  const filteredTenants = useMemo(()=>{
    const q = tenantQ.trim().toLowerCase();
    return tenants.filter(t=>{
      if(tenantFilter === 'active' && t.status !== 'active') return false;
      if(tenantFilter === 'inactive' && t.status !== 'inactive') return false;
      if(!q) return true;
      return (t.name || '').toLowerCase().includes(q) || (t.phone || '').includes(q);
    });
  }, [tenants, tenantFilter, tenantQ]);

  const stats = useMemo(()=>({
    totalTenants: tenants.length,
    active: tenants.filter(t=>t.status==='active').length,
    previous: tenants.filter(t=>t.status!=='active').length,
    maintenanceCount: maintenance.length,
    documents: propertyDocs.length
  }), [tenants, maintenance, propertyDocs]);

  // Responsive breakpoints (reactive)
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const isMobile = width < 600;

  async function pickPropertyDoc(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      const doc: any = res as any;
      if(doc.type !== 'success') return;
      // read as base64 for preview/store
      const base64 = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.Base64 });
      const newDoc = { id: String(Date.now()), name: doc.name || 'file', uri: doc.uri, dataUrl: `data:${doc.mimeType||'application/octet-stream'};base64,${base64}`, uploadedAt: new Date().toISOString() };
      // upload to server (owner upload endpoint)
      setPropertyDocs(s=>[newDoc, ...s]);
      try{
  const up = await api.post('/api/owner/upload', { dataUrl: newDoc.dataUrl, filename: newDoc.name });
        const url = up.data && up.data.url;
        if(url){
          // create document record
          await api.post('/api/owner/documents', { title: newDoc.name, file_url: url, file_type: doc.mimeType || 'application/octet-stream' });
        }
      }catch(e:any){ console.warn('upload failed', e && (((e as any).response?.data) || (e as any).message) ); }
  }catch(e:any){ console.warn('pick property doc failed', e); }
  }

  function openAddTenant(t?: any){ 
    // normalize incoming tenant shape from API if present
    if (t) {
      setEditingTenant(clientShapeFromApi(t));
      setEditingPhoneError('');
      setEditingReadOnly((t && t.status) === 'inactive');
    } else {
      setEditingTenant({ id: null, name: '', phone: '', address: '', gender: '', family: [], moveIn: '', moveOut: '', rent: 0, deposit: 0, docs: [], status: 'active' });
      setEditingPhoneError('');
      setEditingReadOnly(false);
    }
    setShowTenantModal(true);
  }

  function mapTenantForApi(t:any){
    return {
      name: t.name,
      phone: t.phone,
      address: t.address,
      gender: t.gender ? String(t.gender).toLowerCase() : null,
      move_in: t.moveIn ? new Date(t.moveIn).toISOString() : null,
      move_out: t.moveOut ? new Date(t.moveOut).toISOString() : null,
      rent: t.rent ? Number(t.rent) : null,
      deposit: t.deposit ? Number(t.deposit) : null,
      family: Array.isArray(t.family) ? t.family.map((f:any)=>({ name: (f && f.name) ? String(f.name).trim() : '' })).filter((f:any)=>f.name) : undefined,
      flatId: t.flat && t.flat.id ? t.flat.id : undefined,
      status: t.status
    };
  }

  function clientShapeFromApi(u:any){
    return {
      ...u,
      moveIn: u.move_in ? (new Date(u.move_in).toISOString().slice(0,10)) : '',
      moveOut: u.move_out ? (new Date(u.move_out).toISOString().slice(0,10)) : '',
      rent: u.rent || 0,
      deposit: u.deposit || 0,
      gender: u.gender || '',
      status: u.status || 'active'
    };
  }

  function saveTenant(t:any){
    (async ()=>{
      try{
        // Client-side validation: phone must be exactly 10 digits
        const phone = (t && t.phone) ? String(t.phone).trim() : '';
        if(!/^[0-9]{10}$/.test(phone)){
          setEditingPhoneError('Please enter a valid 10-digit mobile number');
          return;
        }

        if(!t.id){
          const payload = mapTenantForApi(t);
          const r = await api.post('/api/owner/tenants', payload);
          const created = r.data && r.data.user;
          if(created) setTenants(s=>[clientShapeFromApi(created), ...s]);
        }else{
          const payload = mapTenantForApi(t);
          const r = await api.put(`/api/owner/tenants/${t.id}`, payload);
          const updated = r.data && r.data.user;
          if(updated) setTenants(s=>s.map(x=>x.id===updated.id? clientShapeFromApi(updated) : x));
        }
        // clear any phone error on successful save
        setEditingPhoneError('');
    }catch(e:any){ console.warn('save tenant failed', e && (((e as any).response?.data) || (e as any).message)); }
      setShowTenantModal(false);
    })();
  }

  // open confirmation modal (client) — actual API call performed in confirmToggleExecute
  function toggleTenantStatus(tenant:any, targetStatus:'active'|'inactive'){
    setConfirmAction({ tenant, targetStatus });
  }

  async function confirmToggleExecute(){
    if(!confirmAction) return;
    const { tenant, targetStatus } = confirmAction;
    setStatusLoading(s => ({ ...s, [tenant.id]: true }));
    try{
      const r = await api.post(`/api/owner/tenants/${tenant.id}/status`, { status: targetStatus });
      const updated = r.data && r.data.user;
      if(updated) setTenants(s=>s.map(x=>x.id===updated.id? clientShapeFromApi(updated) : x));
      setConfirmAction(null);
    }catch(err:any){
      console.warn('toggle status failed', err && (((err as any).response?.data) || (err as any).message));
      Alert.alert('Error', (err && err.response && err.response.data && err.response.data.error) || (err && err.message) || 'Failed to update status');
    }finally{
      setStatusLoading(s => ({ ...s, [tenant.id]: false }));
    }
  }

  async function createMaintenance(m:any){
    try{
  const r = await api.post('/api/owner/maintenance', m);
      const created = r.data && r.data.maintenance;
      if(created) setMaintenance(s=>[created, ...s]);
  }catch(e:any){ console.warn('create maintenance failed', e && (((e as any).response?.data) || (e as any).message)); }
  }

  function deletePropertyDoc(id:string){ setPropertyDocs(s=>s.filter(d=>d.id!==id)); }

  // Load initial data
  useEffect(()=>{
    let mounted = true;
    async function load(){
      try{
        const [t, m, d] = await Promise.all([
          api.get('/api/owner/tenants'),
          api.get('/api/owner/maintenance'),
          api.get('/api/owner/documents')
        ]);
        if(!mounted) return;
        if(t.data && t.data.users) setTenants(t.data.users.map((u:any)=>clientShapeFromApi(u)));
        if(m.data && m.data.maintenance) setMaintenance(m.data.maintenance);
        if(d.data && d.data.documents) setPropertyDocs(d.data.documents.map((x:any)=>({ id: x.id, name: x.title || x.file_url, uri: x.file_url, file_url: x.file_url, uploadedAt: x.createdAt })));
        try{ const f = await api.get('/api/admin/flats'); if(f.data && f.data.flats) setFlats(f.data.flats); }catch(e:any){ /* ignore */ }
        try{ const c = await api.get('/api/notices/count'); setNoticesCount(Number(c.data.count || 0)); }catch(e:any){}
  }catch(e:any){ console.warn('owner initial load failed', e && (((e as any).response?.data) || (e as any).message)); }
    }
    load();
    return ()=>{ mounted = false; }
  }, []);

  async function fetchNotices(){
    try{ const r = await api.get('/api/notices'); setNoticesList(r.data.notices || []); }catch(e:any){ console.warn('fetch notices failed', e); }
  }

  // Simple card UI components
  const StatCard = ({ title, value }: any) => (
    <View style={[styles.statCard, isMobile ? styles.statCardMobile : {}]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  // Bottom navigation for mobile/tablet
  const MobileBottomNav = () => (
    !isDesktop ? (
      <View style={styles.bottomNavBar}>
        <TouchableOpacity onPress={()=>setActiveTab('overview')} style={styles.bottomNavItem}><Ionicons name="speedometer" size={22} color={activeTab==='overview' ? '#6C5CE7' : '#666'} /></TouchableOpacity>
        <TouchableOpacity onPress={()=>setActiveTab('tenants')} style={styles.bottomNavItem}><Ionicons name="people" size={22} color={activeTab==='tenants' ? '#6C5CE7' : '#666'} /></TouchableOpacity>
        <TouchableOpacity onPress={()=>setActiveTab('maintenance')} style={styles.bottomNavItem}><Ionicons name="construct" size={22} color={activeTab==='maintenance' ? '#6C5CE7' : '#666'} /></TouchableOpacity>
        <TouchableOpacity onPress={()=>setActiveTab('documents')} style={styles.bottomNavItem}><Ionicons name="folder" size={22} color={activeTab==='documents' ? '#6C5CE7' : '#666'} /></TouchableOpacity>
        <TouchableOpacity onPress={()=>setActiveTab('settings')} style={styles.bottomNavItem}><Ionicons name="settings" size={22} color={activeTab==='settings' ? '#6C5CE7' : '#666'} /></TouchableOpacity>
      </View>
    ) : null
  );

  return (
    <View style={[styles.container, isDesktop ? styles.row : {}]}>
      {/* Sidebar for desktop, compact header for mobile/tablet */}
      {isDesktop ? (
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.avatarPlaceholder}><Text style={{color:'#fff', fontWeight:'700'}}>O</Text></View>
            <View style={{marginLeft:10}}>
              <Text style={styles.ownerName}>{user?.name || 'Owner'}</Text>
              <Text style={styles.ownerMeta}>{user?.phone || ''}</Text>
            </View>
          </View>
          <View style={styles.menu}>
            <TouchableOpacity style={[styles.menuItem, activeTab==='overview' && styles.menuActive]} onPress={()=>setActiveTab('overview')}>
              <Ionicons name="speedometer" size={18} color="#fff" />
              <Text style={styles.menuText}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, activeTab==='tenants' && styles.menuActive]} onPress={()=>setActiveTab('tenants')}>
              <Ionicons name="people" size={18} color="#fff" />
              <Text style={styles.menuText}>Tenants</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, activeTab==='maintenance' && styles.menuActive]} onPress={()=>setActiveTab('maintenance')}>
              <Ionicons name="construct" size={18} color="#fff" />
              <Text style={styles.menuText}>Maintenance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, activeTab==='documents' && styles.menuActive]} onPress={()=>setActiveTab('documents')}>
              <Ionicons name="folder" size={18} color="#fff" />
              <Text style={styles.menuText}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, activeTab==='settings' && styles.menuActive]} onPress={()=>setActiveTab('settings')}>
              <Ionicons name="settings" size={18} color="#fff" />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sidebarFooter}>
            <TouchableOpacity onPress={onLogout} style={{flexDirection:'row', alignItems:'center'}}><Ionicons name="log-out" size={18} color="#fff" /><Text style={[styles.menuText,{marginLeft:8}]}>Logout</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.mobileTopBar}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <View style={styles.avatarPlaceholderSmall}><Text style={{color:'#fff', fontWeight:'700'}}>O</Text></View>
            <View style={{marginLeft:10}}>
              <Text style={styles.ownerNameMobile}>{user?.name || 'Owner'}</Text>
              <Text style={styles.ownerMetaMobile}>{user?.phone || ''}</Text>
            </View>
          </View>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <TouchableOpacity onPress={pickPropertyDoc} style={styles.iconAction}><Ionicons name="cloud-upload" size={20} color="#333" /></TouchableOpacity>
            <TouchableOpacity onPress={onLogout} style={styles.iconAction}><Ionicons name="log-out" size={20} color="#333" /></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main area */}
      <View style={styles.main}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Owner Dashboard</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <TouchableOpacity style={styles.iconBtn} onPress={()=>{ fetchNotices(); setShowNoticesModal(true); }}>
              <Ionicons name="notifications" size={20} color="#333" />
              {noticesCount > 0 ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{noticesCount}</Text></View> : null}
            </TouchableOpacity>
            <Image source={{ uri: 'https://placekitten.com/80/80' }} style={styles.profilePic} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {activeTab === 'overview' && (
            <View>
              <View style={styles.statsRow}>
                <StatCard title="Total Tenants" value={stats.totalTenants} />
                <StatCard title="Active" value={stats.active} />
                <StatCard title="Previous" value={stats.previous} />
                <StatCard title="Maintenance" value={stats.maintenanceCount} />
                <StatCard title="Docs" value={stats.documents} />
              </View>
              <View style={{marginTop:12}}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={{flexDirection:'row', marginTop:8}}>
                  <TouchableOpacity style={styles.actionBtn} onPress={()=>openAddTenant()}><Ionicons name="person-add" size={18} color="#fff" /><Text style={styles.actionText}>Add Tenant</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#6C5CE7'}]} onPress={pickPropertyDoc}><Ionicons name="cloud-upload" size={18} color="#fff" /><Text style={styles.actionText}>Upload Doc</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'tenants' && (
            <View>
              <View style={styles.filterRow}>
                <View style={styles.searchBox}><Ionicons name="search" size={16} color="#666" /><TextInput placeholder="Search" value={tenantQ} onChangeText={setTenantQ} style={{marginLeft:8, flex:1}} /></View>
                <View style={{flexDirection:'row', marginLeft:8}}>
                  <TouchableOpacity style={[styles.filterBtn, tenantFilter==='all' && styles.filterActive]} onPress={()=>setTenantFilter('all')}><Text>All</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.filterBtn, tenantFilter==='active' && styles.filterActive]} onPress={()=>setTenantFilter('active')}><Text>Active</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.filterBtn, tenantFilter==='inactive' && styles.filterActive]} onPress={()=>setTenantFilter('inactive')}><Text>Inactive</Text></TouchableOpacity>
                </View>
              </View>

              <FlatList data={filteredTenants} keyExtractor={(i:any)=>i.id} renderItem={({item})=> (
                <View style={styles.tenantCard}>
                  <View style={{flex:1}}>
                    <Text style={styles.tenantName}>{item.name}</Text>
                    <Text style={styles.tenantMeta}>{item.role || 'Tenant'} • {item.phone}</Text>
                    {item.flat ? <Text style={styles.tenantMeta}>Flat: {item.flat.flat_no}</Text> : null}
                    <Text style={styles.tenantDates}>Rent: ₹{item.rent} • Move-in: {item.moveIn} {item.moveOut ? `• Move-out: ${item.moveOut}` : ''}</Text>
                  </View>
                  <View style={{alignItems:'flex-end'}}>
                    <View style={[styles.badge, item.status==='active' ? styles.badgeActive : styles.badgeInactive]}><Text style={{color:'#fff'}}>{item.status==='active' ? 'Active' : 'Inactive'}</Text></View>
                    <View style={{flexDirection:'row', alignItems:'center'}}>
                      <TouchableOpacity style={{marginTop:8, marginRight:8}} onPress={()=>openAddTenant(item)}><Ionicons name="eye" size={18} /></TouchableOpacity>
                      {statusLoading[item.id] ? (
                        <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
                      ) : (
                        // Show Deactivate button only when tenant is active.
                        // Once tenant is inactive we hide the Activate button (reactivation is not allowed).
                        item.status === 'active' ? (
                          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#e74c3c', marginTop:8 }]} onPress={()=>toggleTenantStatus(item, 'inactive')}>
                            <Text style={{color:'#fff'}}>Deactivate</Text>
                          </TouchableOpacity>
                        ) : null
                      )}
                    </View>
                  </View>
                </View>
              )} />
            </View>
          )}

          {activeTab === 'maintenance' && (
            <View>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={styles.sectionTitle}>Maintenance</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={()=>createMaintenance({ title: 'New Request', description: '', cost: 0, date: new Date().toISOString().slice(0,10), status: 'pending' })}><Text style={{color:'#fff'}}>New</Text></TouchableOpacity>
              </View>
              <FlatList data={maintenance} keyExtractor={(m:any)=>m.id} renderItem={({item})=> (
                <View style={styles.maintCard}>
                  <View style={{flex:1}}><Text style={{fontWeight:'700'}}>{item.title}</Text><Text style={{color:'#666'}}>{item.description}</Text></View>
                  <View style={{alignItems:'flex-end'}}><Text>₹{item.cost}</Text><Text style={{color:item.status==='pending'?'#e67e22':'#2ecc71'}}>{item.status}</Text></View>
                </View>
              )} />
            </View>
          )}

          {activeTab === 'documents' && (
            <View>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={styles.sectionTitle}>Property Documents</Text>
                <TouchableOpacity style={styles.smallBtn} onPress={pickPropertyDoc}><Text style={{color:'#fff'}}>Upload</Text></TouchableOpacity>
              </View>
              {propertyDocs.length === 0 ? (
                <View style={{padding:24}}><Text style={{color:'#666'}}>No documents yet. Upload using the button above.</Text></View>
              ) : (
                <FlatList data={propertyDocs} keyExtractor={(d:any)=>d.id} renderItem={({item})=> (
                  <View style={styles.docRow}><View style={{flex:1}}><Text style={{fontWeight:'700'}}>{item.name}</Text><Text style={{color:'#666'}}>{item.uploadedAt}</Text></View><View style={{flexDirection:'row'}}><TouchableOpacity style={{marginRight:8}} onPress={()=>{ /* TODO: preview */ }}><Ionicons name="eye" size={18} /></TouchableOpacity><TouchableOpacity onPress={()=>deletePropertyDoc(item.id)}><Ionicons name="trash" size={18} color="#900" /></TouchableOpacity></View></View>
                )} />
              )}
            </View>
          )}

          {activeTab === 'settings' && (
            <View>
              <Text style={styles.sectionTitle}>Profile</Text>
              <View style={{marginTop:8}}>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={user?.name || ''} />
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={user?.phone || ''} keyboardType="phone-pad" />
                <View style={{height:12}} />
                <TouchableOpacity style={styles.smallBtn}><Text style={{color:'#fff'}}>Change Password</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Tenant modal */}
      <Modal visible={showTenantModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={{fontWeight:'700', fontSize:18, marginBottom:8}}>{editingReadOnly ? 'View Tenant' : (editingTenant?.id ? 'Edit Tenant' : 'Add Tenant')}</Text>
              <Text style={styles.label}>Full name</Text>
              <TextInput style={styles.input} value={editingTenant?.name} onChangeText={(t)=>setEditingTenant((s:any)=>({...s, name: t}))} editable={!editingReadOnly} />
              <Text style={styles.label}>Mobile</Text>
              <TextInput style={styles.input} value={editingTenant?.phone} onChangeText={(t)=>{ setEditingTenant((s:any)=>({...s, phone: t})); setEditingPhoneError(''); }} keyboardType="phone-pad" maxLength={10} editable={!editingReadOnly} />
              {editingPhoneError ? <Text style={styles.inlineError}>{editingPhoneError}</Text> : null}
              <Text style={styles.label}>Address</Text>
              <TextInput style={styles.input} value={editingTenant?.address} onChangeText={(t)=>setEditingTenant((s:any)=>({...s, address: t}))} editable={!editingReadOnly} />
              <Text style={styles.label}>Gender</Text>
              <View style={{flexDirection:'row', marginBottom:8}}>
                {['Male','Female','Other'].map(g=>{
                  const lower = (g||'').toLowerCase();
                  const active = (editingTenant?.gender||'').toString().toLowerCase() === lower;
                  return (
                    <TouchableOpacity key={g} onPress={()=>!editingReadOnly && setEditingTenant((s:any)=>({...s, gender: lower}))} style={[styles.segment, active ? styles.segmentActive : {}]}>
                      <Text style={active ? {color:'#fff'} : {}}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Family members</Text>
              <View style={{ marginBottom: 8 }}>
                {(editingTenant?.family||[]).map((f:any, idx:number) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ width: 28, textAlign: 'center', color: '#333' }}>{idx + 1}</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={f.name}
                      onChangeText={(val) => setEditingTenant((s:any)=>{
                        const fam = (s.family||[]).slice();
                        fam[idx] = { name: val };
                        return { ...s, family: fam };
                      })}
                      editable={!editingReadOnly}
                      placeholder="Full name"
                    />
                  </View>
                ))}
                {!editingReadOnly && (
                  <TouchableOpacity onPress={() => setEditingTenant((s:any)=>({...s, family: [ ...(s.family||[]), { name: '' } ] }))} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="add" size={18} color="#6C5CE7" />
                    <Text style={{ marginLeft: 8, color: '#6C5CE7' }}>Add member</Text>
                  </TouchableOpacity>
                )}
                {editingReadOnly && (editingTenant?.family||[]).length === 0 ? <Text style={{ color: '#666', marginTop: 6 }}>No family members</Text> : null}
              </View>
              <Text style={styles.label}>Move-in date</Text>
              <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.input, { paddingRight: 44 }]}
                    value={editingTenant?.moveIn}
                    onChangeText={(t)=>setEditingTenant((s:any)=>({...s, moveIn: t}))}
                    placeholder="YYYY-MM-DD"
                    editable={!editingReadOnly}
                  />
                <TouchableOpacity style={styles.calendarIcon} onPress={()=>{ if(editingReadOnly) return; const d = editingTenant?.moveIn ? new Date(editingTenant.moveIn) : new Date(); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); setDatePickerField('moveIn'); setShowDatePicker(true); }}>
                  <Ionicons name="calendar" size={20} color="#333" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Move-out date</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  value={editingTenant?.moveOut}
                  onChangeText={(t)=>setEditingTenant((s:any)=>({...s, moveOut: t}))}
                  placeholder="YYYY-MM-DD"
                  editable={!editingReadOnly}
                />
                <TouchableOpacity style={styles.calendarIcon} onPress={()=>{ if(editingReadOnly) return; const d = editingTenant?.moveOut ? new Date(editingTenant.moveOut) : new Date(); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); setDatePickerField('moveOut'); setShowDatePicker(true); }}>
                  <Ionicons name="calendar" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              {/* Date picker (conditionally rendered if library is present) */}
              { renderDatePicker() || renderInlineCalendar() }
              <Text style={styles.label}>Rent amount</Text>
              <TextInput style={styles.input} value={String(editingTenant?.rent||'')} onChangeText={(t)=>setEditingTenant((s:any)=>({...s, rent: Number(t)}))} keyboardType="numeric" editable={!editingReadOnly} />
              <Text style={styles.label}>Assign to Flat</Text>
              <View style={{ marginBottom: 8 }}>
                <View style={{ borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 8, overflow: 'hidden' }}>
                  <PickerLike flats={flats} value={editingTenant?.flat?.id || ''} onChange={(flatId:any)=>setEditingTenant((s:any)=>({...s, flat: flats.find((f:any)=>f.id===flatId) || null }))} disabled={editingReadOnly} />
                </View>
              </View>
              <Text style={styles.label}>Deposit amount</Text>
              <TextInput style={styles.input} value={String(editingTenant?.deposit||'')} onChangeText={(t)=>setEditingTenant((s:any)=>({...s, deposit: Number(t)}))} keyboardType="numeric" editable={!editingReadOnly} />
              <View style={{height:12}} />
              <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                <TouchableOpacity style={[styles.smallBtn,{backgroundColor:'#ccc', marginRight:8}]} onPress={()=>setShowTenantModal(false)}><Text>Cancel</Text></TouchableOpacity>
                {!editingReadOnly ? (
                  <TouchableOpacity style={styles.smallBtn} onPress={()=>saveTenant(editingTenant)}><Text style={{color:'#fff'}}>Save</Text></TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation modal for activate/deactivate */}
      <Modal visible={!!confirmAction} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { width: 320 }] }>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Confirm action</Text>
            <Text style={{ color: '#333', marginBottom: 12 }}>{confirmAction ? (confirmAction.targetStatus === 'inactive' ? 'Are you sure you want to deactivate this tenant?' : 'Are you sure you want to activate this tenant?') : ''}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#ccc', marginRight: 8 }]} onPress={()=>setConfirmAction(null)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={confirmToggleExecute}><Text style={{ color: '#fff' }}>Yes</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notices modal */}
      <Modal visible={showNoticesModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{fontWeight:'700', fontSize:18, marginBottom:8}}>Notices</Text>
            <FlatList data={noticesList} keyExtractor={(n:any)=>n.id} renderItem={({item})=> (
              <View style={{ paddingVertical:8 }}>
                <Text style={{ fontWeight:'700' }}>{item.title}</Text>
                <Text style={{ color:'#666', marginTop:4 }}>{item.description}</Text>
                <Text style={{ color:'#999', marginTop:6 }}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text>
              </View>
            )} />
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
              <TouchableOpacity style={styles.smallBtn} onPress={()=>{ setShowNoticesModal(false); }}><Text style={{color:'#fff'}}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!isDesktop && <MobileBottomNav />}

    </View>
  );
}

// Small picker-like dropdown implemented using TouchableOpacity + modal for simplicity
function PickerLike({ flats, value, onChange, disabled }: any){
  const [open, setOpen] = useState(false);
  const selected = flats.find((f:any)=>f.id === value);
  return (
    <>
      <TouchableOpacity onPress={()=>{ if(disabled) return; setOpen(true); }} style={{ padding: 10, backgroundColor:'#fff' }}>
        <Text>{ selected ? `${selected.flat_no}` : 'Select flat (optional)'} </Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:18 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, maxHeight:400 }}>
            <ScrollView>
              {flats.map((f:any)=> (
                <TouchableOpacity key={f.id} onPress={()=>{ onChange(f.id); setOpen(false); }} style={{ padding:12, borderBottomWidth:1, borderColor:'#eee' }}>
                  <Text>{f.flat_no}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection:'row', justifyContent:'flex-end', padding:8 }}>
              <TouchableOpacity onPress={()=>setOpen(false)} style={{ padding:8 }}><Text>Close</Text></TouchableOpacity>
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
  bottomNav: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', padding: 8, backgroundColor: '#2d3436' },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#6C5CE7', alignItems: 'center', justifyContent: 'center' },
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
  statCard: { width: 150, padding: 12, borderRadius: 10, backgroundColor: '#fff', marginRight: 12, marginBottom: 12, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6 },
  statCardMobile: { width: '48%', padding: 10 },
  statTitle: { color: '#888' },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  actionBtn: { flexDirection:'row', alignItems:'center', padding:10, borderRadius:8, backgroundColor:'#0984e3', marginRight:8 },
  actionText: { color:'#fff', marginLeft:8 },
  filterRow: { flexDirection:'row', alignItems:'center', marginBottom:12 },
  searchBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', padding:8, borderRadius:8, flex:1 },
  filterBtn: { padding:8, marginLeft:6, borderRadius:6, backgroundColor:'#fff' },
  filterActive: { backgroundColor:'#dfe6e9' },
  tenantCard: { flexDirection:'row', padding:12, backgroundColor:'#fff', marginBottom:8, borderRadius:8, alignItems:'center' },
  tenantName: { fontWeight: '700' },
  tenantMeta: { color: '#666' },
  tenantDates: { color: '#666', marginTop:6 },
  badge: { paddingHorizontal:8, paddingVertical:4, borderRadius:12 },
  badgeActive: { backgroundColor:'#00b894' },
  badgeInactive: { backgroundColor:'#636e72' },
  tenantList: { marginTop:12 },
  maintCard: { flexDirection:'row', padding:12, backgroundColor:'#fff', marginBottom:8, borderRadius:8 },
  docRow: { flexDirection:'row', padding:12, backgroundColor:'#fff', marginBottom:8, borderRadius:8, alignItems:'center' },
  docRowMobile: { paddingVertical:10 },
  mobileTopBar: { width: '100%', padding: 12, backgroundColor: '#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth: 1, borderColor: '#eee' },
  avatarPlaceholderSmall: { width:36, height:36, borderRadius:10, backgroundColor:'#6C5CE7', alignItems:'center', justifyContent:'center' },
  ownerNameMobile: { fontWeight: '700' },
  ownerMetaMobile: { color: '#666', fontSize: 12 },
  iconAction: { padding:8, marginLeft:8, borderRadius:8, backgroundColor:'#fff' },
  headerBadge: { position: 'absolute', right: -2, top: -6, backgroundColor: '#ff4757', minWidth: 18, height:18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bottomNavBar: { position:'absolute', left:0, right:0, bottom:0, height:56, borderTopWidth:1, borderColor:'#eee', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-around', alignItems:'center' },
  bottomNavItem: { flex:1, alignItems:'center', justifyContent:'center' },
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:18 },
  modalContent: { backgroundColor:'#fff', borderRadius:10, padding:12, maxHeight: '85%' },
  label: { color:'#333', marginTop:8, marginBottom:4 },
  input: { borderWidth:1, borderColor:'#e6e6e6', padding:8, borderRadius:8, backgroundColor:'#fff' },
  smallBtn: { backgroundColor:'#6C5CE7', paddingVertical:6, paddingHorizontal:12, borderRadius:8 }
  ,
  segment: { paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:'#e6e6e6', marginRight:8, backgroundColor:'#fff' },
  segmentActive: { backgroundColor:'#6C5CE7', borderColor:'#6C5CE7' }
  ,
  calendarContainer: { backgroundColor:'#fff', padding:12, borderRadius:10, marginTop:8, borderWidth:1, borderColor:'#eee' },
  calendarHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  calendarNav: { fontSize:20, color:'#333', paddingHorizontal:8 },
  calendarTitle: { fontWeight:'700', color:'#222' },
  calendarGrid: { flexDirection:'row', flexWrap:'wrap' },
  calendarWeekday: { width: `${100/7}%`, textAlign:'center', color:'#666', marginBottom:6 },
  calendarCell: { width: `${100/7}%`, height:36, alignItems:'center', justifyContent:'center' },
  calendarDayText: { color:'#111' }
  ,
  inputWithIcon: { position: 'relative', justifyContent: 'center' },
  calendarIcon: { position: 'absolute', right: 12, top: 12 },
  inlineError: { color: '#ff4d4f', marginTop: 6, fontSize: 13 }
});
