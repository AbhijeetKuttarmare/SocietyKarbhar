import React from 'react';
import { ScrollView, View, Text } from 'react-native';

type Props = { styles?: any };

export default function TenantSupport({ styles = {} }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Support</Text>
        <Text style={{ color: '#666' }}>Contact owner or support from this screen.</Text>
      </View>
    </ScrollView>
  );
}
