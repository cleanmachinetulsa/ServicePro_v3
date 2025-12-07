import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type UiExperienceMode = 'simple' | 'advanced';

interface UiModeResponse {
  success: boolean;
  mode: UiExperienceMode;
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
