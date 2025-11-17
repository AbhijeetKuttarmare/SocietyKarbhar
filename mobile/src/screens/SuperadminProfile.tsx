import React from 'react';
import CommonProfilePage from '../components/CommonProfilePage';

type Props = {
  user?: any;
  onBack?: () => void;
  onLogout?: () => void;
  onNavigate?: (route: 'AboutUs' | 'PrivacyPolicy' | 'TermsAndConditions') => void;
};

export default function SuperadminProfile({ user, onBack, onLogout, onNavigate }: Props) {
  return (
    <CommonProfilePage
      user={user}
      variant="superadmin"
      onLogout={onLogout}
      onNavigate={onNavigate}
      showTitle={false}
      showEditableForm={false}
      showAppInfo={true}
      showLogoutButton={true}
    />
  );
}
