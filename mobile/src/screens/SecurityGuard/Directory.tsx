import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Image } from 'react-native';

type DirectoryUI = {
  wings?: any[];
  expandedWings?: Record<string, boolean>;
  setExpandedWings?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  directoryWing?: string;
  setDirectoryWing?: (s: string) => void;
  flatQuery?: string;
  setFlatQuery?: (s: string) => void;
  loadingFlats?: boolean;
  flats?: any[];
  setShowFlatModal?: (v: boolean) => void;
  setFlatModalTarget?: (t: any) => void;
  setShowWingModal?: (v: boolean) => void;
  fetchFlats?: (reset?: boolean) => Promise<void> | void;
  notify?: (args: any) => void;
};

type Props = { ui?: DirectoryUI; styles?: any };

export default function SecurityGuardDirectory({ ui = {}, styles = {} }: Props) {
  const {
    wings = [],
    expandedWings = {},
    setExpandedWings = () => {},
    directoryWing,
    setDirectoryWing = () => {},
    flatQuery,
    setFlatQuery = () => {},
    loadingFlats = false,
    flats = [],
    setShowFlatModal = () => {},
    setFlatModalTarget = () => {},
    setShowWingModal = () => {},
    notify = () => {},
  } = ui as DirectoryUI;

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={styles.title}>Flat Directory</Text>
      {wings && wings.length > 0 ? (
        <ScrollView horizontal style={{ marginBottom: 8 }} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: directoryWing ? '#e6f4ff' : '#fff',
              marginRight: 8,
            }}
            onPress={() => setDirectoryWing('')}
          >
            <Text style={{ color: '#111' }}>All</Text>
          </TouchableOpacity>
          {wings.map((w: any) => (
            <TouchableOpacity
              key={w.id || w.key || w.name}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: directoryWing === (w.name || w.label) ? '#e6f4ff' : '#fff',
                marginRight: 8,
              }}
              onPress={() => setDirectoryWing(w.name || w.label)}
            >
              <Text>{w.name || w.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Search by flat no or name"
        value={flatQuery}
        onChangeText={setFlatQuery}
      />

      {loadingFlats ? (
        <Text style={{ marginTop: 24 }}>Loading...</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
          {(wings || [])
            .filter((w: any) => (directoryWing ? (w.name || w.label) === directoryWing : true))
            .map((wingItem: any) => {
              const isOpen = !!expandedWings[wingItem.id];
              return (
                <View key={wingItem.id} style={styles.wingContainer}>
                  <TouchableOpacity
                    style={styles.wingHeader}
                    onPress={() =>
                      setExpandedWings((s: any) => ({ ...s, [wingItem.id]: !s[wingItem.id] }))
                    }
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.wingTitle}>{wingItem.name || wingItem.label}</Text>
                    </View>
                  </TouchableOpacity>
                  {isOpen &&
                    (wingItem.flats || []).map((flatItem: any) => (
                      <View key={flatItem.id || flatItem.flat_no} style={styles.flatContainer}>
                        <View style={styles.flatHeader}>
                          <Text style={styles.flatTitle}>Flat {flatItem.flat_no}</Text>
                        </View>
                        <View style={styles.flatUsers}>
                          {(flatItem.users || []).map((u: any, idx: number) => (
                            <View
                              key={`${u.id || u.phone || 'u'}-${idx}`}
                              style={styles.userItemContainer}
                            >
                              <TouchableOpacity
                                style={styles.userItem}
                                onPress={() =>
                                  notify({
                                    type: 'info',
                                    title: u?.name || 'User',
                                    message: u?.phone || 'No phone',
                                  })
                                }
                              >
                                <View style={styles.userAvatarWrap}>
                                  {u?.avatar ? (
                                    <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
                                  ) : (
                                    <View style={[styles.userAvatar, styles.userAvatarFallback]}>
                                      <Text style={{ color: '#374151', fontWeight: '700' }}>
                                        {(u?.name || '').slice(0, 2).toUpperCase()}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.userInfo}>
                                  <Text style={styles.userName}>{u.name || u.phone}</Text>
                                  <Text style={styles.userRole}>
                                    {u.role || 'Resident'} • {u.phone || ''}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                </View>
              );
            })}
        </ScrollView>
      )}
    </View>
  );
}
