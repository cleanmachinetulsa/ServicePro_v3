import { Router } from 'express';
import { appointments, conversations, services, customers } from '@shared/schema';
import { eq, and, lte, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { recordAppointmentCreated } from './customerBookingStats';
import { syncAppointmentToCalendar } from './calendarApi';
import { sendPushToAllUsers } from './pushNotificationService';
import { invalidateAppointmentCaches } from './cacheService';

const router = Router();

/**
 * Get appointment details for a conversation
 * GET /api/conversations/:conversationId/appointment
 */
router.get('/conversations/:conversationId/appointment', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    
    // Get conversation
    const conversation = await req.tenantDb!.query.conversations.findFirst({
      where: req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)),
    });
    
    if (!conversation || !conversation.appointmentId) {
      return res.json({ success: true, appointment: null });
    }
    
    // Get appointment
    const [appointment] = await req.tenantDb!.select()
      .from(appointments)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, conversation.appointmentId)));
    
    if (!appointment) {
      return res.json({ success: true, appointment: null });
    }
    
    // Get service details
    const [service] = await req.tenantDb!.select()
      .from(services)
      .where(req.tenantDb!.withTenantFilter(services, eq(services.id, appointment.serviceId)));
    
    // Get customer details
    const [customer] = await req.tenantDb!.select()
      .from(customers)
      .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, appointment.customerId)));
    
    res.json({ 
      success: true, 
      appointment: {
        ...appointment,
        service,
        customer,
      }
    });
  } catch (error) {
    console.error('[GET appointment] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch appointment' });
  }
});

/**
 * Create or update appointment for a conversation
 * POST /api/conversations/:conversationId/appointment
 */
router.post('/conversations/:conversationId/appointment', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    
    // Validate request body
    const schema = z.object({
      customerId: z.number(),
      serviceId: z.number(),
      scheduledTime: z.string().transform(str => new Date(str)),
      address: z.string(),
      addressLat: z.number().nullable().optional(),
      addressLng: z.number().nullable().optional(),
      additionalRequests: z.array(z.string()).optional(),
      addOns: z.any().optional(),
      requiresManualApproval: z.boolean().optional(),
    });
    
    const data = schema.parse(req.body);
    
    // Get conversation to check if appointment already exists
    const conversation = await req.tenantDb!.query.conversations.findFirst({
      where: req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)),
    });
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    let appointmentId: number;
    
    if (conversation.appointmentId) {
      // Update existing appointment
      await req.tenantDb!.update(appointments)
        .set({
          serviceId: data.serviceId,
          scheduledTime: data.scheduledTime,
          address: data.address,
          addressLat: data.addressLat ?? null,
          addressLng: data.addressLng ?? null,
          additionalRequests: data.additionalRequests,
          addOns: data.addOns,
        })
        .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, conversation.appointmentId)));
      
      appointmentId = conversation.appointmentId;
    } else {
      // Create new appointment - wrap in transaction with stats update
      await req.tenantDb!.transaction(async (tx) => {
        const [newAppointment] = await tx.insert(appointments)
          .values({
            customerId: data.customerId,
            serviceId: data.serviceId,
            scheduledTime: data.scheduledTime,
            address: data.address,
            addressLat: data.addressLat ?? null,
            addressLng: data.addressLng ?? null,
            additionalRequests: data.additionalRequests,
            addOns: data.addOns,
          })
          .returning();
        
        appointmentId = newAppointment.id;
        
        // Track booking stats for customer - in same transaction
        await recordAppointmentCreated(data.customerId, data.scheduledTime, tx);
        
        // Link appointment to conversation - in same transaction
        await tx.update(conversations)
          .set({ appointmentId })
          .where(eq(conversations.id, conversationId));
      });
    }
    
    // Update behaviorSettings.booking on every save to track manual approval status
    // This ensures the flag is cleared when subsequent standard bookings are made
    const existingSettings = (conversation.behaviorSettings as Record<string, any>) || {};
    await req.tenantDb!.update(conversations)
      .set({
        behaviorSettings: {
          ...existingSettings,
          booking: {
            ...(existingSettings.booking || {}),
            requiresManualApproval: data.requiresManualApproval || false,
            inServiceArea: data.requiresManualApproval ? false : true,
          },
        },
      })
      .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)));
    
    // Fetch updated appointment
    const [appointment] = await req.tenantDb!.select()
      .from(appointments)
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)));
    
    // Get service details
    const [service] = await req.tenantDb!.select()
      .from(services)
      .where(req.tenantDb!.withTenantFilter(services, eq(services.id, appointment.serviceId)));
    
    // Get customer details
    const [customer] = await req.tenantDb!.select()
      .from(customers)
      .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, appointment.customerId)));
    
    // CRITICAL FIX: Sync appointment to Google Calendar
    try {
      if (!conversation.appointmentId) {
        // Only sync new appointments (not updates) to Google Calendar
        const calendarResult = await syncAppointmentToCalendar(
          customer.name || 'Customer',
          customer.phone || '',
          service.name || 'Service',
          data.scheduledTime.toISOString(),
          `Address: ${data.address || 'TBD'}\nPhone: ${customer.phone || 'N/A'}`
        );
        if (calendarResult && calendarResult.eventId) {
          console.log('[APPOINTMENT] Synced to Google Calendar:', calendarResult.eventId);
        } else {
          console.log('[APPOINTMENT] Calendar sync completed (no event ID returned)');
        }
      }
    } catch (calendarError) {
      console.error('[APPOINTMENT] Failed to sync to Google Calendar (continuing):', calendarError);
      // Don't fail the request - appointment is saved to DB
    }
    
    // CRITICAL FIX: Send push notification for new bookings
    try {
      if (!conversation.appointmentId) {
        // Only notify for new appointments
        const formattedDate = new Date(data.scheduledTime).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        
        await sendPushToAllUsers({
          title: '📅 New Appointment Booked!',
          body: `${customer.name || 'Customer'} - ${service.name} on ${formattedDate}`,
          tag: `new-appointment-${appointmentId}`,
          requireInteraction: true,
          data: {
            type: 'new_booking',
            appointmentId: appointmentId.toString(),
            url: '/messages',
          },
          actions: [
            { action: 'view', title: 'View' },
          ],
        });
        console.log('[APPOINTMENT] Push notification sent for new booking');
      }
    } catch (pushError) {
      console.error('[APPOINTMENT] Failed to send push notification (continuing):', pushError);
    }
    
    // Invalidate dashboard caches
    try {
      invalidateAppointmentCaches();
    } catch (cacheError) {
      console.error('[APPOINTMENT] Failed to invalidate caches:', cacheError);
    }
    
    res.json({ 
      success: true, 
      appointment: {
        ...appointment,
        service,
        customer,
      }
    });
  } catch (error) {
    console.error('[POST appointment] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to save appointment' });
  }
});

/**
 * Delete appointment from conversation
 * DELETE /api/conversations/:conversationId/appointment
 */
router.delete('/conversations/:conversationId/appointment', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    
    // Get conversation
    const conversation = await req.tenantDb!.query.conversations.findFirst({
      where: req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)),
    });
    
    if (!conversation || !conversation.appointmentId) {
      return res.json({ success: true });
    }
    
    // Remove appointment reference from conversation
    await req.tenantDb!.update(conversations)
      .set({ appointmentId: null })
      .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)));
    
    // Optionally delete the appointment itself
    // await db.delete(appointments).where(eq(appointments.id, conversation.appointmentId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE appointment] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete appointment' });
  }
});

/**
 * Get all appointments pending damage assessment
 * GET /api/appointments/damage-assessment/pending
 */
router.get('/damage-assessment/pending', async (req, res) => {
  try {
    const pendingAppointments = await req.tenantDb!.select({
      appointment: appointments,
      service: services,
      customer: customers,
    })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(customers, eq(appointments.customerId, customers.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.damageAssessmentStatus, 'pending')));
    
    // Filter out any appointments where service or customer is null (data integrity issue)
    const validAppointments = pendingAppointments.filter(a => a.service && a.customer);
    
    if (validAppointments.length < pendingAppointments.length) {
      console.warn(`[GET damage assessment] ${pendingAppointments.length - validAppointments.length} appointments missing service or customer data`);
    }
    
    res.json({
      success: true,
      appointments: validAppointments,
    });
  } catch (error) {
    console.error('[GET damage assessment pending] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending assessments' });
  }
});

/**
 * Update damage assessment status for an appointment
 * PATCH /api/appointments/:id/damage-assessment
 */
router.patch('/:id/damage-assessment', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { status, reviewNotes } = req.body;
    
    if (!['reviewed', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be reviewed, approved, or rejected' 
      });
    }
    
    await req.tenantDb!.update(appointments)
      .set({
        damageAssessmentStatus: status,
        assessmentReviewedAt: new Date(),
      })
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.id, appointmentId)));
    
    console.log(`[DAMAGE ASSESSMENT] Appointment ${appointmentId} marked as ${status}`);
    
    res.json({ success: true, message: `Appointment ${status}` });
  } catch (error) {
    console.error('[PATCH damage assessment] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update assessment status' });
  }
});

/**
 * Customer-facing endpoint: Get appointments by customer phone
 * GET /api/appointments/customer/:phone
 */
router.get('/customer/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Find customer by phone
    const customer = await req.tenantDb!.query.customers.findFirst({
      where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, phone)),
    });

    if (!customer) {
      return res.json({ success: true, data: [] });
    }

    // Get appointments for this customer only
    const customerAppointments = await req.tenantDb!
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        serviceId: appointments.serviceId,
        serviceName: services.name,
        scheduledTime: appointments.scheduledTime,
        completed: appointments.completed,
        address: appointments.address,
        additionalRequests: appointments.additionalRequests,
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.customerId, customer.id)));

    res.json({ success: true, data: customerAppointments });
  } catch (error) {
    console.error('[GET customer appointments] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch appointments' });
  }
});

/**
 * Manual appointment creation from dashboard
 * POST /api/appointments/create-manual
 * Requires authentication
 */
router.post('/create-manual', async (req, res) => {
  try {
    // Validate and parse request body with safe parsing
    const schema = z.object({
      customerName: z.string().min(1, 'Customer name is required'),
      phone: z.string().min(1, 'Phone number is required'),
      service: z.string().refine(val => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0;
      }, { message: 'Invalid service ID' }),
      scheduledTime: z.string().min(1, 'Scheduled time is required').refine(str => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      }, { message: 'Invalid date format' }),
      address: z.string().min(1, 'Address is required'),
    });

    const parseResult = schema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: parseResult.error.errors[0]?.message || 'Validation failed' 
      });
    }

    const data = parseResult.data;
    const serviceId = parseInt(data.service, 10);
    const scheduledTime = new Date(data.scheduledTime);

    // Normalize phone number to E.164 format (remove all non-digits, ensure US format)
    let normalizedPhone = data.phone.replace(/\D/g, '');
    
    // Handle US numbers - if 10 digits, prepend country code
    if (normalizedPhone.length === 10) {
      normalizedPhone = '1' + normalizedPhone;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
      // Already has country code
    } else if (normalizedPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Phone number must be at least 10 digits' });
    }

    // Create appointment with customer in single transaction
    const result = await req.tenantDb!.transaction(async (tx) => {
      // Verify service exists in tenant scope (within transaction)
      const service = await tx.query.services.findFirst({
        where: req.tenantDb!.withTenantFilter(services, eq(services.id, serviceId)),
      });

      if (!service) {
        throw new Error('Service not found');
      }

      // Find or create customer with tenant filtering (within transaction)
      let customer = await tx.query.customers.findFirst({
        where: req.tenantDb!.withTenantFilter(customers, eq(customers.phone, normalizedPhone)),
      });

      if (!customer) {
        // Create new customer with tenant context
        const [newCustomer] = await tx.insert(customers)
          .values({
            name: data.customerName,
            phone: normalizedPhone,
            email: null,
          })
          .returning();
        customer = newCustomer;
      }

      // Create appointment with tenant context
      const [apt] = await tx.insert(appointments)
        .values({
          customerId: customer.id,
          serviceId: serviceId,
          scheduledTime: scheduledTime,
          address: data.address,
          additionalRequests: [],
          addOns: null,
        })
        .returning();

      // Track booking stats (within same transaction)
      await recordAppointmentCreated(customer.id, scheduledTime, tx);

      return { appointment: apt, customer };
    });

    console.log(`[CREATE MANUAL APPOINTMENT] Created appointment ${result.appointment.id} for customer ${result.customer.name}`);

    res.json({ 
      success: true, 
      appointment: result.appointment,
      message: 'Appointment created successfully'
    });
  } catch (error: any) {
    console.error('[POST create-manual] Error:', error);
    
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to create appointment' 
    });
  }
});

export default router;
