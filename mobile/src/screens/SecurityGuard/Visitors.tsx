import React from 'react';
import { View } from 'react-native';
import VisitorsScreen from '../Admin/Visitors';

type Props = { useAdminApi?: boolean };

export default function SecurityGuardVisitors({ useAdminApi = false }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <VisitorsScreen useAdminApi={useAdminApi} />
    </View>
  );
}
