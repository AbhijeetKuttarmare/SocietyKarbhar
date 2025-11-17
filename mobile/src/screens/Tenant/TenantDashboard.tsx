import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';

type Props = { [key: string]: any };

export default function TenantDashboard(props: Props) {
  const {
    StatCard,
    maintenance = [],
    agreements = [],
    noticesCount = 0,
    complaints = [],
    styles = {},
    setShowComplaintModal,
    setShowSupportModal,
  } = props;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Dashboard</Text>
        <View style={styles?.statsRow || {}}>
          {StatCard ? (
            <>
              <StatCard title="Monthly Rent" value={`₹ ${agreements[0]?.rent ?? '—'}`} />
              <StatCard
                title="Bills"
                value={`${(maintenance || []).filter((m: any) => m._type === 'bill').length} bills`}
              />
              <StatCard title="Agreement" value={agreements[0] ? 'Active' : 'Not linked'} />
              <StatCard title="Notices" value={`${noticesCount}`} />
            </>
          ) : null}
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles?.sectionTitle}>Quick Actions</Text>
          <View style={styles?.actionRow || { flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles?.actionBtn}
              onPress={() => setShowComplaintModal && setShowComplaintModal(true)}
            >
              <Text style={styles?.actionText}>Raise Complaint</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles?.actionBtn}
              onPress={() => setShowSupportModal && setShowSupportModal(true)}
            >
              <Text style={styles?.actionText}>Contact Owner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
