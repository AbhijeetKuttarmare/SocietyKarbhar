import React from 'react';
import { ScrollView, View, Text, Image } from 'react-native';

type Props = { ownerProfile?: any; styles?: any };

export default function TenantOwnerInfo({ ownerProfile, styles = {} }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>My Owner</Text>
        {ownerProfile ? (
          <View style={styles?.ownerCard || {}}>
            {ownerProfile.avatar || ownerProfile.image ? (
              <Image
                source={{ uri: ownerProfile.avatar || ownerProfile.image }}
                style={styles?.ownerImageLarge}
              />
            ) : (
              <View style={styles?.ownerImagePlaceholder}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 32 }}>
                  {(ownerProfile.name || 'O').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 12 }}>
              <Text style={styles?.ownerLabel}>Full name</Text>
              <Text style={styles?.ownerValue}>{ownerProfile.name || '—'}</Text>
              <Text style={[styles?.ownerLabel, { marginTop: 10 }]}>Full address</Text>
              <Text style={styles?.ownerValue}>{ownerProfile.address || '—'}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: '#666' }}>No owner information available.</Text>
        )}
      </View>
    </ScrollView>
  );
}
