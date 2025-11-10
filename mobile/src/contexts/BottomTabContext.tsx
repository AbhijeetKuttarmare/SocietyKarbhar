import React, { createContext, useState } from 'react';

export type BottomTabState = {
  activeKey: string;
  setActiveKey: (k: string) => void;
};

export const BottomTabContext = createContext<BottomTabState>({
  activeKey: 'home',
  setActiveKey: () => {},
});

export const BottomTabProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [activeKey, setActiveKey] = useState<string>('home');

  // Guarded setter: only update state when the new key is different
  const guardedSetActiveKey = React.useCallback((k: string) => {
    try {
      setActiveKey((prev) => (prev === k ? prev : k));
    } catch (e) {
      // ignore
    }
  }, []);

  // Memoize the context value so consumers don't re-render due to object identity changes
  const value = React.useMemo(
    () => ({ activeKey, setActiveKey: guardedSetActiveKey }),
    [activeKey, guardedSetActiveKey]
  );

  return <BottomTabContext.Provider value={value}>{children}</BottomTabContext.Provider>;
};
