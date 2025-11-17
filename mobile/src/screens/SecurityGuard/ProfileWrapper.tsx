import React from 'react';
import SecurityGuardProfile from './SecurityGuardProfile';

type Props = { user?: any; onLogout?: () => void; navigation?: any };

export default function SecurityGuardProfileWrapper({ user, onLogout, navigation }: Props) {
  return <SecurityGuardProfile user={user} onLogout={onLogout} navigation={navigation} />;
}
