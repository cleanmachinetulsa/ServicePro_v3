import { useQuery } from '@tanstack/react-query';
import type { BillingOverview } from '../../../server/services/usageOverviewService';

export function useBillingOverview() {
  return useQuery<BillingOverview>({
    queryKey: ['settings', 'billing-overview'],
    queryFn: async () => {
      const res = await fetch('/api/settings/billing/overview', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch billing overview');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch billing overview');
      }
      return data.overview;
    },
  });
}
