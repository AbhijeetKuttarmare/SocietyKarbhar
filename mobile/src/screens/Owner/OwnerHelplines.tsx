import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';

type Props = {
  helplines?: any[];
  user?: any;
  setShowHelplineModal?: (b: boolean) => void;
  setHelplineName?: (s: string) => void;
  setHelplinePhone?: (s: string) => void;
  styles?: any;
};

export default function OwnerHelplines(props: Props) {
  const {
    helplines = [],
    user,
    setShowHelplineModal,
    setHelplineName,
    setHelplinePhone,
    styles = {},
  } = props;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={styles?.sectionTitle}>Helplines</Text>
          {user && user.role === 'owner' ? (
            <TouchableOpacity
              style={styles?.smallBtn}
              onPress={() => {
                setHelplineName && setHelplineName('');
                setHelplinePhone && setHelplinePhone('');
                setShowHelplineModal && setShowHelplineModal(true);
              }}
            >
              <Text style={{ color: '#fff' }}>Add Helpline</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {helplines.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ color: '#666' }}>No helplines configured.</Text>
          </View>
        ) : (
          <FlatList
            data={helplines}
            keyExtractor={(h: any) => h.id || h.phone || String(h.name)}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View
                style={{
                  paddingVertical: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ fontWeight: '700' }}>{item.name || item.title || 'Help'}</Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>
                    {item.phone || item.contact || ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    try {
                      Linking.openURL(`tel:${item.phone || item.contact}`);
                    } catch (e) {}
                  }}
                  style={[styles?.smallBtn, { paddingHorizontal: 14 }]}
                >
                  <Text style={{ color: '#fff' }}>Call</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
