import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

type Props = {
  stats?: any;
  setShowOwnerComplaintModal?: (b: boolean) => void;
  setShowOwnerBillsModal?: (b: boolean) => void;
  tenants?: any[];
  tenantDueMap?: Record<string, number>;
  insets?: any;
  isMobile?: boolean;
  styles?: any;
};

export default function OwnerDashboard(props: Props) {
  const {
    stats = {},
    setShowOwnerComplaintModal,
    setShowOwnerBillsModal,
    tenants = [],
    tenantDueMap = {},
    insets = { bottom: 0 },
    isMobile = false,
    styles = {},
  } = props;

  const StatCard = ({ title, value }: any) => (
    <View style={[styles.statCard, isMobile ? styles.statCardMobile : {}]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: 120 + (insets?.bottom || 0),
        paddingHorizontal: isMobile ? 6 : 0,
      }}
    >
      <View>
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
            onPress={() => setShowOwnerComplaintModal && setShowOwnerComplaintModal(true)}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Raise Complaint</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, { alignSelf: 'flex-start', backgroundColor: '#1abc9c' }]}
            onPress={() => setShowOwnerBillsModal && setShowOwnerBillsModal(true)}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Bills</Text>
          </TouchableOpacity>
        </View>

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
                style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 }}
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
      </View>
    </ScrollView>
  );
}
