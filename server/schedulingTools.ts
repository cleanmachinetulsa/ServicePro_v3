/**
 * Scheduling Tools for AI Function Calling
 * These tools allow the AI to perform actions during conversational scheduling
 */

import { customerMemory } from './customerMemory';
import { conversationState } from './conversationState';
import { checkDistanceToBusinessLocation } from './googleMapsApi';
import { getActiveUpsellOffers } from './upsellService';
import { handleGetAvailable, handleBook } from './calendarApi';
import { sheetsData } from './knowledge';

interface CustomerDatabaseResult {
  found: boolean;
  name?: string;
  phone?: string;
  email?: string;
  vehicles?: string[];
  serviceHistory?: Array<{
    service: string;
    date: string;
  }>;
  lastVisit?: string;
  totalVisits?: number;
}

interface AddressValidationResult {
  valid: boolean;
  inServiceArea: boolean;
  driveTimeMinutes?: number;
  formattedAddress?: string;
  message: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  formattedTime: string;
}

/**
 * Smart Availability Deep Links L2 - Enhanced slot models
 * Supports both individual "book" links and "view all" calendar links
 */
export interface SuggestedSlot {
  start: Date;
  end: Date;
  humanLabel: string;
  bookUrl: string;       // deep link to book THIS specific slot
}

export interface SuggestedSlotSet {
  slots: SuggestedSlot[];
  viewAllUrl?: string;   // deep link to open calendar focused on first slot's week
  source?: 'chat' | 'site';
}

interface UpsellOffer {
  name: string;
  price: string;
  description: string;
  relevantFor?: string[];
}

/**
 * Tool 1: Check Customer Database
 * Looks up customer in Google Sheets to greet by name and know their history
 */
export async function checkCustomerDatabase(phone: string): Promise<CustomerDatabaseResult> {
  try {
    // First check in-memory customer store
    const memoryCustomer = customerMemory.getCustomer(phone);
    
    // Then check Google Sheets Customer Database
    const sheetData = sheetsData['Customer Database'] || sheetsData['Customer_Database'] || sheetsData['customer database'] || [];
    
    if (!sheetData || sheetData.length === 0) {
      // Fallback to memory only
      if (memoryCustomer) {
        return {
          found: true,
          name: memoryCustomer.name,
          phone: memoryCustomer.phone || phone,
          email: memoryCustomer.email,
          vehicles: memoryCustomer.vehicleInfo ? [memoryCustomer.vehicleInfo] : undefined,
          serviceHistory: memoryCustomer.serviceHistory?.map(s => ({
            service: s.service,
            date: s.date.toLocaleDateString(),
          })),
        };
      }
      return { found: false };
    }
    
    // Search for customer in sheet data by phone number
    const customerRow = sheetData.find((row: any) => {
      const rowPhone = String(row['Phone'] || row['Phone Number'] || '').replace(/\D/g, '');
      const searchPhone = phone.replace(/\D/g, '');
      return rowPhone === searchPhone;
    });
    
    if (customerRow) {
      const name = customerRow['Name'] || customerRow['Customer Name'] || '';
      const email = customerRow['Email'] || '';
      const vehicle1 = customerRow['Vehicle 1'] || customerRow['Vehicle'] || '';
      const vehicle2 = customerRow['Vehicle 2'] || '';
      const lastService = customerRow['Last Service'] || customerRow['Service'] || '';
      const lastDate = customerRow['Last Service Date'] || customerRow['Date'] || '';
      
      // Update in-memory store with sheet data
      if (name) {
        conversationState.updateState(phone, {
          customerName: name,
          customerEmail: email || undefined,
          isExistingCustomer: true,
        });
        
        customerMemory.updateCustomer(phone, {
          name,
          email: email || undefined,
          vehicleInfo: vehicle1 || undefined,
        });
      }
      
      const vehicles = [vehicle1, vehicle2].filter(Boolean);
      const serviceHistory = lastService ? [{
        service: lastService,
        date: lastDate || 'Unknown date',
      }] : undefined;
      
      return {
        found: true,
        name,
        phone,
        email: email || undefined,
        vehicles: vehicles.length > 0 ? vehicles : undefined,
        serviceHistory,
        lastVisit: lastDate || undefined,
      };
    }
    
    // Not found in sheets, mark as new customer
    conversationState.updateState(phone, { isExistingCustomer: false });
    return { found: false };
    
  } catch (error) {
    console.error('❌ ERROR checking customer database:', error);
    // Still return not found rather than throw - this is acceptable fallback
    return { found: false };
  }
}

/**
 * Tool 2: Validate Address
 * Checks if address is within service area using Google Maps API
 */
export async function validateAddress(phone: string, address: string): Promise<AddressValidationResult> {
  try {
    const result = await checkDistanceToBusinessLocation(address);
    
    if (!result.success) {
      // SMART CORRECTION: Instead of hard-rejecting, try to help them fix it
      let errorMessage = '';
      let suggestedAddress = address;
      
      if ('enhancedAddress' in result && result.enhancedAddress) {
        // We enhanced the address (added Tulsa, OK) - use that as suggestion
        suggestedAddress = result.enhancedAddress;
        errorMessage = `I couldn't verify "${address}" exactly. Did you mean "${suggestedAddress}"? `;
      } else {
        // No enhancement possible, ask for clarification
        errorMessage = `I'm having trouble finding "${address}". `;
      }
      
      // Helpful suggestions with examples
      errorMessage += 'Please check the street number and name. Examples: "2710 South Hudson Place" or "4644 S Troost Ave". I can work with partial addresses - you don\'t need to include "Tulsa, OK"!';
      
      // PERMISSIVE FALLBACK: Store the address anyway so booking can proceed
      // This prevents blocking customers with valid but hard-to-geocode addresses
      conversationState.updateState(phone, {
        address: suggestedAddress,
        addressValidated: false, // Flag as unverified
        isInServiceArea: true, // Allow booking to proceed
      });
      
      customerMemory.updateCustomer(phone, {
        address: suggestedAddress,
      });
      
      return {
        valid: true, // Changed to true to allow proceeding
        inServiceArea: true, // Allow booking
        message: errorMessage + ' I\'ll save what you entered and we can confirm the exact address later.',
      };
    }
    
    const inServiceArea = 'isInServiceArea' in result ? result.isInServiceArea : false;
    const driveTime = 'driveTime' in result && result.driveTime ? result.driveTime.minutes : 0;
    
    // Update conversation state
    conversationState.updateState(phone, {
      address: result.formattedAddress || address,
      addressValidated: true,
      isInServiceArea: inServiceArea,
      driveTimeMinutes: driveTime,
    });
    conversationState.completeStep(phone, 'addressValidated');
    
    // Also update customer memory
    customerMemory.updateCustomer(phone, {
      address: result.formattedAddress || address,
    });
    
    if (inServiceArea) {
      return {
        valid: true,
        inServiceArea: true,
        driveTimeMinutes: driveTime,
        formattedAddress: result.formattedAddress,
        message: `Great! Your address is within our service area (${Math.round(driveTime)} minute drive from our location).`,
      };
    } else {
      return {
        valid: true,
        inServiceArea: false,
        driveTimeMinutes: driveTime,
        formattedAddress: result.formattedAddress,
        message: `Your address is ${Math.round(driveTime)} minutes from our Tulsa base, just outside our typical 26-minute service area. We can often make exceptions with a small extended-area fee. Want to go ahead and book?`,
      };
    }
    
  } catch (error) {
    console.error('❌ MAPS API ERROR - Address validation failed:', error);
    console.error('TODO: Verify Google Maps API credentials are configured');
    return {
      valid: false,
      inServiceArea: false,
      message: 'Unable to validate address due to system error. Please contact support.',
    };
  }
}

/**
 * Tool 3: Get Available Time Slots
 * Fetches real availability from Google Calendar
 */
export async function getAvailableSlots(phone: string, service: string): Promise<TimeSlot[]> {
  console.log(`[SCHEDULING TOOLS] ========== GET AVAILABLE SLOTS CALLED ==========`);
  console.log(`[SCHEDULING TOOLS] Service: ${service}, Customer: ${phone}`);
  
  try {
    // Import the calendar function directly
    const { generateAvailableSlots } = await import('./calendarApi');
    
    console.log(`[SCHEDULING TOOLS] Calling generateAvailableSlots for service: "${service}"`);
    
    // Get slots from Google Calendar
    const slots = await generateAvailableSlots(service);
    
    console.log(`[SCHEDULING TOOLS] ✅ Calendar returned ${slots.length} available slots`);
    
    if (slots.length === 0) {
      console.warn(`[SCHEDULING TOOLS] ⚠️ No slots returned - calendar may be fully booked or service not found`);
    }
    
    // Format slots for AI (limit to 5 for readability)
    const formattedSlots: TimeSlot[] = slots.slice(0, 5).map((slotTime: string) => {
      const date = new Date(slotTime);
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
      };
      const formattedTime = date.toLocaleString('en-US', options);
      
      return {
        time: slotTime,
        available: true,
        formattedTime,
      };
    });
    
    console.log(`[SCHEDULING TOOLS] Formatted ${formattedSlots.length} slots for AI response:`);
    formattedSlots.forEach((slot, i) => {
      console.log(`  ${i + 1}. ${slot.formattedTime}`);
    });
    
    // Store offered slots in conversation state
    conversationState.updateState(phone, {
      offeredTimeSlots: formattedSlots,
    });
    
    console.log(`[SCHEDULING TOOLS] ========== END GET AVAILABLE SLOTS ==========`);
    return formattedSlots;
    
  } catch (error) {
    console.error('[SCHEDULING TOOLS] ❌ CALENDAR API ERROR - Failed to get available slots');
    console.error('[SCHEDULING TOOLS] Error:', error);
    console.error('[SCHEDULING TOOLS] Stack:', (error as Error).stack);
    // Return empty array but log the issue clearly
    // This triggers fallback mode (natural language time input)
    return [];
  }
}

/**
 * Tool 4: Get Upsell Offers
 * Retrieves SMART, relevant add-on recommendations based on selected service
 */
export async function getUpsellOffers(phone: string, service: string): Promise<UpsellOffer[]> {
  try {
    console.log(`[SCHEDULING TOOLS] Getting smart upsell recommendations for ${service}, customer: ${phone}`);
    
    // Get add-on services from Google Sheets
    const addOnData = sheetsData['addons'] || sheetsData['Add-Ons'] || sheetsData['Add-ons'] || [];
    
    if (!addOnData || addOnData.length === 0) {
      console.log('[SCHEDULING TOOLS] No add-on data available from Google Sheets');
      return [];
    }
    
    // Smart filtering logic based on service type
    const serviceLower = service.toLowerCase();
    const allOffers: UpsellOffer[] = addOnData.map((row: any): UpsellOffer => ({
      name: row['Add-On Service'] || row['Service'] || row['Add-On'] || row['Name'] || '',
      price: row['Price'] || row['Cost'] || '',
      description: row['Overview'] || row['Description'] || '',
    })).filter((offer: UpsellOffer) => offer.name && offer.price);
    
    // Smart filtering rules
    let relevantOffers: UpsellOffer[] = [];
    
    if (serviceLower.includes('interior')) {
      // For Interior Detail: Suggest fabric/leather protector, NOT paint-related services
      relevantOffers = allOffers.filter(offer => 
        offer.name.toLowerCase().includes('protector') ||
        offer.name.toLowerCase().includes('fabric') ||
        offer.name.toLowerCase().includes('leather') ||
        offer.name.toLowerCase().includes('shampoo')
      );
    } else if (serviceLower.includes('full detail')) {
      // For Full Detail: Can suggest anything since it covers everything
      relevantOffers = allOffers;
    } else if (serviceLower.includes('ceramic') || serviceLower.includes('polish')) {
      // For paint-focused services: Suggest headlight restoration, plastic trim, etc.
      relevantOffers = allOffers.filter(offer =>
        offer.name.toLowerCase().includes('headlight') ||
        offer.name.toLowerCase().includes('trim') ||
        offer.name.toLowerCase().includes('polish') ||
        offer.name.toLowerCase().includes('glass')
      );
    } else {
      // Default: Suggest most popular/versatile add-ons
      relevantOffers = allOffers;
    }
    
    // Limit to top 3 most relevant
    const topOffers = relevantOffers.slice(0, 3);
    
    console.log(`[SCHEDULING TOOLS] Filtered ${allOffers.length} add-ons to ${topOffers.length} relevant recommendations`);
    
    // Store in conversation state
    conversationState.updateState(phone, {
      offeredUpsells: topOffers,
    });
    conversationState.completeStep(phone, 'upsellsOffered');
    
    return topOffers;
    
  } catch (error) {
    console.error('❌ SHEETS ERROR - Failed to get upsell offers:', error);
    console.error('Error details:', error);
    // Return empty array - acceptable to skip upsells if unavailable
    return [];
  }
}

/**
 * Tool 5: Create Appointment
 * Books the appointment in Google Calendar on behalf of customer
 */
export async function createAppointment(phone: string): Promise<{
  success: boolean;
  message: string;
  appointmentId?: string;
  eventLink?: string;
}> {
  try {
    const state = conversationState.getState(phone);
    
    // Validate we have all required information
    if (!state.customerName || !state.address || !state.service || !state.selectedTimeSlot) {
      return {
        success: false,
        message: 'Missing required information. Please provide: ' + conversationState.getMissingFields(phone).join(', '),
      };
    }
    
    // Prepare booking data
    const bookingData = {
      name: state.customerName,
      phone: phone,
      email: state.customerEmail || '',
      address: state.address,
      service: state.service,
      time: state.selectedTimeSlot,
      addOns: state.addOns || [],
      vehicles: state.vehicles || [],
      notes: '',
      smsConsent: true,
      isExtendedAreaRequest: !state.isInServiceArea,
    };
    
    // Create mock request/response for handleBook
    const mockReq = {
      body: bookingData,
    };
    
    let bookingResult: any = {};
    const mockRes = {
      json: (data: any) => {
        bookingResult = data;
      },
      status: (code: number) => ({
        json: (data: any) => {
          bookingResult = { ...data, statusCode: code };
        },
      }),
    };
    
    await handleBook(mockReq, mockRes);
    
    if (bookingResult.success) {
      // Mark conversation as complete
      conversationState.completeStep(phone, 'finalConfirmation');
      
      // Update customer service history
      customerMemory.updateCustomer(phone, {
        serviceHistory: [
          ...(customerMemory.getCustomer(phone)?.serviceHistory || []),
          {
            service: state.service,
            date: new Date(state.selectedTimeSlot),
            notes: state.addOns?.join(', '),
          },
        ],
      });
      
      return {
        success: true,
        message: bookingResult.message || 'Appointment booked successfully!',
        appointmentId: bookingResult.eventId,
        eventLink: bookingResult.eventLink,
      };
    } else {
      return {
        success: false,
        message: bookingResult.message || 'Failed to book appointment. Please try again.',
      };
    }
    
  } catch (error) {
    console.error('❌ BOOKING ERROR - Failed to create appointment:', error);
    console.error('TODO: Verify Google Calendar API and notification systems are working');
    return {
      success: false,
      message: 'Unable to create appointment due to system error: ' + (error as Error).message,
    };
  }
}

/**
 * Helper: Build Invoice-Style Summary
 * Creates a clean, formatted summary of the appointment for confirmation
 */
export function buildInvoiceSummary(phone: string): string {
  const state = conversationState.getState(phone);
  
  let summary = '📋 APPOINTMENT SUMMARY\n';
  summary += '━━━━━━━━━━━━━━━━━━━━\n\n';
  
  if (state.customerName) {
    summary += `👤 Customer: ${state.customerName}\n`;
  }
  
  if (state.customerEmail) {
    summary += `📧 Email: ${state.customerEmail}\n`;
  }
  
  summary += `📱 Phone: ${phone}\n`;
  
  if (state.address) {
    summary += `📍 Location: ${state.address}\n`;
  }
  
  summary += '\n';
  
  if (state.service) {
    summary += `🚗 Service: ${state.service}\n`;
  }
  
  if (state.addOns && state.addOns.length > 0) {
    summary += `✨ Add-ons: ${state.addOns.join(', ')}\n`;
  }
  
  if (state.selectedTimeSlot) {
    const date = new Date(state.selectedTimeSlot);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    };
    summary += `📅 Date & Time: ${date.toLocaleString('en-US', options)}\n`;
  }
  
  if (state.vehicles && state.vehicles.length > 0) {
    summary += '\n🚙 Vehicles:\n';
    state.vehicles.forEach((v, idx) => {
      const vehicleStr = [v.year, v.make, v.model, v.color].filter(Boolean).join(' ');
      if (vehicleStr) {
        summary += `   ${idx + 1}. ${vehicleStr}\n`;
      }
    });
  }
  
  summary += '\n━━━━━━━━━━━━━━━━━━━━\n';
  summary += '\nReply "CONFIRM" to book this appointment, or let me know if you need any changes.';
  
  return summary;
}

/**
 * Tool 6: Get Existing Appointment
 * Find an existing appointment for a customer by phone number
 */
export async function getExistingAppointment(phone: string): Promise<{
  found: boolean;
  appointmentId?: string;
  service?: string;
  scheduledTime?: string;
  address?: string;
  status?: string;
  technicianId?: number | null;
  message: string;
}> {
  try {
    const { db } = await import('./db');
    const { appointments, customers } = await import('@shared/schema');
    const { eq, and, gte, sql } = await import('drizzle-orm');
    
    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Find customer by phone
    const customer = await db.select()
      .from(customers)
      .where(sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '+', '') = ${normalizedPhone}`)
      .limit(1);
    
    if (!customer || customer.length === 0) {
      return {
        found: false,
        message: 'No customer account found with this phone number.',
      };
    }
    
    // Find upcoming appointments for this customer
    const now = new Date();
    const appointment = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.customerId, customer[0].id),
        gte(appointments.scheduledTime, now)
      ))
      .orderBy(appointments.scheduledTime)
      .limit(1);
    
    if (!appointment || appointment.length === 0) {
      return {
        found: false,
        message: 'No upcoming appointments found for this customer.',
      };
    }
    
    const appt = appointment[0];
    
    return {
      found: true,
      appointmentId: appt.googleCalendarEventId || appt.id.toString(),
      service: appt.serviceType || undefined,
      scheduledTime: appt.scheduledTime.toISOString(),
      address: appt.customerAddress || undefined,
      status: appt.status,
      technicianId: appt.technicianId,
      message: `Found appointment: ${appt.serviceType} on ${appt.scheduledTime.toLocaleDateString()} at ${appt.scheduledTime.toLocaleTimeString()}`,
    };
    
  } catch (error) {
    console.error('❌ ERROR getting existing appointment:', error);
    return {
      found: false,
      message: 'Error retrieving appointment information: ' + (error as Error).message,
    };
  }
}

/**
 * Tool 7: Update Appointment Address
 * Modify the address for an existing appointment
 */
export async function updateAppointmentAddress(phone: string, newAddress: string): Promise<{
  success: boolean;
  message: string;
  updatedAddress?: string;
}> {
  try {
    // First, validate the new address
    const validation = await validateAddress(phone, newAddress);
    
    if (!validation.inServiceArea) {
      return {
        success: false,
        message: `The new address "${newAddress}" is outside our service area. We can only service locations within 26 minutes of Tulsa.`,
      };
    }
    
    // Find existing appointment
    const existingAppt = await getExistingAppointment(phone);
    
    if (!existingAppt.found) {
      return {
        success: false,
        message: existingAppt.message,
      };
    }
    
    // Update appointment in database
    const { db } = await import('./db');
    const { appointments, customers } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    
    const normalizedPhone = phone.replace(/\D/g, '');
    const customer = await db.select()
      .from(customers)
      .where(sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '+', '') = ${normalizedPhone}`)
      .limit(1);
    
    if (!customer || customer.length === 0) {
      return {
        success: false,
        message: 'Customer not found.',
      };
    }
    
    await db.update(appointments)
      .set({
        customerAddress: validation.formattedAddress || newAddress,
      })
      .where(eq(appointments.customerId, customer[0].id));
    
    // Update customer record with new address
    await db.update(customers)
      .set({
        address: validation.formattedAddress || newAddress,
      })
      .where(eq(customers.id, customer[0].id));
    
    // Update conversation state
    conversationState.updateState(phone, {
      address: validation.formattedAddress || newAddress,
      addressValidated: true,
      isInServiceArea: true,
    });
    
    customerMemory.updateCustomer(phone, {
      address: validation.formattedAddress || newAddress,
    });
    
    return {
      success: true,
      message: `Address updated successfully to: ${validation.formattedAddress || newAddress}`,
      updatedAddress: validation.formattedAddress || newAddress,
    };
    
  } catch (error) {
    console.error('❌ ERROR updating appointment address:', error);
    return {
      success: false,
      message: 'Failed to update address due to system error: ' + (error as Error).message,
    };
  }
}

/**
 * Tool 8: Add Appointment Notes
 * Add notes to an existing appointment (e.g., "customer prefers back driveway", "running 20 min late")
 */
export async function addAppointmentNotes(phone: string, notes: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Find existing appointment
    const existingAppt = await getExistingAppointment(phone);
    
    if (!existingAppt.found) {
      return {
        success: false,
        message: existingAppt.message,
      };
    }
    
    // Update appointment in database
    const { db } = await import('./db');
    const { appointments, customers } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    
    const normalizedPhone = phone.replace(/\D/g, '');
    const customer = await db.select()
      .from(customers)
      .where(sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '+', '') = ${normalizedPhone}`)
      .limit(1);
    
    if (!customer || customer.length === 0) {
      return {
        success: false,
        message: 'Customer not found.',
      };
    }
    
    // Get current notes and append new ones
    const currentAppt = await db.select()
      .from(appointments)
      .where(eq(appointments.customerId, customer[0].id))
      .limit(1);
    
    const currentNotes = currentAppt[0]?.jobNotes || '';
    const updatedNotes = currentNotes 
      ? `${currentNotes}\n\n[${new Date().toLocaleString()}] ${notes}`
      : notes;
    
    await db.update(appointments)
      .set({
        jobNotes: updatedNotes,
      })
      .where(eq(appointments.customerId, customer[0].id));
    
    return {
      success: true,
      message: `Notes added successfully: "${notes}"`,
    };
    
  } catch (error) {
    console.error('❌ ERROR adding appointment notes:', error);
    return {
      success: false,
      message: 'Failed to add notes due to system error: ' + (error as Error).message,
    };
  }
}

/**
 * Tool 9: Reschedule Appointment
 * Change the date/time of an existing appointment
 */
export async function rescheduleAppointment(phone: string, newDateTime: string): Promise<{
  success: boolean;
  message: string;
  newTime?: string;
}> {
  try {
    // Find existing appointment
    const existingAppt = await getExistingAppointment(phone);
    
    if (!existingAppt.found) {
      return {
        success: false,
        message: existingAppt.message,
      };
    }
    
    // Parse new date/time
    const newDate = new Date(newDateTime);
    
    if (isNaN(newDate.getTime())) {
      return {
        success: false,
        message: `Invalid date/time format: "${newDateTime}". Please provide a valid date and time.`,
      };
    }
    
    // Check if new time is in the future
    if (newDate < new Date()) {
      return {
        success: false,
        message: 'Cannot reschedule to a past date/time. Please choose a future date.',
      };
    }
    
    // Update appointment in database
    const { db } = await import('./db');
    const { appointments, customers } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    
    const normalizedPhone = phone.replace(/\D/g, '');
    const customer = await db.select()
      .from(customers)
      .where(sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '+', '') = ${normalizedPhone}`)
      .limit(1);
    
    if (!customer || customer.length === 0) {
      return {
        success: false,
        message: 'Customer not found.',
      };
    }
    
    await db.update(appointments)
      .set({
        scheduledTime: newDate,
      })
      .where(eq(appointments.customerId, customer[0].id));
    
    // Update Google Calendar event if applicable
    // TODO: Integrate with Google Calendar API to update the event
    
    const formattedTime = newDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    });
    
    return {
      success: true,
      message: `Appointment rescheduled successfully to: ${formattedTime}`,
      newTime: formattedTime,
    };
    
  } catch (error) {
    console.error('❌ ERROR rescheduling appointment:', error);
    return {
      success: false,
      message: 'Failed to reschedule due to system error: ' + (error as Error).message,
    };
  }
}

/**
 * Smart Availability Deep Links
 * Builds booking URLs with pre-selected time slots for web chat
 */
export interface BookingSlotLinkInput {
  tenantId: string;
  start: Date;
  durationMinutes?: number;
  source?: string;
}

export interface BookingSlotLinkResult {
  url: string;
  startIso: string;
  humanLabel: string;
}

/**
 * Build a booking URL with pre-selected slot for a tenant
 * Multi-tenant: queries tenant_domains for custom domain, falls back to env vars
 */
export async function buildBookingSlotLink(input: BookingSlotLinkInput): Promise<BookingSlotLinkResult | null> {
  try {
    const { tenantId, start, durationMinutes, source } = input;
    
    // Determine base URL for the tenant
    let baseUrl: string = '';
    
    // Try to get tenant's custom domain from tenant_domains table
    try {
      const { db } = await import('./db');
      const { tenantDomains } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const domains = await db.select()
        .from(tenantDomains)
        .where(eq(tenantDomains.tenantId, tenantId))
        .limit(1);
      
      if (domains.length > 0 && domains[0].isVerified && domains[0].domain) {
        baseUrl = `https://${domains[0].domain}`;
        console.log(`[BOOKING LINK] Using custom domain for ${tenantId}: ${domains[0].domain}`);
      }
    } catch (dbError) {
      // tenant_domains table might not exist yet - continue to fallback
      console.log('[BOOKING LINK] tenant_domains not available, using fallback URL');
    }
    
    // Fallback: use environment variable or Replit URL
    if (!baseUrl) {
      baseUrl = process.env.PUBLIC_APP_BASE_URL || 
                (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co` : '');
    }
    
    if (!baseUrl) {
      console.warn('[BOOKING LINK] No base URL available for tenant:', tenantId);
      return null;
    }
    
    // Build the booking URL with query params
    const params = new URLSearchParams();
    params.set('slotStart', start.toISOString());
    if (durationMinutes) {
      params.set('durationMinutes', durationMinutes.toString());
    }
    params.set('source', source || 'chat');
    
    // Use /book path (the existing booking route)
    const url = `${baseUrl}/book?${params.toString()}`;
    
    // Create human-readable label for the slot
    const humanLabel = start.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    });
    
    console.log(`[BOOKING LINK] Generated for ${tenantId}: ${url}`);
    
    return {
      url,
      startIso: start.toISOString(),
      humanLabel,
    };
    
  } catch (error) {
    console.error('[BOOKING LINK] Error building link:', error);
    return null;
  }
}

/**
 * Smart Availability Deep Links L2: Build a "View All" calendar link
 * Opens the booking page focused on a specific date without preselecting a slot
 */
export interface ViewAllCalendarLinkInput {
  tenantId: string;
  focusDate: Date;
  source?: string;
}

export interface ViewAllCalendarLinkResult {
  url: string;
  focusDateIso: string;
}

export async function buildViewAllCalendarLink(input: ViewAllCalendarLinkInput): Promise<ViewAllCalendarLinkResult | null> {
  try {
    const { tenantId, focusDate, source } = input;
    
    let baseUrl: string = '';
    
    try {
      const { db } = await import('./db');
      const { tenantDomains } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const domains = await db.select()
        .from(tenantDomains)
        .where(eq(tenantDomains.tenantId, tenantId))
        .limit(1);
      
      if (domains.length > 0 && domains[0].isVerified && domains[0].domain) {
        baseUrl = `https://${domains[0].domain}`;
      }
    } catch (dbError) {
      console.log('[VIEW ALL LINK] tenant_domains not available, using fallback URL');
    }
    
    if (!baseUrl) {
      baseUrl = process.env.PUBLIC_APP_BASE_URL || 
                (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co` : '');
    }
    
    if (!baseUrl) {
      console.warn('[VIEW ALL LINK] No base URL available for tenant:', tenantId);
      return null;
    }
    
    const params = new URLSearchParams();
    const focusDateStr = focusDate.toISOString().split('T')[0];
    params.set('focusDate', focusDateStr);
    params.set('source', source || 'chat');
    
    const url = `${baseUrl}/book?${params.toString()}`;
    
    console.log(`[VIEW ALL LINK] Generated for ${tenantId}: ${url}`);
    
    return {
      url,
      focusDateIso: focusDateStr,
    };
    
  } catch (error) {
    console.error('[VIEW ALL LINK] Error building link:', error);
    return null;
  }
}

/**
 * Smart Availability Deep Links L2: Build multiple slot links with viewAll
 * Creates individual book URLs for each slot and a single viewAll URL
 */
export async function buildSuggestedSlotSet(
  tenantId: string,
  slots: Array<{ time: string; formattedTime: string }>,
  durationMinutes?: number,
  source: 'chat' | 'site' = 'chat'
): Promise<SuggestedSlotSet | null> {
  try {
    if (slots.length === 0) {
      return null;
    }
    
    const suggestedSlots: SuggestedSlot[] = [];
    
    for (const slot of slots.slice(0, 5)) {
      const slotDate = new Date(slot.time);
      const endDate = new Date(slotDate.getTime() + (durationMinutes || 120) * 60 * 1000);
      
      const bookLink = await buildBookingSlotLink({
        tenantId,
        start: slotDate,
        durationMinutes,
        source,
      });
      
      if (bookLink) {
        suggestedSlots.push({
          start: slotDate,
          end: endDate,
          humanLabel: slot.formattedTime,
          bookUrl: bookLink.url,
        });
      }
    }
    
    if (suggestedSlots.length === 0) {
      return null;
    }
    
    const viewAllLink = await buildViewAllCalendarLink({
      tenantId,
      focusDate: suggestedSlots[0].start,
      source,
    });
    
    return {
      slots: suggestedSlots,
      viewAllUrl: viewAllLink?.url,
      source,
    };
    
  } catch (error) {
    console.error('[SLOT SET] Error building slot set:', error);
    return null;
  }
}
