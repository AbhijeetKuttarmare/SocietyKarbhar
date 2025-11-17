import React from 'react';
import CommonProfilePage from './CommonProfilePage';

type Props = {
  user?: any;
  onLogout?: () => void;
  navigation?: any;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
  setUser?: (u?: any) => void;
  refetch?: boolean;
};

export default function TenantProfile({
  user,
  onLogout,
  navigation,
  userAvatar,
  setUserAvatar,
  setUser,
  refetch,
}: Props) {
  return (
    <CommonProfilePage
      user={user}
      variant="tenant"
      onLogout={onLogout}
      navigation={navigation}
      userAvatar={userAvatar}
      setUserAvatar={setUserAvatar}
      setUser={setUser}
      showTitle={true}
      showEditableForm={true}
      showAppInfo={true}
      showLogoutButton={true}
      title="My Profile"
      refetch={refetch}
    />
  );
}
