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
  return (
    <BottomTabContext.Provider value={{ activeKey, setActiveKey }}>
      {children}
    </BottomTabContext.Provider>
  );
};
