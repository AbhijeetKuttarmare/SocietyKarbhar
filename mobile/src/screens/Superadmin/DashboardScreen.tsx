import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../../styles/superadminStyles';

type Props = { user: any };

const sampleAnalytics = { totalSocieties: 12, totalOwners: 85, totalTenants: 134 };

export default function DashboardScreen({ user }: Props) {
  console.log('[DashboardScreen] render (design-only chart)');

  const bars = [
    { key: 'Societies', value: sampleAnalytics.totalSocieties, color: '#4f46e5' },
    { key: 'Owners', value: sampleAnalytics.totalOwners, color: '#10b981' },
    { key: 'Tenants', value: sampleAnalytics.totalTenants, color: '#f59e0b' },
  ];

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Dashboard</Text>

      {/* Summary cards */}
      <View style={{ flexDirection: 'row', marginBottom: 14, justifyContent: 'space-between' }}>
        <View style={[styles.card, { flex: 1, marginRight: 8, alignItems: 'center' }]}>
          <Text style={{ color: '#6b7280' }}>Societies</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
            {sampleAnalytics.totalSocieties}
          </Text>
        </View>
        <View style={[styles.card, { flex: 1, marginHorizontal: 4, alignItems: 'center' }]}>
          <Text style={{ color: '#6b7280' }}>Owners</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
            {sampleAnalytics.totalOwners}
          </Text>
        </View>
        <View style={[styles.card, { flex: 1, marginLeft: 8, alignItems: 'center' }]}>
          <Text style={{ color: '#6b7280' }}>Tenants</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>
            {sampleAnalytics.totalTenants}
          </Text>
        </View>
      </View>

      {/* Design-only bar chart */}
      <View style={[styles.card, { padding: 16 }]}>
        <Text style={{ fontWeight: '700', marginBottom: 10 }}>Society Overview</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, paddingTop: 12 }}>
          {bars.map((b) => {
            const height = Math.round((b.value / max) * 120);
            return (
              <View key={b.key} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 6 }} />
                <Text style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>{b.value}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
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
                    <View style={{ width: '100%', height, backgroundColor: b.color }} />
                  </View>
                </TouchableOpacity>
                <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{b.key}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 24 }} />
      <Text style={{ color: '#6b7280', fontSize: 12 }}>
        Note: This chart is design-only and not connected to live data.
      </Text>
    </View>
  );
}
