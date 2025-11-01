import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Alert } from 'react-native';
import styles from '../../styles/superadminStyles';
import api from '../../services/api';

type Props = { user: any };

const sampleAnalytics = { totalSocieties: 12, totalOwners: 85, totalTenants: 134 };

export default function DashboardScreen({ user }: Props) {
  const [analytics, setAnalytics] = useState(sampleAnalytics);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const headers: any = {};
        if (user && (user as any).token) headers.Authorization = `Bearer ${(user as any).token}`;
        const res = await api.get('/api/superadmin/summary', { headers });
        if (res && res.data) {
          const d = res.data;
          setAnalytics({
            totalSocieties: d.totalSocieties || 0,
            totalOwners: d.totalOwners || 0,
            totalTenants: d.totalTenants || 0,
          });
        }
      } catch (e) {
        // keep sampleAnalytics on error
        console.warn('failed to fetch superadmin summary', (e as any)?.message || e);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [user]);

  console.log('[DashboardScreen] render (superadmin)');

  const bars = [
    { key: 'Societies', value: analytics.totalSocieties, color: '#4f46e5' },
    { key: 'Owners', value: analytics.totalOwners, color: '#10b981' },
    { key: 'Tenants', value: analytics.totalTenants, color: '#f59e0b' },
  ];

  const max = Math.max(...bars.map((b) => b.value), 1);

  // Animated values for bar heights (0..120px). useRef so they persist across renders.
  const animatedHeights = useRef(bars.map(() => new Animated.Value(0))).current;

  // Animate bars when analytics changes
  useEffect(() => {
    const animations = bars.map((b, i) => {
      const target = Math.round((b.value / max) * 120);
      return Animated.timing(animatedHeights[i], {
        toValue: target,
        duration: 700,
        useNativeDriver: false,
      });
    });
    Animated.stagger(80, animations).start();
  }, [analytics, max]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Dashboard</Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (
        <>
          {/* Summary cards */}
          <View style={{ flexDirection: 'row', marginBottom: 14, justifyContent: 'space-between' }}>
            <View style={[styles.card, { flex: 1, marginRight: 8, alignItems: 'center' }]}>
              <Text style={{ color: '#6b7280' }}>Societies</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
                {analytics.totalSocieties}
              </Text>
            </View>
            <View style={[styles.card, { flex: 1, marginHorizontal: 4, alignItems: 'center' }]}>
              <Text style={{ color: '#6b7280' }}>Owners</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
                {analytics.totalOwners}
              </Text>
            </View>
            <View style={[styles.card, { flex: 1, marginLeft: 8, alignItems: 'center' }]}>
              <Text style={{ color: '#6b7280' }}>Tenants</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
                {analytics.totalTenants}
              </Text>
            </View>
          </View>

          {/* Bar chart */}
          <View style={[styles.card, { padding: 16 }]}>
            <Text style={{ fontWeight: '700', marginBottom: 10 }}>Society Dashboard</Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, paddingTop: 12 }}
            >
              {bars.map((b, i) => {
                return (
                  <View key={b.key} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ height: 6 }} />
                    <Text style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                      {b.value}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => Alert.alert(b.key, String(b.value))}
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
                            { height: animatedHeights[i] },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>
                    <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{b.key}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
