import { Express, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from './db';
import { appointments, customers, loyaltyPoints } from '@shared/schema';
import { getEnhancedCustomerServiceHistory } from './enhancedCustomerSearch';

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
          customer = await db.query.customers.findFirst({
            where: eq(customers.phone, phoneVariant),
          });
          if (customer) {
            console.log(`[Quick Booking] Found customer with phone variant: ${phoneVariant}`);
            break;
          }
        }
      } else {
        // Search by email (case-insensitive would be better, but this works for now)
        customer = await db.query.customers.findFirst({
          where: eq(customers.email, contact.toLowerCase()),
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
        const loyaltyRecord = await db.query.loyaltyPoints.findFirst({
          where: eq(loyaltyPoints.customerId, customer.id),
        });
        customerLoyaltyPoints = loyaltyRecord?.points || 0;
      }
      
      // Get last appointment from database
      let lastAppointment;
      if (customer) {
        lastAppointment = await db.query.appointments.findFirst({
          where: eq(appointments.customerId, customer.id),
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
          service: lastAppointment.service?.[0]?.name || '',
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
      } = req.body;
      
      console.log(`[Quick Booking] Submitting booking for ${name}`);
      
      // Validate required fields
      if (!name || !phone || !service || !scheduledTime) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Find or create customer
      let customer = await db.query.customers.findFirst({
        where: eq(customers.phone, phone),
      });
      
      if (!customer) {
        // Create new customer
        const [newCustomer] = await db.insert(customers).values({
          name,
          phone,
          email: email || null,
          address: address || null,
          vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : null,
        }).returning();
        customer = newCustomer;
      } else {
        // Update existing customer info if changed
        await db.update(customers)
          .set({
            name,
            email: email || customer.email,
            address: address || customer.address,
            vehicleInfo: vehicles && vehicles.length > 0 ? JSON.stringify(vehicles) : customer.vehicleInfo,
          })
          .where(eq(customers.id, customer.id));
      }
      
      // Create appointment - serviceId cannot be null in schema
      const [appointment] = await db.insert(appointments).values({
        customerId: customer.id,
        serviceId: serviceId || 1, // Default to service ID 1 if not provided
        scheduledTime: new Date(scheduledTime),
        address: address || '',
        addOns: addOns || null,
        additionalRequests: notes ? [notes] : null,
      }).returning();
      
      console.log(`[Quick Booking] Appointment created:`, {
        appointmentId: appointment.id,
        customerId: customer.id,
        service
      });
      
      return res.json({
        success: true,
        appointment: {
          id: appointment.id,
          customerName: name,
          service,
          scheduledTime: appointment.scheduledTime,
        },
        message: 'Appointment booked successfully!'
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
