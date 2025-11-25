export interface BookingDraft {
  conversationId: number;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  address: string | null;
  serviceName: string | null;
  serviceId: number | null;
  preferredDate: string | null;
  preferredTimeWindow: string | null;
  vehicleSummary: string | null;
  notes: string | null;
}
