import { Express, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { appointments, customers, loyaltyPoints, humanEscalationRequests } from '@shared/schema';
import { getEnhancedCustomerServiceHistory } from './enhancedCustomerSearch';
import { recordAppointmentCreated } from './customerBookingStats';
import { getRefereeRewardDescriptor } from './referralConfigService';
import { validateReferralCode } from './referralService';

/**
 * Register Quick Booking routes for returning customers
 */
export function registerQuickBookingRoutes(app: Express) {
  /**
   * Lookup customer by phone or email and return complete booking history
   * GET /api/quick-booking/lookup?contact=<phone or email>
   */
  app.get('/api/quick-booking/lookup', async (req: Request, res: Response) => {
    try {
      const { contact } = req.query;
      
      if (!contact || typeof contact !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Please provide a phone number or email address'
        });
      }
      
      console.log(`[Quick Booking] Looking up customer: ${contact}`);
      
      // Normalize phone number for searching (remove all non-digits)
      const normalizedContact = contact.replace(/\D/g, '');
      const isPhone = normalizedContact.length >= 10;
      
      // For phone lookups, try multiple formats to increase match rate
      const phoneVariants = isPhone ? [
        contact, // Original format
        normalizedContact, // Digits only
        `+1${normalizedContact}`, // E.164 format
        `(${normalizedContact.slice(0,3)}) ${normalizedContact.slice(3,6)}-${normalizedContact.slice(6)}`, // Formatted
      ] : [];
      
      // Try to find customer in PostgreSQL database
      let customer;
      if (isPhone) {
        // Try multiple phone formats to find customer
        for (const phoneVariant of phoneVariants) {
          customer = await req.tenantDb!.query.customers.findFirst({
            where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, phoneVariant)),
          });
          if (customer) {
            console.log(`[Quick Booking] Found customer with phone variant: ${phoneVariant}`);
            break;
          }
        }
      } else {
        // Search by email (case-insensitive would be better, but this works for now)
        customer = await req.tenantDb!.query.customers.findFirst({
          where: req.tenantDb!.withTenantFilter(customers, eq(customers.email, contact.toLowerCase())),
        });
      }
      
      // Get customer info from Google Sheets (for legacy data)
      let googleSheetsData;
      if (isPhone) {
        googleSheetsData = await getEnhancedCustomerServiceHistory(contact);
      }
      
      // If no customer found in either source, return not found
      if (!customer && (!googleSheetsData || !googleSheetsData.found)) {
        return res.json({
          success: false,
          found: false,
          message: 'No booking history found. You can book as a new customer!'
        });
      }
      
      // Get loyalty points if customer exists
      let customerLoyaltyPoints = 0;
      if (customer) {
        const loyaltyRecord = await req.tenantDb!.query.loyaltyPoints.findFirst({
          where: req.tenantDb!.withTenantFilter(loyaltyPoints, eq(loyaltyPoints.customerId, customer.id)),
        });
        customerLoyaltyPoints = loyaltyRecord?.points || 0;
      }
      
      // Get last appointment from database
      let lastAppointment;
      if (customer) {
        lastAppointment = await req.tenantDb!.query.appointments.findFirst({
          where: req.tenantDb!.withTenantFilter(appointments, eq(appointments.customerId, customer.id)),
          orderBy: [desc(appointments.scheduledTime)],
          with: {
            service: true,
          },
        });
      }
      
      // Combine data from all sources
      const customerData = {
        found: true,
        // Customer info (prefer database, fallback to Google Sheets)
        name: customer?.name || googleSheetsData?.name || '',
        phone: customer?.phone || contact,
        email: customer?.email || googleSheetsData?.email || '',
        address: customer?.address || googleSheetsData?.address || '',
        
        // Loyalty info
        loyaltyPoints: customerLoyaltyPoints || (googleSheetsData?.loyaltyPoints ? parseInt(googleSheetsData.loyaltyPoints) : 0),
        
        // Last appointment info
        lastAppointment: lastAppointment ? {
          id: lastAppointment.id,
          service: lastAppointment.service?.name || '',
          serviceId: lastAppointment.serviceId,
          scheduledTime: lastAppointment.scheduledTime,
          address: lastAppointment.address,
          addOns: lastAppointment.addOns || [],
          additionalRequests: lastAppointment.additionalRequests,
        } : null,
        
        // Vehicle info from customer record or Google Sheets
        vehicleInfo: customer?.vehicleInfo || googleSheetsData?.vehicleInfo || '',
        photoFolder: googleSheetsData?.photoFolder || '',
      };
      
      console.log(`[Quick Booking] Customer found:`, {
        name: customerData.name,
        hasLastAppointment: !!lastAppointment,
        loyaltyPoints: customerData.loyaltyPoints
      });
      
      return res.json({
        success: true,
        customer: customerData
      });
      
    } catch (error) {
      console.error('[Quick Booking] Lookup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error looking up customer information'
      });
    }
  });
  
  /**
   * Submit quick booking with pre-filled data
   * POST /api/quick-booking/submit
   * SP-BOOKING-ADDRESS+PRICING-FIX: Now handles extended areas and referral discounts
   */
  app.post('/api/quick-booking/submit', async (req: Request, res: Response) => {
    try {
      const {
        name,
        phone,
        email,
        address,
        service,
        serviceId,
        addOns,
        vehicles,
        scheduledTime,
        notes,
        smsConsent,
        referralCode,
        // SP-BOOKING-ADDRESS+PRICING-FIX: Extended area and pricing fields
        isExtendedArea,
        extendedTravelMinutes,
        originalSubtotalCents,
        discountAmountCents,
        finalTotalCents,
      } = req.body;
      
      console.log(`[Quick Booking] Submitting booking for ${name}`, { 
        referralCode: referralCode || 'none',
        isExtendedArea: isExtendedArea || false,
        extendedTravelMinutes: extendedTravelMinutes || null,
      });
      
      // Validate required fields
      if (!name || !phone || !service || !scheduledTime) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // SP-BOOKING-ADDRESS+PRICING-FIX: Validate and calculate discount if referral code provided
      let validatedDiscountCents = 0;
      let appliedDiscountCode: string | null = null;
      
      if (referralCode && typeof referralCode === 'string') {
        try {
          const normalizedCode = referralCode.trim().toUpperCase();
          const validation = await validateReferralCode(req.tenantDb!, normalizedCode);
          
          if (validation.valid) {
            // Get referee reward to calculate discount
            const refereeReward = await getRefereeRewardDescriptor(req.tenantDb!);
            
            if (refereeReward) {
              // Calculate discount based on reward type
              if (refereeReward.type === 'FIXED_AMOUNT' && refereeReward.amount > 0) {
                validatedDiscountCents = Math.round(refereeReward.amount * 100);
              } else if (refereeReward.type === 'PERCENT' && refereeReward.amount > 0 && originalSubtotalCents) {
                validatedDiscountCents = Math.round(originalSubtotalCents * (refereeReward.amount / 100));
              }
              
              appliedDiscountCode = normalizedCode;
              console.log(`[Quick Booking] Discount applied: ${validatedDiscountCents} cents from code ${normalizedCode}`);
            }
            
            // Track referral signup
            const { trackReferralSignup } = await import('./referralService');
            await trackReferralSignup(normalizedCode, {
              phone: phone,
              email: email || undefined,
              name: name,
            });
            console.log(`[Quick Booking] Referral signup tracked successfully`);
          }
        } catch (referralError) {
          console.error('[Quick Booking] Failed to process referral code (non-blocking):', referralError);
        }
      }
      
      // Find or create customer
      let customer = await req.tenantDb!.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, phone)),
      });
      
      if (!customer) {
        // Create new customer
        const [newCustomer] = await req.tenantDb!.insert(customers).values({
          name,
          phone,
          email: email || null,
          address: address || null,
          vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : null,
        }).returning();
        customer = newCustomer;
      } else {
        // Update existing customer info if changed
        await req.tenantDb!.update(customers)
          .set({
            name,
            email: email || customer.email,
            address: address || customer.address,
            vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : customer.vehicleInfo,
          })
          .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, customer.id)));
      }
      
      // SP-BOOKING-ADDRESS+PRICING-FIX: Validate pricing data
      // Only save pricing fields if they're valid integers
      const safeOriginalSubtotalCents = typeof originalSubtotalCents === 'number' && originalSubtotalCents >= 0 
        ? Math.round(originalSubtotalCents) : null;
      const safeDiscountAmountCents = validatedDiscountCents > 0 
        ? validatedDiscountCents 
        : (typeof discountAmountCents === 'number' && discountAmountCents >= 0 ? Math.round(discountAmountCents) : 0);
      const safeFinalTotalCents = typeof finalTotalCents === 'number' && finalTotalCents >= 0 
        ? Math.round(finalTotalCents) 
        : (safeOriginalSubtotalCents !== null ? Math.max(0, safeOriginalSubtotalCents - safeDiscountAmountCents) : null);
      
      // Create appointment - wrap in transaction with stats update
      let appointment: any;
      await req.tenantDb!.transaction(async (tx) => {
        const [newAppointment] = await tx.insert(appointments).values({
          customerId: customer.id,
          serviceId: serviceId || 1, // Default to service ID 1 if not provided
          scheduledTime: new Date(scheduledTime),
          address: address || '',
          latitude: req.body.latitude || null,
          longitude: req.body.longitude || null,
          addressConfirmedByCustomer: req.body.addressConfirmedByCustomer || false,
          addressNeedsReview: req.body.addressNeedsReview || false,
          addOns: addOns || null,
          additionalRequests: notes ? [notes] : null,
          // SP-BOOKING-ADDRESS+PRICING-FIX: Extended area tracking (validated)
          isExtendedArea: isExtendedArea === true,
          extendedTravelMinutes: typeof extendedTravelMinutes === 'number' ? Math.round(extendedTravelMinutes) : null,
          // SP-BOOKING-ADDRESS+PRICING-FIX: Discount tracking (validated)
          discountCodeApplied: appliedDiscountCode,
          originalSubtotalCents: safeOriginalSubtotalCents,
          discountAmountCents: safeDiscountAmountCents,
          finalTotalCents: safeFinalTotalCents,
        }).returning();
        
        appointment = newAppointment;
        
        // Track booking stats for customer - in same transaction
        await recordAppointmentCreated(customer.id, new Date(scheduledTime), tx);
      });
      
      // SP-BOOKING-ADDRESS+PRICING-FIX: Create escalation for extended area bookings
      // Only create escalation if isExtendedArea is explicitly true and has valid travel time
      if (isExtendedArea === true && typeof extendedTravelMinutes === 'number' && extendedTravelMinutes > 0) {
        try {
          // Find or create a conversation for this customer to link escalation
          const { conversations } = await import('@shared/schema');
          let conversation = await req.tenantDb!.query.conversations.findFirst({
            where: req.tenantDb!.withTenantFilter(conversations, eq(conversations.customerPhone, phone)),
          });
          
          if (conversation) {
            await req.tenantDb!.insert(humanEscalationRequests).values({
              conversationId: conversation.id,
              reason: `Extended service area booking - ${extendedTravelMinutes} minute travel time`,
              triggerMessage: `Customer ${name} booked at address: ${address}`,
              status: 'pending',
              metadata: {
                type: 'EXTENDED_SERVICE_AREA',
                bookingId: appointment.id,
                address: address,
                travelMinutes: extendedTravelMinutes,
                customerId: customer.id,
                scheduledTime: scheduledTime,
              },
            });
            console.log(`[Quick Booking] Created escalation for extended area booking ${appointment.id}`);
          } else {
            console.warn(`[Quick Booking] No conversation found for customer ${phone}, skipping escalation`);
          }
        } catch (escalationError) {
          console.error('[Quick Booking] Failed to create escalation (non-blocking):', escalationError);
        }
      } else if (isExtendedArea) {
        console.warn(`[Quick Booking] Extended area flag set but missing valid travel time: ${extendedTravelMinutes}`);
      }
      
      console.log(`[Quick Booking] Appointment created:`, {
        appointmentId: appointment.id,
        customerId: customer.id,
        service,
        isExtendedArea: isExtendedArea || false,
        discountApplied: validatedDiscountCents > 0,
      });
      
      return res.json({
        success: true,
        appointment: {
          id: appointment.id,
          customerName: name,
          service,
          scheduledTime: appointment.scheduledTime,
          isExtendedArea: isExtendedArea || false,
          discountAmountCents: validatedDiscountCents,
          discountCodeApplied: appliedDiscountCode,
        },
        message: isExtendedArea 
          ? 'Appointment booked! This request is outside our regular service area and may require manual approval.'
          : 'Appointment booked successfully!'
      });
      
    } catch (error) {
      console.error('[Quick Booking] Submit error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error booking appointment'
      });
    }
  });
}
