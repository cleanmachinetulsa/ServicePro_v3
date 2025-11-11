import { Router, Request, Response } from 'express';
import { db } from './db';
import { recurringServices, customers, services, appointments } from '@shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { insertRecurringServiceSchema } from '@shared/schema';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { sendSMS } from './notifications';
import { sendBusinessEmail } from './emailService';

const router = Router();

// Get all recurring services
router.get('/', async (req: Request, res: Response) => {
  try {
    const allRecurringServices = await db
      .select({
        id: recurringServices.id,
        customerId: recurringServices.customerId,
        serviceId: recurringServices.serviceId,
        frequency: recurringServices.frequency,
        nextScheduledDate: recurringServices.nextScheduledDate,
        autoRenew: recurringServices.autoRenew,
        status: recurringServices.status,
        preferredTime: recurringServices.preferredTime,
        preferredDayOfWeek: recurringServices.preferredDayOfWeek,
        preferredDayOfMonth: recurringServices.preferredDayOfMonth,
        notes: recurringServices.notes,
        createdAt: recurringServices.createdAt,
        updatedAt: recurringServices.updatedAt,
        pausedAt: recurringServices.pausedAt,
        cancelledAt: recurringServices.cancelledAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        serviceName: services.name,
      })
      .from(recurringServices)
      .leftJoin(customers, eq(recurringServices.customerId, customers.id))
      .leftJoin(services, eq(recurringServices.serviceId, services.id))
      .orderBy(recurringServices.nextScheduledDate);

    res.json({ data: allRecurringServices });
  } catch (error) {
    console.error('[RECURRING] Error fetching recurring services:', error);
    res.status(500).json({ error: 'Failed to fetch recurring services' });
  }
});

// Get recurring service by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [recurringService] = await db
      .select()
      .from(recurringServices)
      .where(eq(recurringServices.id, parseInt(id)))
      .limit(1);

    if (!recurringService) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: recurringService });
  } catch (error) {
    console.error('[RECURRING] Error fetching recurring service:', error);
    res.status(500).json({ error: 'Failed to fetch recurring service' });
  }
});

// Create a new recurring service
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = insertRecurringServiceSchema.parse(req.body);

    const [newRecurringService] = await db
      .insert(recurringServices)
      .values({
        ...validatedData,
        // Don't override status - respect client value (active, deferred, etc.)
        // Don't override nextScheduledDate - respect null for custom_dates
        updatedAt: new Date(),
      })
      .returning();

    res.json({ data: newRecurringService });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('[RECURRING] Error creating recurring service:', error);
    res.status(500).json({ error: 'Failed to create recurring service' });
  }
});

// Update recurring service
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate update data
    const updateSchema = insertRecurringServiceSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    const [updated] = await db
      .update(recurringServices)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('[RECURRING] Error updating recurring service:', error);
    res.status(500).json({ error: 'Failed to update recurring service' });
  }
});

// Pause recurring service
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate pause request
    const pauseSchema = z.object({
      reason: z.string().optional(),
    });
    const { reason } = pauseSchema.parse(req.body);

    const [updated] = await db
      .update(recurringServices)
      .set({
        status: 'paused',
        pauseReason: reason || null,
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('[RECURRING] Error pausing recurring service:', error);
    res.status(500).json({ error: 'Failed to pause recurring service' });
  }
});

// Resume recurring service
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const [updated] = await db
      .update(recurringServices)
      .set({
        status: 'active',
        pauseReason: null,
        pausedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: updated });
  } catch (error) {
    console.error('[RECURRING] Error resuming recurring service:', error);
    res.status(500).json({ error: 'Failed to resume recurring service' });
  }
});

// Cancel recurring service
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(recurringServices)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: updated });
  } catch (error) {
    console.error('[RECURRING] Error cancelling recurring service:', error);
    res.status(500).json({ error: 'Failed to cancel recurring service' });
  }
});

// Delete recurring service
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(recurringServices)
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    res.json({ data: deleted });
  } catch (error) {
    console.error('[RECURRING] Error deleting recurring service:', error);
    res.status(500).json({ error: 'Failed to delete recurring service' });
  }
});

// Customer-facing endpoint: Pause recurring service (with ownership verification)
router.post('/customer/:phone/pause/:id', async (req: Request, res: Response) => {
  try {
    const { phone, id } = req.params;
    const { reason } = req.body;

    // Find customer by phone
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify the recurring service belongs to this customer
    const service = await db.query.recurringServices.findFirst({
      where: and(
        eq(recurringServices.id, parseInt(id)),
        eq(recurringServices.customerId, customer.id)
      ),
    });

    if (!service) {
      return res.status(403).json({ error: 'Unauthorized: Service not found or does not belong to you' });
    }

    // Pause the service
    const [updated] = await db
      .update(recurringServices)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    res.json({ data: updated });
  } catch (error) {
    console.error('[RECURRING] Error pausing customer recurring service:', error);
    res.status(500).json({ error: 'Failed to pause recurring service' });
  }
});

// Customer-facing endpoint: Resume recurring service (with ownership verification)
router.post('/customer/:phone/resume/:id', async (req: Request, res: Response) => {
  try {
    const { phone, id } = req.params;

    // Find customer by phone
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify the recurring service belongs to this customer
    const service = await db.query.recurringServices.findFirst({
      where: and(
        eq(recurringServices.id, parseInt(id)),
        eq(recurringServices.customerId, customer.id)
      ),
    });

    if (!service) {
      return res.status(403).json({ error: 'Unauthorized: Service not found or does not belong to you' });
    }

    // Resume the service
    const [updated] = await db
      .update(recurringServices)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    res.json({ data: updated });
  } catch (error) {
    console.error('[RECURRING] Error resuming customer recurring service:', error);
    res.status(500).json({ error: 'Failed to resume recurring service' });
  }
});

// Customer-facing endpoint: Get recurring services by phone number
router.get('/customer/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Find customer by phone
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found', data: [] });
    }

    // Get recurring services for this customer only
    const customerRecurringServices = await db
      .select()
      .from(recurringServices)
      .where(eq(recurringServices.customerId, customer.id))
      .orderBy(desc(recurringServices.createdAt));

    // Populate service details
    const servicesWithDetails = await Promise.all(
      customerRecurringServices.map(async (rs) => {
        const service = await db.query.services.findFirst({
          where: eq(services.id, rs.serviceId),
        });
        return {
          ...rs,
          customer: {
            name: customer.name,
            phone: customer.phone,
          },
          service,
        };
      })
    );

    res.json({ data: servicesWithDetails });
  } catch (error) {
    console.error('[RECURRING] Error fetching customer recurring services:', error);
    res.status(500).json({ error: 'Failed to fetch recurring services' });
  }
});

/**
 * POST /api/recurring-services/defer/:id
 * Defer scheduling - generate booking token and send reminder
 */
router.post('/defer/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deferredUntilDays = 30 } = req.body; // Default 30 days

    // Generate unique booking token
    const bookingToken = nanoid(32);
    const deferredUntil = new Date();
    deferredUntil.setDate(deferredUntil.getDate() + deferredUntilDays);

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + deferredUntilDays + 7); // Extra 7 days buffer

    // Update recurring service with defer status
    const [updated] = await db
      .update(recurringServices)
      .set({
        status: 'deferred',
        bookingToken,
        deferredUntil,
        tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Recurring service not found' });
    }

    // Get customer info for notification
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, updated.customerId),
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Send reminder via SMS and email with booking link
    const bookingLink = `${process.env.REPLIT_URL || 'https://your-app.replit.app'}/schedule?token=${bookingToken}`;

    // SMS notification
    const smsMessage = `Hi ${customer.name}! Ready to schedule your recurring service?\n\nBook now: ${bookingLink}\n\nLink expires in ${deferredUntilDays} days. Reply HELP for assistance.`;
    
    // Note: Not awaiting to avoid blocking
    sendSMS(customer.phone, smsMessage).catch(err => 
      console.error('[RECURRING DEFER] SMS failed:', err)
    );

    // Email notification (if available)
    if (customer.email) {
      const emailSubject = 'Schedule Your Recurring Service';
      const emailHtml = `
        <h2>Hi ${customer.name}!</h2>
        <p>You've deferred scheduling your recurring service. When you're ready, use the link below to pick your preferred dates:</p>
        <p><a href="${bookingLink}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Schedule Now</a></p>
        <p style="color:#666;font-size:14px;margin-top:24px;">This link expires in ${deferredUntilDays} days.</p>
      `;
      const emailText = `Hi ${customer.name}!\n\nYou've deferred scheduling your recurring service.\n\nSchedule now: ${bookingLink}\n\nThis link expires in ${deferredUntilDays} days.`;

      sendBusinessEmail(customer.email, emailSubject, emailText, emailHtml).catch(err =>
        console.error('[RECURRING DEFER] Email failed:', err)
      );
    }

    res.json({
      success: true,
      data: updated,
      bookingLink, // Include in response for testing/display
    });
  } catch (error) {
    console.error('[RECURRING] Error deferring service:', error);
    res.status(500).json({ error: 'Failed to defer recurring service' });
  }
});

/**
 * POST /api/recurring-services/resume-from-token
 * Resume deferred service using booking token
 */
router.post('/resume-from-token', async (req: Request, res: Response) => {
  try {
    const { token, nextScheduledDate } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Booking token is required' });
    }

    // Find service by token
    const [service] = await db
      .select()
      .from(recurringServices)
      .where(eq(recurringServices.bookingToken, token))
      .limit(1);

    if (!service) {
      return res.status(404).json({ error: 'Invalid or expired booking token' });
    }

    // Check if token has expired
    if (service.tokenExpiresAt && new Date() > new Date(service.tokenExpiresAt)) {
      return res.status(400).json({ error: 'Booking token has expired' });
    }

    // Security: Prevent token reuse by clearing it immediately
    // Restore service to active status and set next scheduled date
    const [updated] = await db
      .update(recurringServices)
      .set({
        status: 'active',
        bookingToken: null, // Clear token to prevent reuse
        tokenExpiresAt: null,
        deferredUntil: null,
        nextScheduledDate: nextScheduledDate || null,
        updatedAt: new Date(),
      })
      .where(eq(recurringServices.id, service.id))
      .returning();

    // Return updated service details
    res.json({
      success: true,
      data: updated,
      message: 'Service successfully resumed and activated',
    });
  } catch (error) {
    console.error('[RECURRING] Error resuming from token:', error);
    res.status(500).json({ error: 'Failed to resume service from token' });
  }
});

export default router;
