/**
 * SP-15: Dashboard Preferences Context
 * 
 * Provides tenant-level dashboard preferences (mode and visible panels)
 * throughout the app.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useDashboardPreferences, DashboardMode } from '@/hooks/useDashboardPreferences';
import type { DashboardPanelId } from '@shared/schema';

interface DashboardPreferencesContextValue {
  mode: DashboardMode;
  simpleVisiblePanels: DashboardPanelId[];
  availablePanels: DashboardPanelId[];
  isLoading: boolean;
  isSaving: boolean;
  toggleMode: () => Promise<void>;
  setMode: (mode: DashboardMode) => Promise<void>;
  updatePanels: (panels: DashboardPanelId[]) => Promise<void>;
  isPanelVisible: (panelId: DashboardPanelId) => boolean;
}

const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue>({
  mode: 'simple',
  simpleVisiblePanels: [],
  availablePanels: [],
  isLoading: false,
  isSaving: false,
  toggleMode: async () => {},
  setMode: async () => {},
  updatePanels: async () => {},
  isPanelVisible: () => true,
});

export function DashboardPreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useDashboardPreferences();

  return (
    <DashboardPreferencesContext.Provider value={preferences}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
}

export function useDashboardPreferencesContext() {
  return useContext(DashboardPreferencesContext);
}

export const NAV_TO_PANEL_MAP: Record<string, DashboardPanelId> = {
  'messages': 'conversations',
  'schedule': 'calendar',
  'quote-requests': 'booking-requests',
  'customers': 'customers',
  'rewards': 'rewards',
  'settings': 'settings',
  'analytics': 'analytics',
  'banner-management': 'campaigns',
  'referrals': 'referrals',
  'technician': 'technician',
  'employees': 'employees',
  'gallery-management': 'gallery',
  'gallery-public': 'gallery',
  'billing': 'billing',
  'billing-usage': 'billing',
  'settings-billing': 'billing',
  'import-history': 'imports',
  'phone-settings': 'telephony',
  'ivr-config': 'ivr',
};

export function shouldShowNavItem(
  navItemId: string,
  mode: DashboardMode,
  simpleVisiblePanels: DashboardPanelId[]
): boolean {
  if (mode === 'advanced') {
    return true;
  }

  const panelId = NAV_TO_PANEL_MAP[navItemId];
  if (!panelId) {
    return true;
  }

  return simpleVisiblePanels.includes(panelId);
}
