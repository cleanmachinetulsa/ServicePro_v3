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
      return {
        valid: false,
        inServiceArea: false,
        message: 'Unable to validate address. Please provide a complete street address in the Tulsa area.',
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
  try {
    console.log(`[SCHEDULING TOOLS] Getting available slots for ${service}, customer: ${phone}`);
    
    // Import the calendar function directly
    const { generateAvailableSlots } = await import('./calendarApi');
    
    // Get slots from Google Calendar
    const slots = await generateAvailableSlots(service);
    
    console.log(`[SCHEDULING TOOLS] Retrieved ${slots.length} available slots`);
    
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
    
    console.log(`[SCHEDULING TOOLS] Formatted ${formattedSlots.length} slots for AI`);
    
    // Store offered slots in conversation state
    conversationState.updateState(phone, {
      offeredTimeSlots: formattedSlots,
    });
    
    return formattedSlots;
    
  } catch (error) {
    console.error('❌ CALENDAR API ERROR - Failed to get available slots:', error);
    console.error('Error details:', error);
    // Return empty array to trigger fallback mode (natural language time input)
    // This is intentional - allows manual confirmation workflow
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
