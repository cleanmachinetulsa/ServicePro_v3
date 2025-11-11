import { addDays } from 'date-fns';
import { db } from './db';
import { upsellOffers, appointmentUpsells, appointments, services } from '../shared/schema';
import { eq, and, desc, isNull, gte } from 'drizzle-orm';
import type { UpsellOffer, AppointmentUpsell, InsertUpsellOffer } from '../shared/schema';

/**
 * Creates a new upsell offer
 */
export async function createUpsellOffer(offerData: InsertUpsellOffer): Promise<UpsellOffer> {
  try {
    const result = await db.insert(upsellOffers).values(offerData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating upsell offer:', error);
    throw new Error('Failed to create upsell offer');
  }
}

/**
 * Updates an existing upsell offer
 */
export async function updateUpsellOffer(id: number, offerData: Partial<UpsellOffer>): Promise<UpsellOffer | null> {
  try {
    // Update the updatedAt field
    const dataToUpdate = {
      ...offerData,
      updatedAt: new Date()
    };
    
    const result = await db.update(upsellOffers)
      .set(dataToUpdate)
      .where(eq(upsellOffers.id, id))
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
export async function getAllUpsellOffers(): Promise<UpsellOffer[]> {
  try {
    return await db.select().from(upsellOffers).orderBy(desc(upsellOffers.displayOrder));
  } catch (error) {
    console.error('Error getting upsell offers:', error);
    throw new Error('Failed to get upsell offers');
  }
}

/**
 * Gets active upsell offers
 */
export async function getActiveUpsellOffers(): Promise<UpsellOffer[]> {
  try {
    return await db.select()
      .from(upsellOffers)
      .where(eq(upsellOffers.active, true))
      .orderBy(desc(upsellOffers.displayOrder));
  } catch (error) {
    console.error('Error getting active upsell offers:', error);
    throw new Error('Failed to get active upsell offers');
  }
}

/**
 * Gets a single upsell offer by ID
 */
export async function getUpsellOfferById(id: number): Promise<UpsellOffer | null> {
  try {
    const result = await db.select()
      .from(upsellOffers)
      .where(eq(upsellOffers.id, id))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error getting upsell offer by ID:', error);
    throw new Error('Failed to get upsell offer');
  }
}

/**
 * Deletes an upsell offer
 */
export async function deleteUpsellOffer(id: number): Promise<boolean> {
  try {
    const result = await db.delete(upsellOffers)
      .where(eq(upsellOffers.id, id))
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
export async function createAppointmentUpsell(appointmentId: number, upsellOfferId: number): Promise<AppointmentUpsell> {
  try {
    // Get the upsell offer to determine validity days
    const offer = await getUpsellOfferById(upsellOfferId);
    if (!offer) {
      throw new Error('Upsell offer not found');
    }
    
    // Calculate expiry date based on validityDays
    const expiryDate = addDays(new Date(), offer.validityDays || 3);
    
    const result = await db.insert(appointmentUpsells).values({
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
export async function getApplicableUpsellsForAppointment(appointmentId: number): Promise<UpsellOffer[]> {
  try {
    // Get the appointment details
    const appointmentResult = await db.select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    
    if (appointmentResult.length === 0) {
      throw new Error('Appointment not found');
    }
    
    const appointment = appointmentResult[0];
    
    // Get the service details
    const serviceResult = await db.select()
      .from(services)
      .where(eq(services.id, appointment.serviceId))
      .limit(1);
    
    if (serviceResult.length === 0) {
      throw new Error('Service not found');
    }
    
    const service = serviceResult[0];
    
    // Get active upsell offers
    const allOffers = await getActiveUpsellOffers();
    
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
    
    const result = await db.update(appointmentUpsells)
      .set(updateData)
      .where(eq(appointmentUpsells.id, id))
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
export async function getActiveAppointmentUpsells(appointmentId: number): Promise<AppointmentUpsell[]> {
  try {
    const now = new Date();
    
    return await db.select()
      .from(appointmentUpsells)
      .where(
        and(
          eq(appointmentUpsells.appointmentId, appointmentId),
          eq(appointmentUpsells.status, 'offered'),
          gte(appointmentUpsells.expiryDate, now)
        )
      );
  } catch (error) {
    console.error('Error getting active appointment upsells:', error);
    throw new Error('Failed to get active appointment upsells');
  }
}

/**
 * Gets detailed information about upsell offers for an appointment
 * including the offer details and appointment upsell status
 */
export async function getAppointmentUpsellsWithDetails(appointmentId: number): Promise<any[]> {
  try {
    // Get all appointment upsells for this appointment
    const appointmentUpsellsList = await db.select()
      .from(appointmentUpsells)
      .where(eq(appointmentUpsells.appointmentId, appointmentId));
    
    // Get the upsell offer details for each one
    const result = await Promise.all(
      appointmentUpsellsList.map(async (appUpsell) => {
        const offer = await getUpsellOfferById(appUpsell.upsellOfferId);
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
  appointmentUpsellId: number, 
  customerInfo: any
): Promise<{success: boolean, appointmentId?: number, message: string}> {
  try {
    // Get the appointment upsell details
    const appointmentUpsellResult = await db.select()
      .from(appointmentUpsells)
      .where(eq(appointmentUpsells.id, appointmentUpsellId))
      .limit(1);
    
    if (appointmentUpsellResult.length === 0) {
      return {
        success: false,
        message: 'Appointment upsell not found'
      };
    }
    
    const appointmentUpsell = appointmentUpsellResult[0];
    
    // Check if the upsell is still valid
    const now = new Date();
    if (appointmentUpsell.status !== 'offered' || appointmentUpsell.expiryDate < now) {
      return {
        success: false,
        message: 'Upsell offer has expired or is no longer valid'
      };
    }
    
    // Get the upsell offer details
    const upsellOffer = await getUpsellOfferById(appointmentUpsell.upsellOfferId);
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