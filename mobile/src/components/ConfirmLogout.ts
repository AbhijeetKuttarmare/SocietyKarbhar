import { Alert } from 'react-native';

export type ConfirmLogoutOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

export function confirmLogout(action?: () => void, opts?: ConfirmLogoutOptions) {
  const title = opts?.title || 'Logout';
  const message = opts?.message || 'Are you sure you want to logout?';
  const confirmText = opts?.confirmText || 'Logout';
  const cancelText = opts?.cancelText || 'Cancel';

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => {
        try {
          action && action();
        } catch (e) {
          // swallow — action should handle its own errors
        }
      },
    },
  ]);
}

export default confirmLogout;
