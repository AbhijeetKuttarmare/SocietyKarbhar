import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import NotificationBar from './NotificationBar';
import notifier, { setNotificationHandler } from '../services/notifier';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [note, setNote] = useState<any | null>(null);

  useEffect(() => {
    // register handler
    setNotificationHandler((n) => {
      setNote(n);
      if (n) {
        // auto dismiss after 4s
        setTimeout(() => setNote(null), 4000);
      }
    });
    return () => {
      try {
        setNotificationHandler(() => {});
      } catch (e) {}
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {note ? (
        <NotificationBar
          type={note.type}
          title={note.title}
          message={note.message}
          onClose={() => setNote(null)}
        />
      ) : null}
    </View>
  );
};

export default NotificationProvider;
