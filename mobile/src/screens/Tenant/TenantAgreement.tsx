import React from 'react';
import { ScrollView, View, Text } from 'react-native';

type Props = { agreement?: any; styles?: any };

export default function TenantAgreement({ agreement, styles = {} }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Agreement Info</Text>
        {agreement ? (
          <View>
            <Text>Start: {agreement.start_date}</Text>
            <Text>End: {agreement.end_date}</Text>
            <Text>Rent: ₹{agreement.rent}</Text>
            <Text>Deposit: ₹{agreement.deposit}</Text>
          </View>
        ) : (
          <Text style={{ color: '#666' }}>No agreement linked.</Text>
        )}
      </View>
    </ScrollView>
  );
}
