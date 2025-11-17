import React from 'react';
import { View } from 'react-native';
import CCTVScreen from '../CCTVScreen';

type Camera = { id?: string; name?: string; rtsp?: string; url?: string } | any;

type Props = { cameras?: Camera[]; loading?: boolean; user?: any; navigation?: any; styles?: any };

export default function SecurityGuardCCTV({
  cameras = [],
  loading = false,
  user,
  navigation,
}: Props) {
  return (
    <View style={{ flex: 1 }}>
      <CCTVScreen user={user} navigation={navigation} cameras={cameras} loading={loading} />
    </View>
  );
}
