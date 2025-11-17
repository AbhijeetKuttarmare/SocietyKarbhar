import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';

type Props = { notices?: any[]; fetchNotices?: any; styles?: any };

export default function TenantNotices({ notices = [], fetchNotices, styles = {} }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={styles?.sectionTitle}>Notices</Text>
          <TouchableOpacity style={styles?.smallBtn} onPress={() => fetchNotices && fetchNotices()}>
            <Text style={{ color: '#fff' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {notices.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ color: '#666' }}>No notices found.</Text>
          </View>
        ) : (
          <FlatList
            data={notices}
            keyExtractor={(n: any) => n.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={{ paddingVertical: 8 }}>
                <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: '#666', marginTop: 4 }}>{item.description}</Text>
                <Text style={{ color: '#999', marginTop: 6 }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
