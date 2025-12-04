import { useQuery } from '@tanstack/react-query';

export interface BootstrapData {
  success: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
  tenant: {
    id: string;
    name: string;
    slug: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    industry: string | null;
  } | null;
  features: {
    messages: boolean;
    phone: boolean;
    website: boolean;
    loyalty: boolean;
    campaigns: boolean;
    analytics: boolean;
  };
  counts: {
    unreadConversations: number;
    newVoicemails: number;
  };
  impersonation: {
    isActive: boolean;
    tenantId: string | null;
    tenantName: string | null;
  };
}

export function useBootstrap() {
  return useQuery<BootstrapData>({
    queryKey: ['/api/bootstrap'],
    staleTime: 30000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useIsAuthenticated() {
  const { data, isLoading } = useBootstrap();
  return {
    isAuthenticated: !!data?.user,
    isLoading,
    user: data?.user || null,
  };
}

export function useTenantInfo() {
  const { data, isLoading } = useBootstrap();
  return {
    tenant: data?.tenant || null,
    isLoading,
  };
}

export function useFeatureFlags() {
  const { data } = useBootstrap();
  return data?.features || {
    messages: false,
    phone: false,
    website: false,
    loyalty: false,
    campaigns: false,
    analytics: false,
  };
}

export function useUnreadCounts() {
  const { data } = useBootstrap();
  return data?.counts || {
    unreadConversations: 0,
    newVoicemails: 0,
  };
}
