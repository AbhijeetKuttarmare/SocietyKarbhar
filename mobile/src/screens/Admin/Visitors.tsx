import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function VisitorsScreen() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [wingId, setWingId] = useState<string | null>(null);
  const [flatNumber, setFlatNumber] = useState<string>('');
  const [gateId, setGateId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    fetchVisitors();
  }, [period]);

  async function fetchVisitors() {
    try {
      setLoading(true);
      const params: any = { period };
      if (q) params.q = q;
      if (wingId) params.wingId = wingId;
      if (flatNumber) params.flatNumber = flatNumber;
      if (gateId) params.gateId = gateId;
      if (from) params.from = from;
      if (to) params.to = to;
      const r = await api.get('/api/admin/visitors', { params });
      setVisitors(r.data.visitors || []);
    } catch (e) {
      console.warn('fetch visitors failed', e);
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const thumb = item.selfie || null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetail(item)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="person" size={24} color="#374151" />
            </View>
          )}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{item.mainVisitorName || 'Unknown'}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.wing && item.wing.name ? item.wing.name + ' • ' : ''}
              {item.Flat && item.Flat.flat_no ? `Flat ${item.Flat.flat_no}` : ''}
            </Text>
            <Text style={styles.sub}>{item.reason || ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.time}>
              {item.checkInTime ? new Date(item.checkInTime).toLocaleString() : ''}
            </Text>
            <Text style={styles.meta}>People: {item.numberOfPeople || 1}</Text>
            {item.gateId ? <Text style={styles.meta}>Gate: {item.gateId}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'daily' ? styles.periodActive : {}]}
            onPress={() => setPeriod('daily')}
          >
            <Text style={period === 'daily' ? styles.periodTextActive : styles.periodText}>
              Daily
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'weekly' ? styles.periodActive : {}]}
            onPress={() => setPeriod('weekly')}
          >
            <Text style={period === 'weekly' ? styles.periodTextActive : styles.periodText}>
              Weekly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'monthly' ? styles.periodActive : {}]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={period === 'monthly' ? styles.periodTextActive : styles.periodText}>
              Monthly
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={fetchVisitors}>
          <Ionicons name="refresh" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filtersLeft}>
          <TextInput
            placeholder="Search visitor name"
            value={q}
            onChangeText={setQ}
            style={styles.input}
          />
          <View style={styles.filtersSmallRow}>
            <TextInput
              placeholder="Flat number"
              value={flatNumber}
              onChangeText={setFlatNumber}
              style={styles.inputSmall}
            />
            <TextInput
              placeholder="Gate"
              value={gateId}
              onChangeText={setGateId}
              style={styles.inputSmall}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.applyBtn} onPress={fetchVisitors}>
          <Text style={{ color: '#fff' }}>Apply</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={visitors}
          keyExtractor={(i) => i.id || (i && i.visitorIdGenerated) || String(Math.random())}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      <Modal visible={!!detail} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{detail?.mainVisitorName || 'Visitor'}</Text>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={20} />
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              {detail?.selfie ? (
                <Image source={{ uri: detail.selfie }} style={styles.detailImage} />
              ) : (
                <View
                  style={[
                    styles.detailImage,
                    styles.thumbEmpty,
                    { justifyContent: 'center', alignItems: 'center' },
                  ]}
                >
                  <Ionicons name="person" size={48} color="#374151" />
                </View>
              )}
            </View>
            <View>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailVal}>{detail?.mainVisitorName}</Text>
              <Text style={styles.detailLabel}>Check-in</Text>
              <Text style={styles.detailVal}>
                {detail?.checkInTime ? new Date(detail.checkInTime).toLocaleString() : ''}
              </Text>
              <Text style={styles.detailLabel}>People</Text>
              <Text style={styles.detailVal}>{detail?.numberOfPeople || 1}</Text>
              <Text style={styles.detailLabel}>Reason</Text>
              <Text style={styles.detailVal}>{detail?.reason}</Text>
              <Text style={styles.detailLabel}>Wing / Flat</Text>
              <Text style={styles.detailVal}>
                {detail?.wing?.name || ''} / {detail?.Flat?.flat_no || ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: '#6b7280' }]}
                onPress={() => setDetail(null)}
              >
                <Text style={{ color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  periodActive: { backgroundColor: '#4f46e5' },
  periodText: { color: '#374151' },
  periodTextActive: { color: '#fff' },
  refresh: { padding: 8 },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  filtersLeft: { flex: 1, minWidth: 160, marginRight: 8 },
  filtersSmallRow: { flexDirection: 'row', marginTop: 8 },
  input: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginRight: 8,
    minWidth: 120,
  },
  inputSmall: {
    width: 110,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginRight: 8,
    minWidth: 80,
  },
  applyBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
    minWidth: 80,
  },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, elevation: 1 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#f3f4f6' },
  thumbEmpty: { backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '700', marginBottom: 2 },
  sub: { color: '#6b7280', fontSize: 12 },
  time: { fontSize: 12, color: '#6b7280' },
  meta: { fontSize: 12, color: '#6b7280' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  detailImage: { width: 200, height: 200, borderRadius: 8, backgroundColor: '#f3f4f6' },
  detailLabel: { marginTop: 8, color: '#6b7280' },
  detailVal: { fontWeight: '600' },
});
