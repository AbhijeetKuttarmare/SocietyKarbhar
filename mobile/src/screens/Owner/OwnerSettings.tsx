import React from 'react';
import OwnerProfile from '../../components/OwnerProfile';

type Props = {
  user: any;
  refetch?: boolean;
  navigation?: any;
};

export default function OwnerSettings({ user, refetch, navigation }: Props) {
  return <OwnerProfile user={user} refetch={refetch} navigation={navigation} />;
}
