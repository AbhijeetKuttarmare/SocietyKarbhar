import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

type Props = {
  maintenance?: any[];
  myBills?: any[];
  tenantBills?: any[];
  styles?: any;
  setSelectedBill?: (b: any) => void;
  setShowMarkPaidModal?: (v: boolean) => void;
};

export default function TenantBills({
  maintenance = [],
  myBills = [],
  tenantBills = [],
  styles = {},
  setSelectedBill,
  setShowMarkPaidModal,
}: Props) {
  const billsList = (maintenance || []).filter((m: any) => m._type === 'bill');
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Bills</Text>
        {billsList.length === 0 ? (
          <Text style={{ color: '#666' }}>No bills at the moment.</Text>
        ) : (
          <FlatList
            data={billsList}
            keyExtractor={(b: any) => b.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={styles?.maintCard || { padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: '#666' }}>{item.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text>₹{item.cost || item.amount || '—'}</Text>
                  <Text style={{ color: item.status === 'open' ? '#ff6b6b' : '#10b981' }}>
                    {item.status}
                  </Text>
                  {item._type === 'bill' && item.status !== 'closed' ? (
                    <TouchableOpacity
                      style={[styles?.smallBtn || {}, { marginTop: 8 }]}
                      onPress={() => {
                        setSelectedBill && setSelectedBill(item);
                        setShowMarkPaidModal && setShowMarkPaidModal(true);
                      }}
                    >
                      <Text style={{ color: '#fff' }}>Mark Paid</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
