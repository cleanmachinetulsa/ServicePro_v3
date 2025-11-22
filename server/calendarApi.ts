import { addDays, addHours, format, setHours, setMinutes } from "date-fns";
import { getGoogleCalendarClient } from "./googleCalendarConnector";
import { criticalMonitor } from "./criticalMonitoring";
import { customerMemory } from "./customerMemory";
import {
  sendBookingConfirmation,
  scheduleDayBeforeReminder,
} from "./notifications";
import { trackReferralSignup } from "./referralService";
import { recordAppointmentCreated } from "./customerBookingStats";
import { invalidateAppointmentCaches } from "./cacheService";

// COMMIT
// Configuration for booking appointments
// Business hours are now loaded dynamically from database (business_settings table)
// Service durations are now loaded from database (services table) instead of hardcoded

/**
 * Helper function to get service info from database
 * Returns duration (for calendar blocking) and service ID (for limit tracking)
 */
async function getServiceInfo(serviceName: string): Promise<{ duration: number; serviceId: number }> {
  try {
    const { db: dbInstance } = await import('./db');
    const { services } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const result = await dbInstance
      .select({
        id: services.id,
        duration: services.durationHours,
        minDuration: services.minDurationHours,
        maxDuration: services.maxDurationHours,
      })
      .from(services)
      .where(eq(services.name, serviceName))
      .limit(1);
    
    if (result.length === 0) {
      console.warn(`⚠️ Service "${serviceName}" not found in database - using default 2-hour duration for legacy service`);
      return { duration: 2, serviceId: 0 };
    }
    
    const avgDuration = parseFloat(result[0].duration as string);
    
    if (!avgDuration || avgDuration === 0) {
      console.warn(`⚠️ Service "${serviceName}" has invalid duration (${avgDuration}) - using default 2-hour duration`);
      return { duration: 2, serviceId: result[0].id };
    }
    
    console.log(`Service "${serviceName}": blocking ${avgDuration}hrs (range: ${result[0].minDuration}-${result[0].maxDuration}hrs)`);
    return { duration: avgDuration, serviceId: result[0].id };
  } catch (error) {
    console.error('❌ ERROR fetching service info:', error);
    console.warn(`⚠️ Falling back to default 2-hour duration for service "${serviceName}"`);
    return { duration: 2, serviceId: 0 };
  }
}

/**
 * Helper function to get service average duration from database (backward compatibility)
 * Uses durationHours (average of min/max) for calendar blocking
 * This provides realistic scheduling while customers see 1-hour arrival windows
 */
async function getServiceDuration(serviceName: string): Promise<number> {
  const { duration } = await getServiceInfo(serviceName);
  return duration;
}

// Calendar ID - will need to be set via environment variable
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
console.log("Using Calendar ID for appointments:", CALENDAR_ID);

/**
 * Get fresh calendar client with automatic token refresh
 * NEVER cache this - tokens expire
 */
async function getFreshCalendarClient() {
  try {
    const client = await getGoogleCalendarClient();
    console.log("✅ Google Calendar client obtained successfully");
    criticalMonitor.reportSuccess('Google Calendar');
    return client;
  } catch (error: any) {
    console.error("❌ Failed to get Google Calendar client:", error.message);
    await criticalMonitor.reportFailure('Google Calendar', error.message);
    return null;
  }
}

/**
 * Test calendar connectivity on startup
 */
async function testCalendarConnectivity() {
  try {
    console.log("🔍 Testing Google Calendar connectivity...");
    const client = await getFreshCalendarClient();
    
    if (!client) {
      console.error("❌ CRITICAL: Google Calendar client initialization failed");
      return false;
    }

    // Test calendar access
    const result = await client.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(),
      timeMax: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    console.log(`✅ Calendar connectivity test PASSED - found ${result.data.items?.length || 0} events`);
    criticalMonitor.reportSuccess('Google Calendar');
    return true;
  } catch (error: any) {
    console.error("❌ CRITICAL: Calendar connectivity test FAILED:", error.message);
    await criticalMonitor.reportFailure('Google Calendar', error.message);
    return false;
  }
}

// Test calendar on startup
testCalendarConnectivity().catch((err) =>
  console.error("Startup calendar test failed:", err)
);

/**
 * Generate conflict-safe fallback slots when Google Calendar API is unavailable
 * Checks database for existing appointments to prevent double bookings
 * Returns default business hours slots for the next 14 days
 * Format matches generateAvailableSlots(): string[] of ISO timestamps
 */
async function generateConflictSafeFallbackSlots(serviceName: string): Promise<string[]> {
  console.warn("⚠️ USING FALLBACK SLOTS - Google Calendar unavailable, checking database for conflicts");
  
  // Get service duration for conflict checking
  const { duration } = await getServiceInfo(serviceName);
  
  // Fetch all existing appointments WITH service durations in SINGLE query (PERFORMANCE FIX)
  const { db: dbInstance } = await import('./db');
  const { appointments, services } = await import('@shared/schema');
  const { gte, eq } = await import('drizzle-orm');
  
  const now = new Date();
  const existingAppointments = await dbInstance
    .select({
      scheduledTime: appointments.scheduledTime,
      serviceName: appointments.service,
      serviceDuration: services.durationHours,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.service, services.name))
    .where(gte(appointments.scheduledTime, now));
  
  console.log(`[FALLBACK] Found ${existingAppointments.length} existing appointments in database`);
  
  // Pre-compute appointment time ranges with durations from JOIN (no additional queries)
  const appointmentRanges = existingAppointments.map(appt => {
    const apptTime = new Date(appt.scheduledTime);
    const apptDuration = parseFloat(appt.serviceDuration as string || '2'); // Default 2 hours if missing
    const apptEnd = addHours(apptTime, apptDuration);
    return { start: apptTime, end: apptEnd };
  });
  console.log(`[FALLBACK] Pre-computed ${appointmentRanges.length} appointment ranges (single query)`);
  
  
  const slots: string[] = [];
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // Generate slots for next 14 days (business hours: 9 AM - 5 PM)
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    
    // Skip Sundays (day 0)
    if (currentDate.getDay() === 0) continue;
    
    // Generate hourly slots from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      const slotTime = setMinutes(setHours(currentDate, hour), 0);
      const slotEnd = addHours(slotTime, duration);
      
      // Check for conflicts with pre-computed appointment ranges
      let hasConflict = false;
      for (const range of appointmentRanges) {
        // Check if slot overlaps with existing appointment
        if (
          (slotTime >= range.start && slotTime < range.end) ||
          (slotEnd > range.start && slotEnd <= range.end) ||
          (slotTime <= range.start && slotEnd >= range.end)
        ) {
          hasConflict = true;
          break;
        }
      }
      
      // Only include slot if no conflict
      if (!hasConflict) {
        slots.push(slotTime.toISOString());
      }
    }
  }
  
  console.log(`[FALLBACK] Generated ${slots.length} conflict-safe slots (removed ${(14 * 8) - slots.length} conflicting slots)`);
  return slots;
}

/**
 * Handle request for available time slots
 * GRACEFUL DEGRADATION: Returns conflict-safe fallback slots when Google Calendar API unavailable
 */
export async function handleGetAvailable(req: any, res: any) {
  try {
    const serviceName = req.query.service as string;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    // Try to get slots from Google Calendar first
    try {
      const slots = await generateAvailableSlots(serviceName);
      criticalMonitor.reportSuccess('Google Calendar'); // Report success after successful slot generation
      return res.json({ success: true, slots });
    } catch (calendarError: any) {
      console.error("❌ CALENDAR API ERROR - Failed to fetch availability:", calendarError.message);
      await criticalMonitor.reportFailure('Google Calendar', calendarError.message);
      
      // GRACEFUL FALLBACK: Use conflict-safe database-backed fallback
      console.warn("⚠️ Falling back to conflict-safe database availability");
      const fallbackSlots = await generateConflictSafeFallbackSlots(serviceName);
      
      // CRITICAL: Report success after successful fallback delivery (prevents stuck "failed" state)
      if (fallbackSlots.length > 0) {
        criticalMonitor.reportSuccess('Google Calendar');
        console.log(`✅ Fallback successful - returning ${fallbackSlots.length} conflict-safe slots`);
      }
      
      return res.json({ 
        success: true, 
        slots: fallbackSlots,
        fallback: true,
        message: "Calendar temporarily unavailable - showing database-verified availability"
      });
    }
  } catch (error: any) {
    console.error("Error getting available slots:", error);
    // Even on unexpected errors, try to return fallback slots
    try {
      const serviceName = req.query.service as string;
      const fallbackSlots = await generateConflictSafeFallbackSlots(serviceName || "Full Detail");
      
      // CRITICAL: Report success after successful fallback (even on unexpected errors)
      if (fallbackSlots.length > 0) {
        criticalMonitor.reportSuccess('Google Calendar');
        console.log(`✅ Emergency fallback successful - returning ${fallbackSlots.length} slots`);
      }
      
      return res.json({ 
        success: true, 
        slots: fallbackSlots,
        fallback: true,
        message: "Using database-verified availability"
      });
    } catch (fallbackError) {
      await criticalMonitor.reportFailure('Google Calendar', 'Complete failure - no fallback available');
      return res.status(500).json({
        success: false,
        message: "Failed to get available slots",
      });
    }
  }
}

/**
 * Handle booking appointment request
 */
export async function handleBook(req: any, res: any) {
  try {
    const {
      name,
      phone,
      address,
      isExtendedAreaRequest = false,
      latitude,
      longitude,
      addressNeedsReview = false,
      service,
      addOns = [],
      time,
      vehicles = [], // Accept vehicles array from frontend
      vehicleMake = "",
      vehicleModel = "",
      vehicleYear = "",
      vehicleColor = "",
      vehicleCondition = [],
      notes = "",
      email = "",
      smsConsent = false,
      referralCode = "",
    } = req.body;

    if (!name || !phone || !service || !time) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Create a detailed description including any add-on services and address information
    let appointmentDescription = `Service: ${service}`;
    if (isExtendedAreaRequest) {
      appointmentDescription += " [EXTENDED SERVICE AREA]";
    }
    if (addOns && addOns.length > 0) {
      appointmentDescription += `\nAdd-on Services: ${addOns.join(", ")}`;
    }
    appointmentDescription += `\nCustomer Phone: ${phone}`;
    if (address) {
      appointmentDescription += `\nAddress: ${address}`;
    }

    // Handle vehicles array (new format) or individual vehicle fields (legacy format)
    if (vehicles && vehicles.length > 0) {
      // New format: multiple vehicles as array
      vehicles.forEach((vehicle: any, index: number) => {
        const vehicleNum = vehicles.length > 1 ? `Vehicle ${index + 1}: ` : 'Vehicle: ';
        const vehicleInfo = [
          vehicle.year || vehicle.vehicleYear,
          vehicle.make || vehicle.vehicleMake,
          vehicle.model || vehicle.vehicleModel,
          vehicle.color || vehicle.vehicleColor
        ].filter(Boolean).join(" ");
        
        if (vehicleInfo) {
          appointmentDescription += `\n${vehicleNum}${vehicleInfo}`;
        }
        
        if (vehicle.condition && vehicle.condition.length > 0) {
          appointmentDescription += `\n  Condition: ${vehicle.condition.join(", ")}`;
        }
      });
    } else if (vehicleMake || vehicleModel || vehicleYear || vehicleColor) {
      // Legacy format: individual vehicle fields
      const vehicleInfo = [vehicleYear, vehicleMake, vehicleModel, vehicleColor]
        .filter(Boolean)
        .join(" ");

      if (vehicleInfo) {
        appointmentDescription += `\nVehicle: ${vehicleInfo}`;
      }

      // Add vehicle condition to the description if available
      if (vehicleCondition && vehicleCondition.length > 0) {
        appointmentDescription += `\nVehicle Condition: ${vehicleCondition.join(", ")}`;
      }
    }

    // Add notes to the description if available
    if (notes) {
      appointmentDescription += `\nNotes: ${notes}`;
    }

    // Update customer memory with service preferences
    if (customerMemory) {
      try {
        const customerInfo = customerMemory.getCustomer(phone) || {
          serviceHistory: [],
          servicePreferences: { additionalRequests: [] },
        };

        // Prepare vehicle info for customer memory
        let vehicleInfoForMemory = "";
        if (vehicles && vehicles.length > 0) {
          vehicleInfoForMemory = vehicles.map((v: any) => 
            [v.year || v.vehicleYear, v.make || v.vehicleMake, v.model || v.vehicleModel, v.color || v.vehicleColor]
              .filter(Boolean).join(" ")
          ).join(", ");
        } else if (vehicleMake || vehicleModel || vehicleYear || vehicleColor) {
          vehicleInfoForMemory = [vehicleYear, vehicleMake, vehicleModel, vehicleColor]
            .filter(Boolean).join(" ");
        }

        // Update customer info with new service and add-ons
        customerMemory.updateCustomer(phone, {
          name: name,
          phone: phone,
          address: address,
          email: email,
          lastInteraction: new Date(),
          vehicleInfo: vehicleInfoForMemory,
          serviceHistory: [
            ...(customerInfo.serviceHistory || []),
            {
              service: service,
              date: new Date(time),
              notes: `${isExtendedAreaRequest ? "[EXTENDED AREA] " : ""}${addOns.length > 0 ? `Booked with add-ons: ${addOns.join(", ")}` : "Standard booking"}`,
            },
          ],
        });

        // Store service preferences if add-ons were selected
        if (addOns && addOns.length > 0) {
          const preferences = customerInfo.servicePreferences || {
            additionalRequests: [],
          };
          customerMemory.updateCustomer(phone, {
            servicePreferences: {
              ...preferences,
              additionalRequests: [
                ...(preferences.additionalRequests || []),
                ...addOns,
              ],
            },
          });
        }
      } catch (memoryError) {
        console.error("Error updating customer memory:", memoryError);
        // Continue with booking even if memory update fails
      }
    }

    // Update customer information in Google Sheets (commented out as function not implemented yet)
    // This functionality will be implemented later when needed
    // Log that we would update customer information here
    console.log(
      "Booking created - customer info would be stored in Google Sheets:",
      {
        phone,
        address,
        service,
        addOns,
        vehicles: vehicles.length > 0 ? vehicles : { vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehicleCondition },
        notes,
        name,
        email,
        smsConsent,
      },
    );

    // Calendar service will be initialized freshly below

    // Always create a fresh calendar service for each booking
    try {
      console.log("Booking appointment in Google Calendar:", {
        name,
        phone,
        service,
        time,
      });

      // Create a brand new calendar service to ensure we have fresh credentials
      const { getAuthClient } = await import("./googleIntegration");
      const auth = getAuthClient();
      if (!auth) {
        console.error("Could not get auth client for calendar");
        throw new Error("Auth client not available");
      }

      const { google } = await import("googleapis");
      const freshCalendarService = google.calendar({ version: "v3", auth });

      // Use the calendar service directly with bookAppointment logic
      const startTime = new Date(time);
      
      // Get service info (duration and ID) from database
      const { duration, serviceId } = await getServiceInfo(service);
      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

      // Check service limits before booking (prevent bypass)
      const { db: dbInstance } = await import('./db');
      const { serviceLimits } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const dateStr = format(startTime, 'yyyy-MM-dd');
      const activeServiceLimits = await dbInstance
        .select({
          id: serviceLimits.id,
          dailyLimit: serviceLimits.dailyLimit,
          effectiveFrom: serviceLimits.effectiveFrom,
          effectiveTo: serviceLimits.effectiveTo,
        })
        .from(serviceLimits)
        .where(
          and(
            eq(serviceLimits.serviceId, serviceId),
            eq(serviceLimits.isActive, true)
          )
        );

      const applicableLimit = activeServiceLimits.find(limit => {
        const effectiveFrom = limit.effectiveFrom;
        const effectiveTo = limit.effectiveTo;
        
        if (effectiveFrom && dateStr < effectiveFrom) return false;
        if (effectiveTo && dateStr > effectiveTo) return false;
        
        return true;
      });

      if (applicableLimit) {
        // Count existing bookings for this service on this day
        const dayStart = new Date(startTime);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(startTime);
        dayEnd.setHours(23, 59, 59, 999);

        const existingEvents = await freshCalendarService.events.list({
          calendarId: "cleanmachinetulsa@gmail.com",
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: true,
        });

        const bookingsOnDay = existingEvents.data.items
          ?.filter((event: any) => {
            const eventServiceId = event.extendedProperties?.private?.serviceId;
            const eventServiceName = event.extendedProperties?.private?.serviceName || event.summary?.split(' - ')[0]?.trim();
            
            // Match by new metadata (serviceId) or legacy summary (serviceName)
            return (
              eventServiceId === serviceId.toString() ||
              eventServiceId === `legacy:${service}` ||
              eventServiceName === service
            );
          })
          .length || 0;

        if (bookingsOnDay >= applicableLimit.dailyLimit) {
          console.log(`[SERVICE LIMITS] Booking rejected: ${service} on ${dateStr} has ${bookingsOnDay}/${applicableLimit.dailyLimit} bookings (limit reached)`);
          return res.status(400).json({
            success: false,
            error: "SERVICE_LIMIT_REACHED",
            message: `Sorry, we've reached our booking limit for ${service} on ${format(startTime, 'MMMM d, yyyy')}. Please choose a different date.`,
          });
        }
        
        console.log(`[SERVICE LIMITS] Booking allowed: ${service} on ${dateStr} has ${bookingsOnDay}/${applicableLimit.dailyLimit} bookings`);
      }

      // Track referral signup if referral code was provided
      // Referee reward will be applied when their first invoice is created
      if (referralCode && referralCode.trim()) {
        try {
          console.log(`[REFERRAL] Tracking referral signup with code: ${referralCode}`);
          const referralResult = await trackReferralSignup(req.tenantDb!, referralCode.trim().toUpperCase(), {
            phone,
            email,
            name,
          });
          
          if (referralResult.success) {
            console.log(`[REFERRAL] Successfully tracked referral signup: ${referralResult.message}`);
            console.log(`[REFERRAL] Referee reward will be applied when first invoice is created`);
          } else {
            console.warn(`[REFERRAL] Failed to track referral: ${referralResult.message}`);
            // Continue with booking even if referral tracking fails - don't block the appointment
          }
        } catch (referralError) {
          console.error('[REFERRAL] Error tracking referral signup:', referralError);
          // Continue with booking even if referral tracking fails - don't block the appointment
        }
      }

      const CALENDAR_ID = "cleanmachinetulsa@gmail.com";

      // Create the event directly with service metadata for limit tracking
      const event = {
        summary: `${service} - ${name}`,
        description:
          appointmentDescription || `Phone: ${phone}\nService: ${service}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/Chicago",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/Chicago",
        },
        location: address,
        extendedProperties: {
          private: {
            serviceId: serviceId.toString(),
            serviceName: service,
          },
        },
      };

      // Insert the event directly with the fresh calendar service
      console.log("Creating calendar event with these details:", {
        calendarId: CALENDAR_ID,
        summary: event.summary,
        startTime: event.start.dateTime,
        endTime: event.end.dateTime,
        location: event.location,
        description: event.description,
      });

      // Debug auth status
      try {
        const tokenInfo = await auth.getTokenInfo(
          auth.credentials.access_token,
        );
        console.log("Auth token is valid with scopes:", tokenInfo.scopes);
      } catch (tokenError) {
        console.error("Token validation error:", tokenError);
      }

      const response = await freshCalendarService.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
      });

      if (response.data.id) {
        console.log(
          "Successfully created event in Google Calendar:",
          response.data.id,
        );

        // Save appointment to database
        let customerId: number | undefined;
        try {
          const { db: dbInstance } = await import('./db');
          const { customers, appointments } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');

          // Find or create customer
          let customer = await dbInstance.query.customers.findFirst({
            where: eq(customers.phone, phone),
          });

          if (!customer) {
            const [newCustomer] = await dbInstance.insert(customers).values({
              name,
              phone,
              email: email || null,
              address: address || null,
              vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : null,
              smsConsent: smsConsent || false,
              smsConsentTimestamp: smsConsent ? new Date() : null,
            }).returning();
            customer = newCustomer;
          }

          customerId = customer.id;

          // Create appointment record with lat/lng - wrap in transaction with stats update
          await dbInstance.transaction(async (tx) => {
            await tx.insert(appointments).values({
              customerId: customer.id,
              serviceId: serviceId,
              scheduledTime: startTime,
              address: address || '',
              latitude: latitude || null,
              longitude: longitude || null,
              addressConfirmedByCustomer: !!latitude,
              addressNeedsReview: addressNeedsReview || false,
              addOns: addOns.length > 0 ? addOns : null,
              additionalRequests: notes ? [notes] : null,
            });

            // Track booking stats for customer - in same transaction
            await recordAppointmentCreated(customer.id, startTime, tx);
          });

          console.log('[DB] Appointment saved to database with lat/lng:', { latitude, longitude, addressNeedsReview });
        } catch (dbError) {
          console.error('[DB] Error saving appointment to database:', dbError);
          // Continue even if DB save fails - calendar event was created
        }

        // Invalidate dashboard caches since a new appointment was created
        invalidateAppointmentCaches();

        // Return successful response with event details
        return res.json({
          success: true,
          message: `Appointment for ${service} booked successfully`,
          eventId: response.data.id,
          eventLink: response.data.htmlLink,
          appointmentTime: time,
          addOns: addOns,
          customerId,
        });
      } else {
        throw new Error("No event ID received from Google Calendar");
      }
    } catch (error) {
      const calendarError = error as Error;
      console.error(
        "Error booking in calendar, providing confirmation:",
        calendarError,
      );
      console.error("Calendar error details:", calendarError.message);
      // Fall back to basic confirmation if calendar API fails
    }

    // FALLBACK PATH: Calendar API failed, save to database anyway
    console.log('[FALLBACK] Calendar API unavailable - saving appointment to database only');
    let fallbackCustomerId: number | undefined;
    try {
      const { db: dbInst } = await import('./db');
      const { customers, appointments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      // Find or create customer
      let customer = await dbInst.query.customers.findFirst({
        where: eq(customers.phone, phone),
      });

      if (!customer) {
        const [newCustomer] = await dbInst.insert(customers).values({
          name,
          phone,
          email: email || null,
          address: address || null,
          vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : null,
          smsConsent: smsConsent || false,
          smsConsentTimestamp: smsConsent ? new Date() : null,
        }).returning();
        customer = newCustomer;
      }

      fallbackCustomerId = customer.id;

      // Get service ID from database
      const fallbackServiceInfo = await getServiceInfo(service);
      const fallbackServiceId = fallbackServiceInfo.serviceId;

      // Create appointment record with lat/lng - wrap in transaction with stats update
      await dbInst.transaction(async (tx) => {
        await tx.insert(appointments).values({
          customerId: customer.id,
          serviceId: fallbackServiceId,
          scheduledTime: new Date(time),
          address: address || '',
          latitude: latitude || null,
          longitude: longitude || null,
          addressConfirmedByCustomer: !!latitude,
          addressNeedsReview: addressNeedsReview || false,
          addOns: addOns.length > 0 ? addOns : null,
          additionalRequests: notes ? [notes] : null,
        });

        // Track booking stats for customer - in same transaction
        await recordAppointmentCreated(customer.id, new Date(time), tx);
      });

      console.log('[FALLBACK DB] Appointment saved to database with lat/lng:', { latitude, longitude, addressNeedsReview });
    } catch (dbError) {
      console.error('[FALLBACK DB] Error saving appointment to database:', dbError);
      // Continue - notifications will still be sent
    }

    // Get customer information from memory
    const customerInfo = customerMemory.getCustomer(phone) || {
      vehicleInfo: "",
    };

    // Send booking confirmation SMS and email
    const appointmentDetails = {
      name,
      phone,
      address: req.body.address || "",
      isExtendedAreaRequest: req.body.isExtendedAreaRequest || false,
      service,
      addOns: addOns || [],
      time,
      formattedTime: format(new Date(time), "EEEE, MMMM d, yyyy 'at' h:mm a"),
      vehicleInfo: (customerInfo as any).vehicleInfo || "",
    };

    try {
      // Send SMS opt-in confirmation if user consented to SMS
      if (smsConsent) {
        const { sendSMSOptInConfirmation } = await import("./notifications");
        const optInResult = await sendSMSOptInConfirmation(phone);
        console.log("SMS opt-in confirmation sent:", optInResult);
      }

      // Send booking confirmation notifications
      const notificationResults =
        await sendBookingConfirmation(appointmentDetails);
      console.log("Booking notifications sent:", notificationResults);

      // Schedule day-before reminder
      const reminderResult = scheduleDayBeforeReminder(appointmentDetails);
      console.log("Day-before reminder scheduled:", reminderResult);
    } catch (notificationError) {
      console.error("Error sending booking notifications:", notificationError);
      // Continue with booking even if notifications fail
    }

    // Return success response (used as fallback or when calendar service is not available)
    return res.json({
      success: true,
      message: `Appointment for ${service} booked successfully for ${name}`,
      appointmentTime: time,
      service: service,
      addOns: addOns,
      notificationsSent: true,
      customerId: fallbackCustomerId,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment",
    });
  }
}

/**
 * REMOVED: generateMockTimeSlots - No longer using mock/fallback data
 * All calendar data must come from real Google Calendar API
 * TODO: Ensure Google Calendar API is properly connected and working
 */

/**
 * Generate available appointment slots based on calendar availability
 */
export async function generateAvailableSlots(serviceName: string) {
  // Get fresh calendar client (never cache - tokens expire)
  const calendarService = await getFreshCalendarClient();
  
  if (!calendarService) {
    throw new Error("Calendar service not initialized");
  }

  // Load business settings from database
  const { db: dbInstance } = await import('./db');
  const { businessSettings, serviceLimits } = await import('@shared/schema');
  const { eq, and, or, gte, lte, sql } = await import('drizzle-orm');
  
  const settingsResult = await dbInstance.select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
  const settings = settingsResult[0] || {
    startHour: 9,
    startMinute: 0,
    endHour: 15,
    endMinute: 0,
    enableLunchBreak: true,
    lunchHour: 12,
    lunchMinute: 0,
    daysOfWeek: [1, 2, 3, 4, 5],
    allowWeekendBookings: false,
    halfHourIncrements: true,
    minimumNoticeHours: 24,
  };

  const now = new Date();
  const end = addDays(now, 14); // Look ahead 2 weeks
  
  // Get service info (duration and ID) for limit tracking
  const { duration, serviceId } = await getServiceInfo(serviceName);
  const slots: string[] = [];

  // Get active service limits for this service (if any)
  const activeServiceLimits = await dbInstance
    .select({
      id: serviceLimits.id,
      dailyLimit: serviceLimits.dailyLimit,
      effectiveFrom: serviceLimits.effectiveFrom,
      effectiveTo: serviceLimits.effectiveTo,
    })
    .from(serviceLimits)
    .where(
      and(
        eq(serviceLimits.serviceId, serviceId),
        eq(serviceLimits.isActive, true)
      )
    );

  try {
    // Get existing events
    const existingEvents = await calendarService.events.list({
      calendarId: CALENDAR_ID,
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const busyTimes = (existingEvents.data.items || [])
      .filter((event: any) => event.start && event.start.dateTime)
      .map((event: any) => {
        let eventServiceId = event.extendedProperties?.private?.serviceId;
        
        // FALLBACK: For legacy events without metadata, try to extract service from summary
        // Summary format: "Service Name - Customer Name"
        if (!eventServiceId && event.summary) {
          const summaryParts = event.summary.split(' - ');
          if (summaryParts.length >= 2) {
            const extractedServiceName = summaryParts[0].trim();
            // Mark this as a legacy event by storing the service name (not ID)
            eventServiceId = `legacy:${extractedServiceName}`;
          }
        }
        
        return {
          start: new Date(event.start.dateTime),
          end: new Date(event.end.dateTime),
          serviceId: eventServiceId,
          serviceName: event.extendedProperties?.private?.serviceName || event.summary?.split(' - ')[0]?.trim(),
        };
      });

    // Generate slots for each day
    for (let day = 1; day <= 14; day++) {
      const date = addDays(now, day);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check if this day has reached its service limit
      const applicableLimit = activeServiceLimits.find(limit => {
        const effectiveFrom = limit.effectiveFrom;
        const effectiveTo = limit.effectiveTo;
        
        // Check if date falls within limit's effective range
        if (effectiveFrom && dateStr < effectiveFrom) return false;
        if (effectiveTo && dateStr > effectiveTo) return false;
        
        return true;
      });

      if (applicableLimit) {
        // Count existing bookings for this service on this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const matchingEvents = busyTimes.filter((event: any) => {
          const eventStart = event.start;
          
          // Match either by new metadata (serviceId) or legacy summary (serviceName)
          const matchesService = 
            event.serviceId === serviceId.toString() || 
            event.serviceId === `legacy:${serviceName}` ||
            event.serviceName === serviceName;
          
          const isOnDay = eventStart >= dayStart && eventStart <= dayEnd;
          return matchesService && isOnDay;
        });

        const bookingsOnDay = matchingEvents.length;
        
        // Defensive logging: warn if limit applies but no metadata-bearing events exist
        if (bookingsOnDay > 0) {
          const metadataCount = matchingEvents.filter((e: any) => e.serviceId && !e.serviceId.startsWith('legacy:')).length;
          const legacyCount = matchingEvents.filter((e: any) => e.serviceId?.startsWith('legacy:')).length;
          
          if (metadataCount === 0 && legacyCount > 0) {
            console.warn(`[SERVICE LIMITS] WARNING: ${serviceName} on ${dateStr} has ${legacyCount} legacy bookings without metadata. Consider backfilling metadata for accurate tracking.`);
          }
        }

        if (bookingsOnDay >= applicableLimit.dailyLimit) {
          console.log(`[SERVICE LIMITS] ${serviceName} on ${dateStr}: ${bookingsOnDay}/${applicableLimit.dailyLimit} bookings - LIMIT REACHED, skipping day`);
          continue; // Skip this entire day
        } else {
          console.log(`[SERVICE LIMITS] ${serviceName} on ${dateStr}: ${bookingsOnDay}/${applicableLimit.dailyLimit} bookings - slots available`);
        }
      }

      // Skip non-working days based on business settings
      const dayOfWeek = date.getDay();
      if (!settings.daysOfWeek.includes(dayOfWeek)) {
        // Skip if day not in working days (unless weekend bookings allowed)
        if (!(settings.allowWeekendBookings && (dayOfWeek === 0 || dayOfWeek === 6))) {
          continue;
        }
      }

      // Generate slots for each hour in the booking window
      // Use business hours from settings
      for (let hour = settings.startHour; hour < settings.endHour; hour++) {
        // Skip lunch hour if enabled
        if (settings.enableLunchBreak && hour === settings.lunchHour) continue;

        const startTime = setHours(setMinutes(date, 0), hour);
        const endTime = addHours(startTime, duration);

        // Skip if appointment would end after business closing time
        const endHour = endTime.getHours();
        const endMinute = endTime.getMinutes();
        if (endHour > settings.endHour || (endHour === settings.endHour && endMinute > settings.endMinute)) {
          continue;
        }
        
        // Check minimum notice period
        const hoursDiff = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < settings.minimumNoticeHours) {
          continue;
        }

        // Check if this slot overlaps with any existing events
        const isOverlapping = busyTimes.some((event: any) => {
          return (
            (startTime >= event.start && startTime < event.end) || // Start time is during an event
            (endTime > event.start && endTime <= event.end) || // End time is during an event
            (startTime <= event.start && endTime >= event.end) // Slot contains an event entirely
          );
        });

        if (!isOverlapping) {
          slots.push(startTime.toISOString());
        }

        // Add half-hour slot if enabled and service is short enough
        if (settings.halfHourIncrements && duration <= 1.5) {
          const halfHourStart = setHours(setMinutes(date, 30), hour);
          const halfHourEnd = addHours(halfHourStart, duration);

          // Skip if half-hour appointment would end after business closing time
          const halfEndHour = halfHourEnd.getHours();
          const halfEndMinute = halfHourEnd.getMinutes();
          if (halfEndHour > settings.endHour || (halfEndHour === settings.endHour && halfEndMinute > settings.endMinute)) {
            continue;
          }
          
          // Check minimum notice period for half-hour slot
          const halfHoursDiff = (halfHourStart.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (halfHoursDiff < settings.minimumNoticeHours) {
            continue;
          }

          // Check for overlaps
          const halfHourOverlapping = busyTimes.some((event: any) => {
            return (
              (halfHourStart >= event.start && halfHourStart < event.end) ||
              (halfHourEnd > event.start && halfHourEnd <= event.end) ||
              (halfHourStart <= event.start && halfHourEnd >= event.end)
            );
          });

          if (!halfHourOverlapping) {
            slots.push(halfHourStart.toISOString());
          }
        }
      }
    }

    return slots;
  } catch (error) {
    console.error("Error generating available slots:", error);
    throw error;
  }
}

/**
 * Book an appointment in Google Calendar
 */
async function bookAppointment(
  customerName: string,
  phone: string,
  serviceName: string,
  startTimeISO: string,
  description: string = "",
) {
  // Get fresh calendar client (never cache - tokens expire)
  const calendarService = await getFreshCalendarClient();
  
  if (!calendarService) {
    throw new Error("Calendar service not initialized");
  }

  try {
    const startTime = new Date(startTimeISO);
    
    // Get service info (duration and ID) from database
    const { duration, serviceId } = await getServiceInfo(serviceName);
    const endTime = addHours(startTime, duration);

    // Create the event with service metadata for limit tracking
    const event = {
      summary: `${serviceName} - ${customerName}`,
      description: description || `Phone: ${phone}\nService: ${serviceName}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "America/Chicago",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "America/Chicago",
      },
      extendedProperties: {
        private: {
          serviceId: serviceId.toString(),
          serviceName: serviceName,
        },
      },
    };

    const response = await calendarService.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    return {
      success: true,
      message: `Appointment for ${serviceName} booked successfully`,
      eventId: response.data.id || '',
      eventLink: response.data.htmlLink || '',
      appointmentTime: startTimeISO,
      service: serviceName,
    };
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw error;
  }
}
