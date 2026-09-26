import { createContext, useContext, type ReactNode } from 'react';
import type { Settings } from '@/lib/supabase';

type AppContextType = {
  settings: Settings | null;
  reloadSettings: () => Promise<void>;
  settingsLoading: boolean;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children, value }: { children: ReactNode; value: AppContextType }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
