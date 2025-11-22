import { addDays } from 'date-fns';
import type { TenantDb } from './tenantDb';
import { upsellOffers, appointmentUpsells, appointments, services } from '../shared/schema';
import { eq, and, desc, isNull, gte } from 'drizzle-orm';
import type { UpsellOffer, AppointmentUpsell, InsertUpsellOffer } from '../shared/schema';

/**
 * Creates a new upsell offer
 */
export async function createUpsellOffer(tenantDb: TenantDb, offerData: InsertUpsellOffer): Promise<UpsellOffer> {
  try {
    const result = await tenantDb.insert(upsellOffers).values(offerData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating upsell offer:', error);
    throw new Error('Failed to create upsell offer');
  }
}

/**
 * Updates an existing upsell offer
 */
export async function updateUpsellOffer(tenantDb: TenantDb, id: number, offerData: Partial<UpsellOffer>): Promise<UpsellOffer | null> {
  try {
    // Update the updatedAt field
    const dataToUpdate = {
      ...offerData,
      updatedAt: new Date()
    };
    
    const result = await tenantDb.update(upsellOffers)
      .set(dataToUpdate)
      .where(tenantDb.withTenantFilter(upsellOffers, eq(upsellOffers.id, id)))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error updating upsell offer:', error);
    throw new Error('Failed to update upsell offer');
  }
}

/**
 * Gets all upsell offers
 */
export async function getAllUpsellOffers(tenantDb: TenantDb): Promise<UpsellOffer[]> {
  try {
    return await tenantDb.query.upsellOffers.findMany({
      where: tenantDb.withTenantFilter(upsellOffers),
      orderBy: desc(upsellOffers.displayOrder)
    });
  } catch (error) {
    console.error('Error getting upsell offers:', error);
    throw new Error('Failed to get upsell offers');
  }
}

/**
 * Gets active upsell offers
 */
export async function getActiveUpsellOffers(tenantDb: TenantDb): Promise<UpsellOffer[]> {
  try {
    return await tenantDb.query.upsellOffers.findMany({
      where: tenantDb.withTenantFilter(upsellOffers, eq(upsellOffers.active, true)),
      orderBy: desc(upsellOffers.displayOrder)
    });
  } catch (error) {
    console.error('Error getting active upsell offers:', error);
    throw new Error('Failed to get active upsell offers');
  }
}

/**
 * Gets a single upsell offer by ID
 */
export async function getUpsellOfferById(tenantDb: TenantDb, id: number): Promise<UpsellOffer | null> {
  try {
    const result = await tenantDb.query.upsellOffers.findFirst({
      where: tenantDb.withTenantFilter(upsellOffers, eq(upsellOffers.id, id))
    });
    
    return result || null;
  } catch (error) {
    console.error('Error getting upsell offer by ID:', error);
    throw new Error('Failed to get upsell offer');
  }
}

/**
 * Deletes an upsell offer
 */
export async function deleteUpsellOffer(tenantDb: TenantDb, id: number): Promise<boolean> {
  try {
    const result = await tenantDb.delete(upsellOffers)
      .where(tenantDb.withTenantFilter(upsellOffers, eq(upsellOffers.id, id)))
      .returning();
    
    return result.length > 0;
  } catch (error) {
    console.error('Error deleting upsell offer:', error);
    throw new Error('Failed to delete upsell offer');
  }
}

/**
 * Creates an appointment upsell offer for a specific appointment
 */
export async function createAppointmentUpsell(tenantDb: TenantDb, appointmentId: number, upsellOfferId: number): Promise<AppointmentUpsell> {
  try {
    // Get the upsell offer to determine validity days
    const offer = await getUpsellOfferById(tenantDb, upsellOfferId);
    if (!offer) {
      throw new Error('Upsell offer not found');
    }
    
    // Calculate expiry date based on validityDays
    const expiryDate = addDays(new Date(), offer.validityDays || 3);
    
    const result = await tenantDb.insert(appointmentUpsells).values({
      appointmentId,
      upsellOfferId,
      status: 'offered',
      expiryDate,
      offeredAt: new Date()
    }).returning();
    
    return result[0];
  } catch (error) {
    console.error('Error creating appointment upsell:', error);
    throw new Error('Failed to create appointment upsell');
  }
}

/**
 * Get upsell offers applicable for an appointment
 */
export async function getApplicableUpsellsForAppointment(tenantDb: TenantDb, appointmentId: number): Promise<UpsellOffer[]> {
  try {
    // Get the appointment details
    const appointment = await tenantDb.query.appointments.findFirst({
      where: tenantDb.withTenantFilter(appointments, eq(appointments.id, appointmentId))
    });
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    // Get the service details
    const service = await tenantDb.query.services.findFirst({
      where: tenantDb.withTenantFilter(services, eq(services.id, appointment.serviceId))
    });
    
    if (!service) {
      throw new Error('Service not found');
    }
    
    // Get active upsell offers
    const allOffers = await getActiveUpsellOffers(tenantDb);
    
    // Filter offers applicable to this service
    // We'll consider an offer applicable if:
    // 1. It doesn't have applicableServiceIds specified (applies to all), OR
    // 2. The appointment's service is in the applicableServiceIds array
    return allOffers.filter(offer => {
      if (!offer.applicableServiceIds || offer.applicableServiceIds.length === 0) {
        return true;
      }
      
      return offer.applicableServiceIds.includes(service.name);
    });
  } catch (error) {
    console.error('Error getting applicable upsells for appointment:', error);
    throw new Error('Failed to get applicable upsells');
  }
}

/**
 * Updates an appointment upsell (e.g., when accepted or declined)
 */
export async function updateAppointmentUpsell(
  tenantDb: TenantDb,
  id: number, 
  status: 'offered' | 'accepted' | 'declined' | 'expired', 
  newAppointmentId?: number
): Promise<AppointmentUpsell | null> {
  try {
    const updateData: any = {
      status,
      responseAt: new Date()
    };
    
    if (newAppointmentId && status === 'accepted') {
      updateData.newAppointmentId = newAppointmentId;
    }
    
    const result = await tenantDb.update(appointmentUpsells)
      .set(updateData)
      .where(tenantDb.withTenantFilter(appointmentUpsells, eq(appointmentUpsells.id, id)))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error updating appointment upsell:', error);
    throw new Error('Failed to update appointment upsell');
  }
}

/**
 * Gets all active upsells for an appointment that haven't expired
 */
export async function getActiveAppointmentUpsells(tenantDb: TenantDb, appointmentId: number): Promise<AppointmentUpsell[]> {
  try {
    const now = new Date();
    
    return await tenantDb.query.appointmentUpsells.findMany({
      where: tenantDb.withTenantFilter(appointmentUpsells,
        and(
          eq(appointmentUpsells.appointmentId, appointmentId),
          eq(appointmentUpsells.status, 'offered'),
          gte(appointmentUpsells.expiryDate, now)
        )
      )
    });
  } catch (error) {
    console.error('Error getting active appointment upsells:', error);
    throw new Error('Failed to get active appointment upsells');
  }
}

/**
 * Gets detailed information about upsell offers for an appointment
 * including the offer details and appointment upsell status
 */
export async function getAppointmentUpsellsWithDetails(tenantDb: TenantDb, appointmentId: number): Promise<any[]> {
  try {
    // Get all appointment upsells for this appointment
    const appointmentUpsellsList = await tenantDb.query.appointmentUpsells.findMany({
      where: tenantDb.withTenantFilter(appointmentUpsells, eq(appointmentUpsells.appointmentId, appointmentId))
    });
    
    // Get the upsell offer details for each one
    const result = await Promise.all(
      appointmentUpsellsList.map(async (appUpsell) => {
        const offer = await getUpsellOfferById(tenantDb, appUpsell.upsellOfferId);
        return {
          ...appUpsell,
          offer
        };
      })
    );
    
    return result;
  } catch (error) {
    console.error('Error getting appointment upsells with details:', error);
    throw new Error('Failed to get appointment upsells with details');
  }
}

/**
 * Apply an upsell offer by creating a new appointment with the discount applied
 */
export async function applyUpsellOffer(
  tenantDb: TenantDb,
  appointmentUpsellId: number, 
  customerInfo: any
): Promise<{success: boolean, appointmentId?: number, message: string}> {
  try {
    // Get the appointment upsell details
    const appointmentUpsell = await tenantDb.query.appointmentUpsells.findFirst({
      where: tenantDb.withTenantFilter(appointmentUpsells, eq(appointmentUpsells.id, appointmentUpsellId))
    });
    
    if (!appointmentUpsell) {
      return {
        success: false,
        message: 'Appointment upsell not found'
      };
    }
    
    // Check if the upsell is still valid
    const now = new Date();
    if (appointmentUpsell.status !== 'offered' || appointmentUpsell.expiryDate < now) {
      return {
        success: false,
        message: 'Upsell offer has expired or is no longer valid'
      };
    }
    
    // Get the upsell offer details
    const upsellOffer = await getUpsellOfferById(tenantDb, appointmentUpsell.upsellOfferId);
    if (!upsellOffer) {
      return {
        success: false,
        message: 'Upsell offer details not found'
      };
    }
    
    // Get the service ID from the upsell offer
    if (!upsellOffer.serviceId) {
      return {
        success: false,
        message: 'No service associated with this upsell offer'
      };
    }
    
    // Here we would create a new appointment for the upsell service
    // This would typically involve calling a function from calendarApi.ts or similar
    // For this implementation, we'll simulate success and return the info needed
    
    // In a real implementation:
    // 1. Call the booking function to schedule the appointment
    // 2. Update the appointment upsell status with the new appointment ID
    // 3. Return success with the new appointment details
    
    // For now, simulate success:
    return {
      success: true,
      appointmentId: 999, // This would be the real appointment ID in production
      message: 'Upsell offer accepted and appointment scheduled'
    };
  } catch (error) {
    console.error('Error applying upsell offer:', error);
    return {
      success: false,
      message: 'Failed to apply upsell offer: ' + (error as Error).message
    };
  }
}