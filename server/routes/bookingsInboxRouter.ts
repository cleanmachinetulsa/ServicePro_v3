import { Router, Request, Response } from 'express';
import { requireAuth } from '../authMiddleware';
import { requireRole } from '../rbacMiddleware';
import { conversations, messages, customers } from '@shared/schema';
import { eq, desc, and, ilike, gte, lte, sql } from 'drizzle-orm';

const router = Router();

function getTenantId(req: Request): string {
  const session = req.session as any;
  const user = (req as any).user;
  
  if (session?.impersonatedTenantId) {
    return session.impersonatedTenantId;
  }
  if (session?.tenantId) {
    return session.tenantId;
  }
  if (user?.tenantId) {
    return user.tenantId;
  }
  return 'root';
}

interface BookingInboxFilters {
  status?: string;
  stage?: string;
  needsHuman?: boolean;
  dateFrom?: string;
  dateTo?: string;
  phone?: string;
  page?: number;
  limit?: number;
}

interface BookingInboxRow {
  conversationId: number;
  phone: string | null;
  customerName: string | null;
  customerId: number | null;
  service: string | null;
  requestedDateTime: string | null;
  stage: string | null;
  stageReason: string | null;
  status: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  needsHuman: boolean;
  needsHumanReason: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  bookingId: number | null;
  calendarEventId: string | null;
  lastMessageTime: string | null;
  platform: string;
}

router.get('/api/admin/bookings/inbox', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenantDb = req.tenantDb!;
    const tenantId = getTenantId(req);
    
    const filters: BookingInboxFilters = {
      status: req.query.status as string,
      stage: req.query.stage as string,
      needsHuman: req.query.needsHuman === 'true' ? true : req.query.needsHuman === 'false' ? false : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      phone: req.query.phone as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
    };
    
    const offset = (filters.page! - 1) * filters.limit!;
    
    const conditions: any[] = [
      eq(conversations.tenantId, tenantId),
      eq(conversations.platform, 'sms'),
    ];
    
    if (filters.status) {
      conditions.push(eq(conversations.status, filters.status));
    }
    
    if (filters.needsHuman !== undefined) {
      conditions.push(eq(conversations.needsHumanAttention, filters.needsHuman));
    }
    
    if (filters.dateFrom) {
      conditions.push(gte(conversations.lastMessageTime, new Date(filters.dateFrom)));
    }
    
    if (filters.dateTo) {
      conditions.push(lte(conversations.lastMessageTime, new Date(filters.dateTo)));
    }
    
    if (filters.phone) {
      conditions.push(ilike(conversations.customerPhone, `%${filters.phone}%`));
    }
    
    if (filters.stage) {
      conditions.push(sql`${conversations.behaviorSettings}->>'smsBookingState' IS NOT NULL AND ${conversations.behaviorSettings}->'smsBookingState'->>'stage' = ${filters.stage}`);
    }
    
    const rows = await tenantDb
      .select({
        id: conversations.id,
        customerPhone: conversations.customerPhone,
        customerName: conversations.customerName,
        customerId: conversations.customerId,
        status: conversations.status,
        needsHumanAttention: conversations.needsHumanAttention,
        needsHumanReason: conversations.needsHumanReason,
        lastBookingErrorCode: conversations.lastBookingErrorCode,
        lastBookingErrorMessage: conversations.lastBookingErrorMessage,
        lastBookingErrorAt: conversations.lastBookingErrorAt,
        lastMessageTime: conversations.lastMessageTime,
        platform: conversations.platform,
        behaviorSettings: conversations.behaviorSettings,
        appointmentId: conversations.appointmentId,
        handoffReason: conversations.handoffReason,
      })
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageTime))
      .limit(filters.limit!)
      .offset(offset);
    
    const countResult = await tenantDb
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(...conditions));
    
    const totalCount = countResult[0]?.count || 0;
    
    const inboxRows: BookingInboxRow[] = rows.map(row => {
      const behaviorSettings = row.behaviorSettings as any;
      const smsBookingState = behaviorSettings?.smsBookingState || {};
      
      return {
        conversationId: row.id,
        phone: row.customerPhone,
        customerName: row.customerName,
        customerId: row.customerId,
        service: smsBookingState.service || null,
        requestedDateTime: smsBookingState.chosenSlotIso || smsBookingState.chosenSlotLabel || null,
        stage: smsBookingState.stage || null,
        stageReason: smsBookingState.lastResetReason || null,
        status: row.status,
        lastInboundAt: null,
        lastOutboundAt: null,
        needsHuman: row.needsHumanAttention || false,
        needsHumanReason: row.needsHumanReason || row.handoffReason || null,
        lastErrorCode: row.lastBookingErrorCode || null,
        lastErrorMessage: row.lastBookingErrorMessage || null,
        lastErrorAt: row.lastBookingErrorAt?.toISOString() || null,
        bookingId: row.appointmentId,
        calendarEventId: null,
        lastMessageTime: row.lastMessageTime?.toISOString() || null,
        platform: row.platform,
      };
    });
    
    if (inboxRows.length > 0) {
      const conversationIds = inboxRows.map(r => r.conversationId);
      
      const lastMessagesQuery = await tenantDb
        .select({
          conversationId: messages.conversationId,
          sender: messages.sender,
          timestamp: messages.timestamp,
          metadata: messages.metadata,
        })
        .from(messages)
        .where(sql`${messages.conversationId} IN (${sql.join(conversationIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(messages.timestamp));
      
      const lastInboundByConv: Record<number, { timestamp: Date | null; sid?: string }> = {};
      const lastOutboundByConv: Record<number, { timestamp: Date | null; sid?: string }> = {};
      
      for (const msg of lastMessagesQuery) {
        const convId = msg.conversationId;
        const meta = msg.metadata as any;
        
        if (msg.sender === 'customer') {
          if (!lastInboundByConv[convId]) {
            lastInboundByConv[convId] = { timestamp: msg.timestamp, sid: meta?.messageSid };
          }
        } else {
          if (!lastOutboundByConv[convId]) {
            lastOutboundByConv[convId] = { timestamp: msg.timestamp, sid: meta?.messageSid };
          }
        }
      }
      
      for (const row of inboxRows) {
        const inbound = lastInboundByConv[row.conversationId];
        const outbound = lastOutboundByConv[row.conversationId];
        
        if (inbound) {
          row.lastInboundAt = inbound.timestamp?.toISOString() || null;
        }
        if (outbound) {
          row.lastOutboundAt = outbound.timestamp?.toISOString() || null;
        }
      }
    }
    
    res.json({
      rows: inboxRows,
      totalCount,
      page: filters.page,
      limit: filters.limit,
    });
  } catch (error) {
    console.error('[BOOKINGS_INBOX] Error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings inbox' });
  }
});

router.get('/api/admin/bookings/inbox/:conversationId/messages', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenantDb = req.tenantDb!;
    const tenantId = getTenantId(req);
    const conversationId = parseInt(req.params.conversationId);
    
    if (isNaN(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID' });
      return;
    }
    
    const conversation = await tenantDb
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!conversation.length) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    
    const limit = parseInt(req.query.limit as string) || 30;
    
    const messageList = await tenantDb
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.timestamp))
      .limit(limit);
    
    const behaviorSettings = conversation[0].behaviorSettings as any;
    const smsBookingState = behaviorSettings?.smsBookingState || {};
    
    res.json({
      conversation: conversation[0],
      messages: messageList.reverse(),
      smsBookingState,
    });
  } catch (error) {
    console.error('[BOOKINGS_INBOX_DETAIL] Error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

router.get('/api/admin/bookings/inbox/:conversationId/debug-bundle', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenantDb = req.tenantDb!;
    const tenantId = getTenantId(req);
    const conversationId = parseInt(req.params.conversationId);
    
    if (isNaN(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID' });
      return;
    }
    
    const conversation = await tenantDb
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!conversation.length) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    
    const messageList = await tenantDb
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.timestamp))
      .limit(30);
    
    const behaviorSettings = conversation[0].behaviorSettings as any;
    const smsBookingState = behaviorSettings?.smsBookingState || {};
    
    let customer = null;
    if (conversation[0].customerId) {
      const customerResult = await tenantDb
        .select()
        .from(customers)
        .where(eq(customers.id, conversation[0].customerId))
        .limit(1);
      customer = customerResult[0] || null;
    }
    
    const debugBundle = {
      generatedAt: new Date().toISOString(),
      tenantId,
      conversationId,
      conversation: {
        id: conversation[0].id,
        customerPhone: conversation[0].customerPhone,
        customerName: conversation[0].customerName,
        customerId: conversation[0].customerId,
        status: conversation[0].status,
        platform: conversation[0].platform,
        needsHumanAttention: conversation[0].needsHumanAttention,
        needsHumanReason: conversation[0].needsHumanReason,
        lastBookingErrorCode: conversation[0].lastBookingErrorCode,
        lastBookingErrorMessage: conversation[0].lastBookingErrorMessage,
        lastBookingErrorAt: conversation[0].lastBookingErrorAt,
        handoffReason: conversation[0].handoffReason,
        appointmentId: conversation[0].appointmentId,
        lastMessageTime: conversation[0].lastMessageTime,
        createdAt: conversation[0].createdAt,
      },
      smsBookingState,
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        vehicleInfo: customer.vehicleInfo,
      } : null,
      messages: messageList.reverse().map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        timestamp: m.timestamp,
        deliveryStatus: m.deliveryStatus,
        metadata: m.metadata,
      })),
    };
    
    res.json(debugBundle);
  } catch (error) {
    console.error('[BOOKINGS_INBOX_DEBUG] Error:', error);
    res.status(500).json({ error: 'Failed to generate debug bundle' });
  }
});

router.get('/api/admin/bookings/inbox/stages', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  res.json({
    stages: [
      { value: 'selecting_service', label: 'Selecting Service' },
      { value: 'confirming_address', label: 'Confirming Address' },
      { value: 'choosing_slot', label: 'Choosing Slot' },
      { value: 'offering_upsells', label: 'Offering Upsells' },
      { value: 'booked', label: 'Booked' },
    ],
  });
});

export default router;
