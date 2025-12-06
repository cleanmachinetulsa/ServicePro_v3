import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export type TelephonyMode = 'FORWARD_ALL_CALLS' | 'AI_FIRST' | 'AI_ONLY' | 'TEXT_ONLY_BUSINESS';

export interface TelephonySettings {
  telephonyMode: TelephonyMode;
  forwardingNumber: string | null;
  allowVoicemailInTextOnly: boolean;
  ivrMode: string | null;
}

export interface TelephonySettingsResponse {
  success: boolean;
  settings: TelephonySettings;
  modeDescriptions: Record<TelephonyMode, string>;
}

export interface UpdateTelephonySettings {
  telephonyMode?: TelephonyMode;
  forwardingNumber?: string | null;
  allowVoicemailInTextOnly?: boolean;
}

export const TELEPHONY_MODE_LABELS: Record<TelephonyMode, string> = {
  FORWARD_ALL_CALLS: 'Forward all calls',
  AI_FIRST: 'AI answers first',
  AI_ONLY: 'AI only',
  TEXT_ONLY_BUSINESS: 'Text-only business',
};

export const TELEPHONY_MODE_DESCRIPTIONS: Record<TelephonyMode, string> = {
  FORWARD_ALL_CALLS: 'Your calls will ring your number directly. Best if you answer most calls yourself.',
  AI_FIRST: 'AI or IVR answers first, then forwards to you as needed. Recommended.',
  AI_ONLY: 'AI handles calls entirely. You\'ll see bookings and messages but your phone won\'t ring.',
  TEXT_ONLY_BUSINESS: 'We don\'t answer calls. Callers get a quick message and a text with a link.',
};

export function useTelephonySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<TelephonySettingsResponse>({
    queryKey: ['/api/admin/telephony-settings'],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateTelephonySettings) => {
      const response = await apiRequest('PUT', '/api/admin/telephony-settings', updates);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update telephony settings');
      }
      return await response.json();
    },
    onSuccess: (response: { success: boolean; settings: TelephonySettings; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telephony-settings'] });
      toast({
        title: 'Settings saved',
        description: response.message || 'Telephony settings updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save settings',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    settings: data?.settings || null,
    modeDescriptions: data?.modeDescriptions || TELEPHONY_MODE_DESCRIPTIONS,
    isLoading,
    error,
    refetch,
    updateSettings: updateMutation.mutate,
    updateSettingsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
