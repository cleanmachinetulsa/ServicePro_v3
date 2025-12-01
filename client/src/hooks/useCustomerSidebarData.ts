import { useQuery } from '@tanstack/react-query';

interface CustomerInfo {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  vehicles?: Array<{
    year?: string;
    make?: string;
    model?: string;
    color?: string;
  }>;
  notes?: string | null;
  lastBooking?: {
    id: number;
    date: string;
    service: string;
    status: string;
  } | null;
  totalBookings?: number;
  loyaltyPoints?: number;
}

export function useCustomerSidebarData(conversationId: number | null) {
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['/api/tags/customer-profile', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetch(`/api/tags/customer-profile/${conversationId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch customer profile');
      }
      return res.json();
    },
    enabled: !!conversationId,
  });

  // Transform the full profile data into simplified customer info
  const customerInfo: CustomerInfo | null = profileData?.data
    ? {
        id: profileData.data.customer?.id || 0,
        name: profileData.data.customer?.name || profileData.data.conversation?.customerName || null,
        phone: profileData.data.customer?.phone || profileData.data.conversation?.customerPhone || '',
        email: profileData.data.customer?.email || null,
        address: profileData.data.customer?.address || null,
        vehicles: profileData.data.customer?.vehicles?.map((v: any) => ({
          year: v.year,
          make: v.make,
          model: v.model,
          color: v.color,
        })) || [],
        notes: profileData.data.customer?.notes || null,
        lastBooking: profileData.data.appointmentHistory?.[0]
          ? {
              id: profileData.data.appointmentHistory[0].id,
              date: profileData.data.appointmentHistory[0].scheduledTime,
              service: profileData.data.appointmentHistory[0].serviceName,
              status: profileData.data.appointmentHistory[0].completed ? 'completed' : 'scheduled',
            }
          : null,
        totalBookings: profileData.data.appointmentHistory?.length || 0,
        loyaltyPoints: profileData.data.customer?.loyaltyPoints || 0,
      }
    : null;

  return {
    customerInfo,
    isLoading,
  };
}
