import React from 'react';
import { View, Text, FlatList, Button } from 'react-native';

type Props = { complaints?: any[]; styles?: any; setShowComplaintModal?: (v: boolean) => void };

export default function TenantComplaints({
  complaints = [],
  styles = {},
  setShowComplaintModal,
}: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Complaints</Text>
        {complaints.length === 0 ? (
          <View>
            <Text style={{ color: '#666' }}>No complaints yet.</Text>
            <View style={{ marginTop: 8 }}>
              <Button
                title="Raise Complaint"
                onPress={() => setShowComplaintModal && setShowComplaintModal(true)}
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={complaints}
            keyExtractor={(c: any) => c.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={styles?.listItem || { padding: 12 }}>
                <Text style={styles?.listTitle}>{item.title}</Text>
                <Text style={styles?.listSub}>{item.description}</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
