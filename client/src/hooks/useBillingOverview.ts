import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { BillingOverview } from '../../../server/services/usageOverviewService';

export function useBillingOverview() {
  return useQuery<BillingOverview>({
    queryKey: ['/api/settings/billing/overview'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/settings/billing/overview');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch billing overview');
      }
      return data.overview;
    },
  });
}
