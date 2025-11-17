import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';

type Profile = { gateName?: string; gateId?: string; formUrl?: string } | any;

type TabKey = 'home' | 'scan' | 'cctv' | 'directory' | 'profile' | 'visitors';

type Props = {
  now?: Date;
  profile?: Profile;
  todayCount?: number | null;
  insideCount?: number | null;
  openFormLink?: () => void;
  setActiveTab?: (k: TabKey) => void;
  styles?: any;
};

export default function SecurityGuardHome({
  now,
  profile,
  todayCount,
  insideCount,
  openFormLink,
  setActiveTab,
  styles,
}: Props) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.timeStamp}>{now?.toLocaleString()}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gate</Text>
        <Text style={styles.cardValue}>{profile?.gateName || profile?.gateId || 'Main Gate'}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Text style={styles.smallTitle}>Today's Visitors</Text>
          <Text style={styles.smallValue}>{todayCount ?? '-'}</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.smallTitle}>Active Inside</Text>
          <Text style={styles.smallValue}>{insideCount ?? '-'}</Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openFormLink && openFormLink()}
        >
          <Text style={styles.actionText}>Scan Visitor QR (Open Form)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { marginTop: 8 }]}
          onPress={() => setActiveTab && setActiveTab('scan')}
        >
          <Text style={styles.actionText}>Add New Visitor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { marginTop: 8 }]}
          onPress={() => setActiveTab && setActiveTab('directory')}
        >
          <Text style={styles.actionText}>Flat Directory</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
