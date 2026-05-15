/**
 * useBillingStatus Hook (SP-6)
 * 
 * Checks tenant billing status for displaying warnings and lockout screens.
 */

import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';

export type BillingStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'unknown';

interface BillingStatusResponse {
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}

export function useBillingStatus() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['/api/tenant/billing/status'],
    // Shared fetcher; on 401 return null so AuthGuard owns the redirect
    // (this hook runs on every authed page; we don't want it racing the redirect).
    queryFn: getQueryFn<any>({ on401: 'returnNull' }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  const normalized: BillingStatusResponse = data
    ? {
        status: data.status || 'unknown',
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
        hasStripeCustomer: data.hasStripeCustomer || false,
        hasSubscription: !!data.subscriptionId,
      }
    : { status: 'unknown', cancelAtPeriodEnd: false, hasStripeCustomer: false, hasSubscription: false };

  return {
    status: normalized.status,
    isPastDue: normalized.status === 'past_due',
    isSuspended: normalized.status === 'suspended',
    isLoading,
    error,
  };
}
