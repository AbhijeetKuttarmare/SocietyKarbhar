import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Item = { key: string; label: string; icon: string };

type Props = {
  activeKey: string;
  onChange: (key: string) => void;
  items?: Item[];
};

export default function BottomTab({ activeKey, onChange, items }: Props) {
  const defaultItems: Item[] = [
    { key: 'overview', label: 'Home', icon: 'home' },
  { key: 'helplines', label: 'Helplines', icon: 'call' },
    { key: 'tenants', label: 'My Tenants', icon: 'people' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];
  // If parent passed an explicit `items` prop, use it exactly in the given order.
  // Only fall back to defaultItems when no items are provided by parent.
  const list: Item[] = items && items.length ? items.slice() : defaultItems.slice();
  try {
    console.log(
      '[BottomTab] received items =',
      list.map((i) => i.key)
    );
  } catch (e) {}

  return (
    <View style={styles.container}>
      {list.map((it) => (
        <TouchableOpacity
          key={it.key}
          style={styles.item}
          onPress={() => onChange(it.key)}
          accessibilityRole="button"
        >
          <Ionicons
            name={it.icon as any}
            size={22}
            color={activeKey === it.key ? '#6C5CE7' : '#666'}
          />
          <Text style={[styles.label, activeKey === it.key ? styles.labelActive : {}]}>
            {it.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 6,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, color: '#666', marginTop: 2 },
  labelActive: { color: '#6C5CE7', fontWeight: '700' },
});
