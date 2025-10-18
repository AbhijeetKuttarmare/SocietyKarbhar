import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TextInput, TouchableOpacity, Modal, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

type Props = { user: any; onLogout: () => void };

export default function AdminScreen({ user, onLogout }: Props) {
  const [lastApiError, setLastApiError] = useState<string | null>(null);
  useEffect(()=>{
    try{
      const apiModule = require('../services/api');
      apiModule.attachErrorHandler((err:any)=>{
        try{ setLastApiError(JSON.stringify(err.response?.data || err.message || err)); }catch(e){ setLastApiError(String(err)); }
      });
    }catch(e){}
  },[]);
  const [summary, setSummary] = useState<any>(null);
  const [helplines, setHelplines] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState<boolean>(Dimensions.get('window').width >= 900);
  const [societies, setSocieties] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview'|'helplines'|'users'>('overview');
  const [tab2, setTab2] = useState<'wings'|'logs'>('wings');
  const [q, setQ] = useState('');
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [newHelpline, setNewHelpline] = useState({ type: 'ambulance', name: '', phone: '', notes: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', phone: '', role: 'owner', flat_no: '', buildingId: '' });
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);

  useEffect(()=>{ fetchSummary(); fetchHelplines(); fetchUsers(); }, []);
  useEffect(()=>{ fetchLogs(); }, []);

  useEffect(()=>{
    const onChange = ({ window }: { window: any }) => setIsDesktop(window.width >= 900);
    const subs = Dimensions.addEventListener ? Dimensions.addEventListener('change', onChange) : null;
    return () => { if(subs && subs.remove) subs.remove(); };
  },[]);

  useEffect(()=>{ fetchSocieties(); fetchBuildings(); }, []);

  useEffect(()=>{
    const onChange = ({ window }: any) => setIsDesktop(window.width >= 900);
    const sub: any = Dimensions.addEventListener ? Dimensions.addEventListener('change', onChange) : null;
    return () => { if(sub && sub.remove) sub.remove(); };
  },[]);

  async function fetchSummary(){
    try{
      const res = await api.get('/api/admin/summary');
      setSummary(res.data);
    }catch(e){ console.warn(e); }
  }

  async function fetchHelplines(){
    try{
      const res = await api.get('/api/admin/helplines');
      setHelplines(res.data.helplines || []);
    }catch(e){ console.warn(e); }
  }

  async function fetchUsers(){
    try{
      const res = await api.get('/api/admin/users');
      setUsers(res.data.users || []);
    }catch(e){ console.warn(e); }
  }

  async function fetchSocieties(){
    try{ const r = await api.get('/api/admin/societies'); setSocieties(r.data.societies || []); }catch(e){ console.warn(e); }
  }

  async function fetchBuildings(){
    try{ const r = await api.get('/api/admin/buildings'); setBuildings(r.data.buildings || []); }catch(e){ console.warn(e); }
  }

  async function fetchLogs(){
    try{ const r = await api.get('/api/admin/logs'); setLogs(r.data.logs || []); }catch(e){ console.warn(e); }
  }

  const [logs, setLogs] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [agrFlatId, setAgrFlatId] = useState('');
  const [agrTenantId, setAgrTenantId] = useState('');
  const [agrUrl, setAgrUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Direct Cloudinary unsigned upload config (you gave these values)
  const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dxdzlbvoj/image/upload';
  const CLOUDINARY_UPLOAD_PRESET = 'dev_preset';

  async function createHelpline(){
    try{
      await api.post('/api/admin/helplines', newHelpline);
      setShowHelplineModal(false);
      setNewHelpline({ type: 'ambulance', name: '', phone: '', notes: '' });
      fetchHelplines();
      fetchSummary();
    }catch(e){ console.warn(e); }
  }

  async function deleteHelpline(id:string){
    try{ await api.delete('/api/admin/helplines/'+id); fetchHelplines(); fetchSummary(); }catch(e){ console.warn(e); }
  }

  async function searchUsers(){
    try{ const res = await api.get('/api/admin/search/users?q=' + encodeURIComponent(q)); setUsers(res.data.users || []); }catch(e){ console.warn(e); }
  }

  async function createUser(){
    try{
      await api.post('/api/admin/users', newUser);
      setShowUserModal(false);
      setNewUser({ name: '', phone: '', role: 'owner', flat_no: '', buildingId: '' });
      fetchUsers(); fetchSummary();
    }catch(e){ console.warn(e); }
  }

  async function openUserDetail(u:any){
    setDetailUser(null); setShowUserDetail(true);
    try{ const r = await api.get('/api/admin/users/'+u.id+'/documents'); const his = await api.get('/api/admin/users/'+u.id+'/history'); setDetailUser({ user: u, documents: r.data.documents || [], history: his.data }); }catch(e){ console.warn(e); }
  }

  async function pickAndUploadFile(){
    try{
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      // narrow the result for TypeScript — expo types can be a union
      const doc: any = res as any;
      if(doc.type !== 'success') return;
      // Try direct unsigned Cloudinary upload using multipart/form-data with progress
      let uploadedUrl = null;
      try{
        await new Promise<void>(async (resolve, reject) => {
          const formData = new FormData();
          // Append the file directly (React Native supports { uri, name, type })
          formData.append('file', { uri: doc.uri, name: doc.name, type: doc.mimeType || 'application/octet-stream' } as any);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', CLOUDINARY_UPLOAD_URL);
          xhr.onload = () => {
            if(xhr.status >= 200 && xhr.status < 300){
              try{
                const resp = JSON.parse(xhr.responseText);
                uploadedUrl = resp.secure_url || resp.url || null;
                setUploadProgress(null);
                resolve();
              }catch(err){ reject(err); }
            }else{
              reject(new Error('Cloudinary upload failed status ' + xhr.status));
            }
          };
          xhr.onerror = (e) => { reject(new Error('Cloudinary upload network error')); };
          xhr.upload.onprogress = (e:any) => {
            if(e.lengthComputable){
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(pct);
            }
          };
          xhr.send(formData as any);
        });
      }catch(err){
        console.warn('Direct Cloudinary upload failed, falling back to backend upload', err);
        setUploadProgress(null);
        // fallback: read base64 and send to backend /api/admin/upload
  const base64 = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.Base64 });
  const dataUrl = `data:${doc.mimeType || 'application/octet-stream'};base64,${base64}`;
  const upl = await api.post('/api/admin/upload', { dataUrl, filename: doc.name });
        uploadedUrl = upl.data.url;
      }

      const url = uploadedUrl;
      // create document record for current detail user
      if(detailUser && detailUser.user){
  const r = await api.post('/api/admin/users/'+detailUser.user.id+'/documents', { title: doc.name, file_url: url, file_type: doc.mimeType });
        setDetailUser((s:any)=>({...s, documents: [...(s?.documents||[]), r.data.document]}));
        fetchLogs();
      }
    }catch(e){ console.warn('pick/upload failed', e); }
  }

  async function createBuilding(){
    try{ await api.post('/api/admin/buildings', { name: 'New Wing', address: '' }); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); }
  }

  async function editBuilding(id:string, patch:any){
    try{ await api.put('/api/admin/buildings/'+id, patch); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); }
  }

  async function deleteBuilding(id:string){
    try{ await api.delete('/api/admin/buildings/'+id); fetchBuildings(); fetchSummary(); }catch(e){ console.warn(e); }
  }

  async function editHelpline(id:string){
    // open modal prefilled
    const h = helplines.find(x=>x.id===id); if(!h) return; setNewHelpline({ type: h.type, name: h.name || '', phone: h.phone || '', notes: h.notes || '' }); setShowHelplineModal(true);
  }

  return (
    <View style={[styles.container, isDesktop ? styles.containerRow : {}]}>
      {/* Left sidebar */}
      <View style={[styles.sidebar, isDesktop ? {} : styles.sidebarMobile]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Society Karbhar</Text>
          <Text style={styles.sidebarSub}>{user?.name || 'Admin'}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <TouchableOpacity style={[styles.menuItem, tab==='overview' && styles.menuItemActive]} onPress={()=>{ setTab('overview'); setTab2('wings'); }}>
            <Ionicons name="speedometer" size={18} color="#333" />
            <Text style={styles.menuText}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, tab==='helplines' && styles.menuItemActive]} onPress={()=>setTab('helplines')}>
            <Ionicons name="call-outline" size={18} color="#333" />
            <Text style={styles.menuText}>Helplines</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, tab==='users' && styles.menuItemActive]} onPress={()=>setTab('users')}>
            <Ionicons name="people-outline" size={18} color="#333" />
            <Text style={styles.menuText}>Users</Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={styles.sidebarFooter}>
          <TouchableOpacity onPress={onLogout} style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="log-out-outline" size={18} color="#900" /><Text style={{ marginLeft: 6, color: '#900' }}>Logout</Text></TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Dashboard</Text>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, tab==='overview' && styles.tabActive]} onPress={()=>setTab('overview')}><Text>Overview</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab==='helplines' && styles.tabActive]} onPress={()=>setTab('helplines')}><Text>Helplines</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab==='users' && styles.tabActive]} onPress={()=>setTab('users')}><Text>Users</Text></TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 8 }}>
          <TouchableOpacity style={[styles.tab, tab2==='wings' && styles.tabActive]} onPress={()=>setTab2('wings')}><Text>Wings</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab2==='logs' && styles.tabActive]} onPress={()=>setTab2('logs')}><Text>Logs</Text></TouchableOpacity>
        </View>

        {tab === 'overview' && (
          <View>
            {lastApiError ? <View style={{ padding: 8, backgroundColor: '#fee', borderRadius: 6, marginBottom: 8 }}><Text style={{ color: '#900' }}>API Error: {lastApiError}</Text></View> : null}
            <View style={styles.cardsRow}>
              <View style={styles.card}><Text style={styles.cardTitle}>Owners</Text><Text style={styles.cardValue}>{summary?.totalOwners ?? '-'}</Text></View>
              <View style={styles.card}><Text style={styles.cardTitle}>Tenants</Text><Text style={styles.cardValue}>{summary?.totalTenants ?? '-'}</Text></View>
              <View style={styles.card}><Text style={styles.cardTitle}>Wings</Text><Text style={styles.cardValue}>{summary?.totalWings ?? '-'}</Text></View>
              <View style={styles.card}><Text style={styles.cardTitle}>Services</Text><Text style={styles.cardValue}>{summary?.totalHelplines ?? '-'}</Text></View>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '600' }}>Quick actions</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button title="Add Helpline" onPress={()=>setShowHelplineModal(true)} />
                <View style={{ width: 12 }} />
                <Button title="Add Owner" onPress={()=>setShowUserModal(true)} />
              </View>
            </View>
          </View>
        )}

        {tab === 'helplines' && (
          <View>
            <Button title="Create Helpline" onPress={()=>setShowHelplineModal(true)} />
            <FlatList data={helplines} keyExtractor={(h:any)=>h.id} renderItem={({item})=>(
              <View style={styles.listItem}>
                <View style={{flex:1}}><Text style={{fontWeight:'600'}}>{item.name || item.type}</Text><Text>{item.phone}</Text></View>
                <View style={{flexDirection:'row'}}>
                  <TouchableOpacity onPress={()=>editHelpline(item.id)} style={{padding:8}}><Ionicons name="create-outline" size={18} /></TouchableOpacity>
                  <TouchableOpacity onPress={()=>deleteHelpline(item.id)} style={{padding:8}}><Ionicons name="trash-outline" size={18} color="#900" /></TouchableOpacity>
                </View>
              </View>
            )} />
          </View>
        )}

        {tab === 'users' && (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <TextInput placeholder="Search name or phone" value={q} onChangeText={setQ} style={styles.search} />
              <Button title="Search" onPress={searchUsers} />
            </View>
            <Button title="Add Owner/Tenant" onPress={()=>setShowUserModal(true)} />
            <FlatList data={users} keyExtractor={(i:any)=>i.id} renderItem={({item})=> (
              <View style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>{item.name || item.phone}</Text>
                  <Text>{item.role} • {item.phone}</Text>
                </View>
                <TouchableOpacity onPress={()=>openUserDetail(item)} style={{ padding: 8 }}><Ionicons name="chevron-forward" size={18} /></TouchableOpacity>
              </View>
            )} />
          </View>
        )}

      </View>

      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Add Owner / Tenant</Text>
            <Text>Name</Text>
            <TextInput value={newUser.name} onChangeText={(t)=>setNewUser(s=>({...s,name:t}))} style={styles.input} />
            <Text>Phone</Text>
            <TextInput value={newUser.phone} onChangeText={(t)=>setNewUser(s=>({...s,phone:t}))} style={styles.input} keyboardType="phone-pad" />
            <Text>Role</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <TouchableOpacity onPress={()=>setNewUser(s=>({...s,role:'owner'}))} style={{ marginRight: 8 }}><Text style={{ padding: 8, backgroundColor: newUser.role==='owner' ? '#ddd' : '#fff' }}>Owner</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setNewUser(s=>({...s,role:'tenant'}))}><Text style={{ padding: 8, backgroundColor: newUser.role==='tenant' ? '#ddd' : '#fff' }}>Tenant</Text></TouchableOpacity>
            </View>
            <Text>Wing</Text>
            <FlatList data={buildings} horizontal keyExtractor={(b:any)=>b.id} renderItem={({item})=> (<TouchableOpacity onPress={()=>setNewUser(s=>({...s,buildingId:item.id}))} style={{ padding: 8, marginRight: 6, backgroundColor: newUser.buildingId===item.id ? '#ddd' : '#fff', borderRadius: 6 }}><Text>{item.name}</Text></TouchableOpacity>)} />
            <Text>Flat / Apartment</Text>
            <TextInput value={newUser.flat_no} onChangeText={(t)=>setNewUser(s=>({...s,flat_no:t}))} style={styles.input} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={()=>setShowUserModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createUser} />
            </View>
          </View>
        </View>
      </Modal>

      {/* User detail modal */}
      <Modal visible={showUserDetail} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>{detailUser?.user?.name || 'User'}</Text>
            <Text>Phone: {detailUser?.user?.phone}</Text>
            <Text style={{ marginTop: 8, fontWeight: '600' }}>Documents</Text>
            <FlatList data={detailUser?.documents || []} keyExtractor={(d:any)=>d.id} renderItem={({item})=> (<View style={{ padding: 6 }}><Text>{item.title || item.file_type}</Text><Text style={{ color: '#666' }}>{item.file_url}</Text></View>)} />
            <Text style={{ marginTop: 8, fontWeight: '600' }}>Upload / Link Document</Text>
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
            <Text style={{ marginTop: 8, fontWeight: '600' }}>Agreements / History</Text>
            <FlatList data={detailUser?.history?.agreements || []} keyExtractor={(a:any)=>a.id} renderItem={({item})=> (<View style={{ padding: 6 }}><Text>Agreement {item.id}</Text><Text>{item.file_url}</Text></View>)} />
            <Text style={{ marginTop: 8, fontWeight: '600' }}>Create Agreement</Text>
            <TextInput placeholder="Flat ID" value={agrFlatId} onChangeText={setAgrFlatId} style={styles.input} />
            <TextInput placeholder="Tenant ID" value={agrTenantId} onChangeText={setAgrTenantId} style={styles.input} />
            <TextInput placeholder="Agreement URL" value={agrUrl} onChangeText={setAgrUrl} style={styles.input} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Save Agreement" onPress={async ()=>{ try{ const r = await api.post('/api/admin/agreements', { flatId: agrFlatId, ownerId: detailUser.user.id, tenantId: agrTenantId, file_url: agrUrl }); setDetailUser((s:any)=>({...s, history: {...s.history, agreements: [...(s.history?.agreements||[]), r.data.agreement]}})); fetchLogs(); }catch(e){ console.warn(e); } }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Close" onPress={()=>setShowUserDetail(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHelplineModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Add Helpline</Text>
            <Text>Type (ambulance, police, plumber...)</Text>
            <TextInput value={newHelpline.type} onChangeText={(t)=>setNewHelpline(s=>({...s,type:t}))} style={styles.input} />
            <Text>Name (optional)</Text>
            <TextInput value={newHelpline.name} onChangeText={(t)=>setNewHelpline(s=>({...s,name:t}))} style={styles.input} />
            <Text>Phone</Text>
            <TextInput value={newHelpline.phone} onChangeText={(t)=>setNewHelpline(s=>({...s,phone:t}))} style={styles.input} keyboardType="phone-pad" />
            <Text>Notes</Text>
            <TextInput value={newHelpline.notes} onChangeText={(t)=>setNewHelpline(s=>({...s,notes:t}))} style={styles.input} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button title="Cancel" onPress={()=>setShowHelplineModal(false)} />
              <View style={{ width: 8 }} />
              <Button title="Create" onPress={createHelpline} />
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles: any = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  tabBar: { flexDirection: 'row', marginTop: 12, marginBottom: 12 },
  tab: { padding: 8, marginRight: 8, borderRadius: 6, backgroundColor: '#eee' },
  tabActive: { backgroundColor: '#ddd' },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48%', padding: 12, backgroundColor: '#fafafa', borderRadius: 8, marginBottom: 8 },
  cardTitle: { color: '#666' },
  cardValue: { fontSize: 20, fontWeight: '700' },
  listItem: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', padding: 12, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginBottom: 8 },
  search: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginRight: 8 }
});

// Extra layout styles used by the new two-column layout
Object.assign(styles, {
  containerRow: { flexDirection: 'row' },
  sidebar: { width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderColor: '#eee', paddingTop: 12 },
  sidebarMobile: { width: '100%', borderRightWidth: 0 },
  sidebarHeader: { padding: 12, borderBottomWidth: 1, borderColor: '#f2f2f2' },
  sidebarTitle: { fontWeight: '700', fontSize: 16 },
  sidebarSub: { color: '#666', marginTop: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  menuItemActive: { backgroundColor: '#f0f0f0' },
  menuText: { marginLeft: 8 },
  sidebarFooter: { padding: 12, borderTopWidth: 1, borderColor: '#f2f2f2' },
  mainContent: { flex: 1, paddingLeft: 16 }
});
