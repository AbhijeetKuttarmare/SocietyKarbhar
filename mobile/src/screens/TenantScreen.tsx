import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';

type Props = { user: any; onLogout: () => void };

export default function TenantScreen({ user, onLogout }: Props) {
  const [noticesCount, setNoticesCount] = useState<number>(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [showNotices, setShowNotices] = useState(false);

  useEffect(()=>{ (async ()=>{ try{ const r = await api.get('/api/notices/count'); setNoticesCount(Number(r.data.count||0)); }catch(e){} })(); }, []);

  async function fetchNotices(){ try{ const r = await api.get('/api/notices'); setNotices(r.data.notices || []); }catch(e){ console.warn('fetch notices failed', e); } }

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>Tenant Dashboard</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={()=>{ fetchNotices(); setShowNotices(true); }} style={{ marginRight: 12 }}>
            <Ionicons name="notifications" size={22} />
            {noticesCount > 0 ? <View style={styles.badge}><Text style={{ color: '#fff', fontSize: 11 }}>{noticesCount}</Text></View> : null}
          </TouchableOpacity>
        </View>
      </View>
      <Text>View agreements and raise complaints.</Text>
      <View style={{ marginTop: 20 }}>
        <Button title="Logout" onPress={onLogout} />
      </View>

      <Modal visible={showNotices} animationType="slide" transparent>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:16 }}>
          <View style={{ backgroundColor:'#fff', borderRadius:8, padding:12, maxHeight:'80%' }}>
            <Text style={{ fontWeight:'700', fontSize:18, marginBottom:8 }}>Notices</Text>
            <FlatList data={notices} keyExtractor={(n:any)=>n.id} renderItem={({item})=> (
              <View style={{ paddingVertical:8 }}>
                <Text style={{ fontWeight:'700' }}>{item.title}</Text>
                <Text style={{ color:'#666', marginTop:4 }}>{item.description}</Text>
              </View>
            )} />
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
              <Button title="Close" onPress={()=>setShowNotices(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 24 }, title: { fontSize: 22, fontWeight: '700' }, badge: { position: 'absolute', right: -6, top: -6, backgroundColor: '#ff4757', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 } });
