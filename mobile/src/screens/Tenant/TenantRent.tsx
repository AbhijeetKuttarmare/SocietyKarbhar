import React from 'react';
import { ScrollView, View, Text } from 'react-native';

type Props = { agreements?: any[]; rentHistory?: any[]; styles?: any };

export default function TenantRent({ agreements = [], rentHistory = [], styles = {} }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Rent Details</Text>
        <View style={styles?.section || {}}>
          <View style={styles?.card || {}}>
            <Text>Monthly Rent: ₹{agreements[0]?.rent ?? '—'}</Text>
            <Text>Deposit: ₹{agreements[0]?.deposit ?? '—'}</Text>
          </View>
          <Text style={[styles?.sectionTitle || {}, { marginTop: 12 }]}>Payment History</Text>
          {rentHistory.length === 0 ? (
            <Text style={{ color: '#666' }}>No payment history available.</Text>
          ) : (
            rentHistory.map((r) => (
              <View key={r.id} style={styles?.rowBetween || {}}>
                <Text>
                  {r.date} • ₹{r.amount}
                </Text>
                <Text style={{ color: r.status === 'paid' ? '#10b981' : '#ef4444' }}>
                  {r.status}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
