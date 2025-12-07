/**
 * useBillingStatus Hook (SP-6)
 * 
 * Checks tenant billing status for displaying warnings and lockout screens.
 */

import { useQuery } from '@tanstack/react-query';

export type BillingStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'unknown';

interface BillingStatusResponse {
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
}

export function useBillingStatus() {
  const { data, isLoading, error } = useQuery<BillingStatusResponse>({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/billing/status', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) {
          return { status: 'unknown', cancelAtPeriodEnd: false, hasStripeCustomer: false, hasSubscription: false };
        }
        throw new Error('Failed to fetch billing status');
      }
      const data = await res.json();
      return {
        status: data.status || 'unknown',
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
        hasStripeCustomer: data.hasStripeCustomer || false,
        hasSubscription: !!data.subscriptionId,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    status: data?.status || 'unknown',
    isPastDue: data?.status === 'past_due',
    isSuspended: data?.status === 'suspended',
    isLoading,
    error,
  };
}
