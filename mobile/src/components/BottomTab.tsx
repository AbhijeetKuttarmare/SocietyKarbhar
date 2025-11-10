import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// derive the `name` prop type from the Ionicons component so our item icon
// types stay in sync with the library's supported names
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type Item = { key: string; label: string; icon: IoniconsName | React.ReactElement };

type Props = {
  activeKey: string;
  onChange: (key: string) => void;
  items?: Item[];
};

export default function BottomTab({ activeKey, onChange, items }: Props) {
  const insets = useSafeAreaInsets();
  const defaultItems: Item[] = [
    // use platform-agnostic icon names compatible with current Ionicons versions
    { key: 'dashboard', label: 'Home', icon: 'home' },
    { key: 'helplines', label: 'Helplines', icon: 'call' },
    { key: 'tenants', label: 'My Tenants', icon: 'people' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];
  // If parent passed an explicit `items` prop, use it exactly in the given order.
  // Only fall back to defaultItems when no items are provided by parent.
  const list: Item[] = items && items.length ? items.slice() : defaultItems.slice();
  // avoid noisy logging each render which can amplify re-renders in dev

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);

  // Position the bar above system navigation by offsetting its bottom using the
  // safe-area inset. Using `bottom` instead of only internal padding keeps the
  // visible content above OS navigation controls on devices where the nav is
  // overlaid (many Android phones). Use a small inner padding for vertical
  // spacing and keep a minimum height so layout stays consistent.
  const bottomOffset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);

  return (
    <View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          paddingBottom: 8,
          zIndex: 999,
          elevation: Platform.OS === 'android' ? 24 : 0,
        },
      ]}
      pointerEvents="auto"
    >
      {list.map((it) => (
        <TouchableOpacity
          key={it.key}
          style={styles.item}
          onPress={() => onChange(it.key)}
          accessibilityRole="button"
        >
          {typeof it.icon === 'string' ? (
            <Ionicons name={it.icon} size={28} color={activeKey === it.key ? '#6C5CE7' : '#666'} />
          ) : (
            // allow passing a React element or component for custom icons
            it.icon
          )}
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
    // bottom is set dynamically based on safe-area insets so we leave it out here
    minHeight: 70,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#eee',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  labelActive: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
});
