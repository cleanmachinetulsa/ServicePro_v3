import { Router, Request, Response } from 'express';
import { customerTags, conversationTags, conversations, customers, appointments, services } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

const router = Router();

// Apply authentication to all tag routes
router.use(requireAuth);

// Get all tags
router.get('/', async (req: Request, res: Response) => {
  try {
    const tags = await req.tenantDb!
      .select()
      .from(customerTags)
      .where(req.tenantDb!.withTenantFilter(customerTags))
      .orderBy(customerTags.name);

    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tags' });
  }
});

// Create new tag
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Tag name is required' });
    }

    const newTag = await req.tenantDb!
      .insert(customerTags)
      .values({
        name,
        color: color || 'blue',
        icon: icon || null,
        isPredefined: false,
      })
      .returning();

    res.json({ success: true, data: newTag[0] });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ success: false, message: 'Tag name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create tag' });
  }
});

// Delete tag
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tagId = parseInt(req.params.id);

    // First delete all conversation_tags references
    await req.tenantDb!.delete(conversationTags).where(eq(conversationTags.tagId, tagId));

    // Then delete the tag
    await req.tenantDb!.delete(customerTags).where(eq(customerTags.id, tagId));

    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ success: false, message: 'Failed to delete tag' });
  }
});

// Get tags for a specific conversation
router.get('/conversation/:id', async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);

    const tags = await req.tenantDb!
      .select({
        id: customerTags.id,
        name: customerTags.name,
        color: customerTags.color,
        icon: customerTags.icon,
        isPredefined: customerTags.isPredefined,
      })
      .from(conversationTags)
      .innerJoin(customerTags, eq(conversationTags.tagId, customerTags.id))
      .where(req.tenantDb!.withTenantFilter(conversationTags, eq(conversationTags.conversationId, conversationId)));

    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('Error fetching conversation tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation tags' });
  }
});

// Add tag to conversation
router.post('/conversation/:id/add/:tagId', async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    // Check if tag already exists on this conversation
    const existing = await req.tenantDb!
      .select()
      .from(conversationTags)
      .where(
        req.tenantDb!.withTenantFilter(
          conversationTags,
          and(
            eq(conversationTags.conversationId, conversationId),
            eq(conversationTags.tagId, tagId)
          )
        )
      );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Tag already added to conversation' });
    }

    const newConversationTag = await req.tenantDb!
      .insert(conversationTags)
      .values({ conversationId, tagId })
      .returning();

    res.json({ success: true, data: newConversationTag[0] });
  } catch (error) {
    console.error('Error adding tag to conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to add tag to conversation' });
  }
});

// Remove tag from conversation
router.delete('/conversation/:id/remove/:tagId', async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    await req.tenantDb!
      .delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId)
        )
      );

    res.json({ success: true, message: 'Tag removed from conversation' });
  } catch (error) {
    console.error('Error removing tag from conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to remove tag from conversation' });
  }
});

// Get customer profile for a conversation
router.get('/customer-profile/:conversationId', async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.conversationId);

    // Get conversation
    const conversation = await req.tenantDb!
      .select()
      .from(conversations)
      .where(req.tenantDb!.withTenantFilter(conversations, eq(conversations.id, conversationId)))
      .limit(1);

    if (conversation.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const conv = conversation[0];

    // Get customer details if linked
    let customer = null;
    if (conv.customerId) {
      const customerResult = await req.tenantDb!
        .select()
        .from(customers)
        .where(req.tenantDb!.withTenantFilter(customers, eq(customers.id, conv.customerId)))
        .limit(1);

      customer = customerResult[0] || null;
    }

    // Get appointment history
    const appointmentHistory = conv.customerId ? await req.tenantDb!
      .select({
        id: appointments.id,
        scheduledTime: appointments.scheduledTime,
        completed: appointments.completed,
        serviceName: services.name,
        address: appointments.address,
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(req.tenantDb!.withTenantFilter(appointments, eq(appointments.customerId, conv.customerId)))
      .orderBy(appointments.scheduledTime)
      .limit(10) : [];

    // Get tags
    const tags = await req.tenantDb!
      .select({
        id: customerTags.id,
        name: customerTags.name,
        color: customerTags.color,
        icon: customerTags.icon,
      })
      .from(conversationTags)
      .innerJoin(customerTags, eq(conversationTags.tagId, customerTags.id))
      .where(req.tenantDb!.withTenantFilter(conversationTags, eq(conversationTags.conversationId, conversationId)));

    res.json({
      success: true,
      data: {
        conversation: conv,
        customer,
        appointmentHistory,
        tags,
      },
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer profile' });
  }
});

export default router;
