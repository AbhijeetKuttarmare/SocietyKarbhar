import React from 'react';
import CommonProfilePage from '../../components/CommonProfilePage';

type Props = {
  user: any;
  onLogout?: () => void;
  navigation?: any;
  userAvatar?: string | undefined;
  setUserAvatar?: (u?: string) => void;
  setUser?: (u?: any) => void;
};

export default function SecurityGuardProfile({
  user,
  onLogout,
  navigation,
  userAvatar,
  setUserAvatar,
  setUser,
}: Props) {
  return (
    <CommonProfilePage
      user={user}
      variant="guard"
      onLogout={onLogout}
      navigation={navigation}
      userAvatar={userAvatar}
      setUserAvatar={setUserAvatar}
      setUser={setUser}
      showTitle={true}
      showEditableForm={true}
      showAppInfo={true}
      showLogoutButton={true}
      fetchEndpoint="/api/guard/profile"
      title="Profile"
    />
  );
}
