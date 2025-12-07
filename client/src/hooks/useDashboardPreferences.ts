/**
 * SP-15: Dashboard Preferences Hook
 * 
 * Manages tenant dashboard mode (simple/advanced) and
 * which panels are visible in simple mode.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { DashboardPanelId } from '@shared/schema';

export type DashboardMode = 'simple' | 'advanced';

export interface DashboardPreferences {
  mode: DashboardMode;
  simpleVisiblePanels: DashboardPanelId[];
  updatedAt: string;
}

interface DashboardPreferencesResponse {
  success: boolean;
  preferences: DashboardPreferences;
  availablePanels: DashboardPanelId[];
}

interface UpdatePreferencesData {
  mode?: DashboardMode;
  simpleVisiblePanels?: DashboardPanelId[];
}

const QUERY_KEY = ['/api/settings/dashboard/preferences'];

export function useDashboardPreferences() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<DashboardPreferencesResponse>({
    queryKey: QUERY_KEY,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdatePreferencesData) => {
      return await apiRequest('PUT', '/api/settings/dashboard/preferences', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const setModeMutation = useMutation({
    mutationFn: async (mode: DashboardMode) => {
      return await apiRequest('PUT', '/api/settings/dashboard/preferences/mode', { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const preferences = data?.preferences;
  const availablePanels = data?.availablePanels || [];

  const mode = preferences?.mode || 'simple';
  const simpleVisiblePanels = preferences?.simpleVisiblePanels || [];

  const toggleMode = async () => {
    const newMode = mode === 'simple' ? 'advanced' : 'simple';
    await setModeMutation.mutateAsync(newMode);
  };

  const setMode = async (newMode: DashboardMode) => {
    await setModeMutation.mutateAsync(newMode);
  };

  const updatePanels = async (panels: DashboardPanelId[]) => {
    await updateMutation.mutateAsync({ simpleVisiblePanels: panels });
  };

  const addPanel = async (panelId: DashboardPanelId) => {
    if (!simpleVisiblePanels.includes(panelId)) {
      await updatePanels([...simpleVisiblePanels, panelId]);
    }
  };

  const removePanel = async (panelId: DashboardPanelId) => {
    await updatePanels(simpleVisiblePanels.filter(p => p !== panelId));
  };

  const togglePanel = async (panelId: DashboardPanelId) => {
    if (simpleVisiblePanels.includes(panelId)) {
      await removePanel(panelId);
    } else {
      await addPanel(panelId);
    }
  };

  const isPanelVisible = (panelId: DashboardPanelId): boolean => {
    if (mode === 'advanced') {
      return true;
    }
    return simpleVisiblePanels.includes(panelId);
  };

  return {
    mode,
    simpleVisiblePanels,
    availablePanels,
    isLoading,
    isSaving: updateMutation.isPending || setModeMutation.isPending,
    error,
    toggleMode,
    setMode,
    updatePanels,
    addPanel,
    removePanel,
    togglePanel,
    isPanelVisible,
  };
}
