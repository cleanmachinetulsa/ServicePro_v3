import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SimpleModeConfig } from '@/config/navigationItems';

export type UiExperienceMode = 'simple' | 'advanced';

interface UiModeResponse {
  success: boolean;
  mode: UiExperienceMode;
}

interface SimpleModeConfigResponse {
  success: boolean;
  config: SimpleModeConfig | null;
}

export function useUiExperienceMode() {
  const queryClient = useQueryClient();

  const query = useQuery<UiModeResponse>({
    queryKey: ['/api/settings/ui-mode'],
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: async (mode: UiExperienceMode) => {
      await apiRequest('PUT', '/api/settings/ui-mode', { mode });
      return { success: true, mode } as UiModeResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/settings/ui-mode'], data);
    },
  });

  return {
    mode: query.data?.mode ?? 'simple',
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    saveMode: mutation.mutateAsync,
    error: query.error || mutation.error,
  };
}

// SP-21: Hook for simple mode navigation config
export function useSimpleModeConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<SimpleModeConfigResponse>({
    queryKey: ['/api/settings/simple-mode-config'],
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: async (config: SimpleModeConfig) => {
      await apiRequest('PUT', '/api/settings/simple-mode-config', { config });
      return { success: true, config } as SimpleModeConfigResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/settings/simple-mode-config'], data);
    },
  });

  return {
    config: query.data?.config ?? null,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    saveConfig: mutation.mutateAsync,
    error: query.error || mutation.error,
  };
}
