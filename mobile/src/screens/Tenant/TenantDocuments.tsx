import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';

type Props = { documents?: any[]; styles?: any; handlePreview?: any };

export default function TenantDocuments({ documents = [], styles = {}, handlePreview }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>My Documents</Text>
        {documents.length === 0 ? (
          <Text style={{ color: '#666' }}>No documents uploaded.</Text>
        ) : (
          <FlatList
            data={documents}
            keyExtractor={(d: any) => d.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={styles?.docRow || { padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: '#666' }}>
                    {item.file_url ? 'Uploaded' : 'Not uploaded'}
                  </Text>
                </View>
                {item.file_url ? (
                  <TouchableOpacity
                    onPress={() => handlePreview && handlePreview(item.file_url)}
                    style={styles?.smallBtn}
                  >
                    <Text style={{ color: '#fff' }}>View</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
