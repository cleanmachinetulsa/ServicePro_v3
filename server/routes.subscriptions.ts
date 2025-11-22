import { Router, Request, Response } from 'express';
import { subscriptions, insertSubscriptionSchema } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/subscriptions
 * Get all subscriptions ordered by creation date
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const allSubscriptions = await req.tenantDb!.select()
      .from(subscriptions)
      .where(req.tenantDb!.withTenantFilter(subscriptions))
      .orderBy(desc(subscriptions.createdAt));
    
    // Calculate total monthly cost
    const totalMonthlyCost = allSubscriptions
      .filter(sub => sub.isActive)
      .reduce((sum, sub) => {
        const cost = parseFloat(sub.monthlyCost as string);
        if (sub.billingCycle === 'yearly') {
          return sum + (cost / 12); // Convert yearly to monthly
        }
        return sum + cost;
      }, 0);
    
    res.json({ 
      success: true, 
      subscriptions: allSubscriptions,
      totalMonthlyCost: totalMonthlyCost.toFixed(2)
    });
  } catch (error: any) {
    console.error('[SUBSCRIPTIONS] Error fetching subscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = insertSubscriptionSchema.parse(req.body);
    
    // Automatically sync isActive with status on creation
    const dataToInsert = {
      ...validatedData,
      isActive: (validatedData.status || 'active') === 'active'
    };
    
    const [newSubscription] = await req.tenantDb!.insert(subscriptions)
      .values(dataToInsert)
      .returning();
    
    console.log(`[SUBSCRIPTIONS] Created subscription: ${newSubscription.serviceName}, isActive=${newSubscription.isActive}`);
    
    res.json({ success: true, subscription: newSubscription });
  } catch (error: any) {
    console.error('[SUBSCRIPTIONS] Error creating subscription:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/subscriptions/:id
 * Update an existing subscription
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    
    // Automatically sync isActive with status
    if (updates.status) {
      updates.isActive = updates.status === 'active';
    }
    
    // Update timestamp
    updates.updatedAt = new Date();
    
    const [updatedSubscription] = await req.tenantDb!.update(subscriptions)
      .set(updates)
      .where(req.tenantDb!.withTenantFilter(subscriptions, eq(subscriptions.id, subscriptionId)))
      .returning();
    
    if (!updatedSubscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    console.log(`[SUBSCRIPTIONS] Updated subscription ${subscriptionId}: isActive=${updatedSubscription.isActive}`);
    
    res.json({ success: true, subscription: updatedSubscription });
  } catch (error: any) {
    console.error('[SUBSCRIPTIONS] Error updating subscription:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/subscriptions/:id
 * Delete a subscription
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    
    await req.tenantDb!.delete(subscriptions)
      .where(req.tenantDb!.withTenantFilter(subscriptions, eq(subscriptions.id, subscriptionId)));
    
    console.log(`[SUBSCRIPTIONS] Deleted subscription ${subscriptionId}`);
    
    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error: any) {
    console.error('[SUBSCRIPTIONS] Error deleting subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/subscriptions/seed
 * Populate subscription manager with all real services being used
 */
router.post('/seed', async (req: Request, res: Response) => {
  try {
    // Check if already seeded
    const existingSubscriptions = await req.tenantDb!.select()
      .from(subscriptions)
      .where(req.tenantDb!.withTenantFilter(subscriptions));
    if (existingSubscriptions.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Subscriptions already exist. Delete them first if you want to re-seed.',
        count: existingSubscriptions.length 
      });
    }

    // Define all real service subscriptions
    const serviceSubscriptions = [
      {
        serviceName: 'Stripe',
        description: 'Payment processing platform for invoicing and subscriptions',
        monthlyCost: '0.00',
        billingCycle: 'monthly',
        status: 'active',
        website: 'https://stripe.com',
        notes: 'Pay-as-you-go: 2.9% + $0.30 per transaction. No monthly fee.',
        isActive: true
      },
      {
        serviceName: 'Twilio',
        description: 'SMS notifications, voicemail transcription, and phone service',
        monthlyCost: '75.00',
        billingCycle: 'monthly',
        status: 'active',
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        website: 'https://www.twilio.com',
        notes: 'Toll-free number ($2/mo) + SMS usage (~$0.0079/msg) + carrier fees. Estimate for moderate volume.',
        isActive: true
      },
      {
        serviceName: 'SendGrid',
        description: 'Email delivery and marketing campaign platform',
        monthlyCost: '15.00',
        billingCycle: 'monthly',
        status: 'active',
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        website: 'https://sendgrid.com',
        notes: 'Basic Marketing Plan: Up to 100K contacts, 300K emails/month',
        isActive: true
      },
      {
        serviceName: 'OpenAI',
        description: 'GPT-4o AI chatbot and conversation intelligence',
        monthlyCost: '80.00',
        billingCycle: 'monthly',
        status: 'active',
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        website: 'https://openai.com',
        notes: 'GPT-4o API usage: $5/$15 per 1M input/output tokens. Estimated for moderate chatbot usage.',
        isActive: true
      },
      {
        serviceName: 'Google Workspace',
        description: 'Business email, Calendar, Drive, Sheets for customer data',
        monthlyCost: '14.00',
        billingCycle: 'yearly',
        status: 'active',
        renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        website: 'https://workspace.google.com',
        notes: 'Business Standard: 2TB storage, Gmail, Calendar, Drive, Sheets. Annual billing.',
        isActive: true
      },
      {
        serviceName: 'Neon PostgreSQL',
        description: 'Serverless PostgreSQL database for customer and business data',
        monthlyCost: '19.00',
        billingCycle: 'monthly',
        status: 'active',
        renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        website: 'https://neon.com',
        notes: 'Launch Plan: 10 GiB storage, 300 compute hours, 7-day point-in-time restore',
        isActive: true
      },
      {
        serviceName: 'Slack',
        description: 'Internal business notifications and team communication',
        monthlyCost: '7.25',
        billingCycle: 'yearly',
        status: 'active',
        renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        website: 'https://slack.com',
        notes: 'Pro Plan: Unlimited integrations, message history. 1 user, annual billing.',
        isActive: true
      },
      {
        serviceName: 'Replit',
        description: 'Hosting platform and development environment',
        monthlyCost: '20.00',
        billingCycle: 'yearly',
        status: 'active',
        renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        website: 'https://replit.com',
        notes: 'Core Plan: $25/month credits, unlimited AI access, 100 GiB data transfer. Annual billing.',
        isActive: true
      }
    ];

    // Insert all subscriptions
    const createdSubscriptions = await req.tenantDb!.insert(subscriptions)
      .values(serviceSubscriptions)
      .returning();

    console.log(`[SUBSCRIPTIONS] Seeded ${createdSubscriptions.length} service subscriptions`);

    res.json({ 
      success: true, 
      message: `Successfully populated ${createdSubscriptions.length} subscriptions`,
      subscriptions: createdSubscriptions 
    });
  } catch (error: any) {
    console.error('[SUBSCRIPTIONS] Error seeding subscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
