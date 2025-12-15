import { Router, Request, Response } from 'express';
import { requireAuth } from '../authMiddleware';
import { requireRole } from '../rbacMiddleware';
import { conversations, messages, customers } from '@shared/schema';
import { eq, desc, and, ilike, gte, lte, sql, isNotNull } from 'drizzle-orm';

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
  bookingStatus?: string;
  stage?: string;
  needsHuman?: boolean;
  dateFrom?: string;
  dateTo?: string;
  phone?: string;
  bookingId?: string;
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
  address: string | null;
  vehicle: string | null;
  isStale: boolean;
}

const BOOKING_FLOW_STAGES = [
  'selecting_service',
  'confirming_address', 
  'ask_address',
  'choosing_slot',
  'awaiting_confirm',
  'creating_booking',
  'calendar_insert',
  'offering_upsells',
];

const STALE_THRESHOLD_MINUTES = 15;

router.get('/api/admin/bookings/inbox', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenantDb = req.tenantDb!;
    const tenantId = getTenantId(req);
    
    const filters: BookingInboxFilters = {
      bookingStatus: req.query.bookingStatus as string,
      stage: req.query.stage as string,
      needsHuman: req.query.needsHuman === 'true' ? true : req.query.needsHuman === 'false' ? false : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      phone: req.query.phone as string,
      bookingId: req.query.bookingId as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
    };
    
    const offset = (filters.page! - 1) * filters.limit!;
    
    const conditions: any[] = [
      eq(conversations.tenantId, tenantId),
      eq(conversations.platform, 'sms'),
    ];
    
    if (filters.needsHuman !== undefined) {
      conditions.push(eq(conversations.needsHumanAttention, filters.needsHuman));
    }
    
    if (filters.dateFrom) {
      conditions.push(gte(conversations.lastMessageTime, new Date(filters.dateFrom)));
    }
    
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(conversations.lastMessageTime, endDate));
    }
    
    if (filters.phone) {
      conditions.push(ilike(conversations.customerPhone, `%${filters.phone}%`));
    }
    
    if (filters.bookingId) {
      const bookingIdNum = parseInt(filters.bookingId);
      if (!isNaN(bookingIdNum)) {
        conditions.push(eq(conversations.appointmentId, bookingIdNum));
      }
    }
    
    if (filters.stage) {
      conditions.push(sql`${conversations.behaviorSettings}->>'smsBookingState' IS NOT NULL AND ${conversations.behaviorSettings}->'smsBookingState'->>'stage' = ${filters.stage}`);
    }
    
    if (filters.bookingStatus) {
      switch (filters.bookingStatus) {
        case 'CONFIRMED':
          conditions.push(isNotNull(conversations.appointmentId));
          break;
        case 'NEEDS_HUMAN':
          conditions.push(eq(conversations.needsHumanAttention, true));
          break;
        case 'PENDING':
          conditions.push(eq(conversations.status, 'active'));
          conditions.push(eq(conversations.needsHumanAttention, false));
          break;
        case 'ABANDONED':
          conditions.push(eq(conversations.status, 'closed'));
          conditions.push(sql`${conversations.appointmentId} IS NULL`);
          break;
        case 'AWAITING_CONFIRM':
          conditions.push(sql`${conversations.behaviorSettings}->'smsBookingState'->>'stage' IN ('awaiting_confirm', 'booked')`);
          break;
      }
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
    
    const now = Date.now();
    const inboxRows: BookingInboxRow[] = rows.map(row => {
      const behaviorSettings = row.behaviorSettings as any;
      const smsBookingState = behaviorSettings?.smsBookingState || {};
      
      const stage = smsBookingState.stage || null;
      const lastMsgTime = row.lastMessageTime;
      const minutesSinceLastMessage = lastMsgTime ? (now - new Date(lastMsgTime).getTime()) / (1000 * 60) : 0;
      const isInBookingFlow = stage && BOOKING_FLOW_STAGES.includes(stage);
      const isStale = isInBookingFlow && minutesSinceLastMessage >= STALE_THRESHOLD_MINUTES;
      
      return {
        conversationId: row.id,
        phone: row.customerPhone,
        customerName: row.customerName,
        customerId: row.customerId,
        service: smsBookingState.service || null,
        requestedDateTime: smsBookingState.chosenSlotIso || smsBookingState.chosenSlotLabel || null,
        stage,
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
        calendarEventId: smsBookingState.calendarEventId || null,
        lastMessageTime: row.lastMessageTime?.toISOString() || null,
        platform: row.platform,
        address: smsBookingState.address || null,
        vehicle: smsBookingState.vehicle || null,
        isStale,
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
    
    let customer = null;
    if (conversation[0].customerId) {
      const customerResult = await tenantDb
        .select()
        .from(customers)
        .where(eq(customers.id, conversation[0].customerId))
        .limit(1);
      customer = customerResult[0] ? {
        id: customerResult[0].id,
        name: customerResult[0].name,
        phone: customerResult[0].phone,
        email: customerResult[0].email,
        address: customerResult[0].address,
        vehicleInfo: customerResult[0].vehicleInfo,
      } : null;
    }
    
    res.json({
      conversation: conversation[0],
      messages: messageList.reverse(),
      smsBookingState,
      customer,
    });
  } catch (error) {
    console.error('[BOOKINGS_INBOX_DETAIL] Error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

router.post('/api/admin/bookings/inbox/:conversationId/link-booking', requireAuth, requireRole('owner', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenantDb = req.tenantDb!;
    const tenantId = getTenantId(req);
    const conversationId = parseInt(req.params.conversationId);
    const { bookingId, calendarEventId } = req.body;
    
    if (isNaN(conversationId)) {
      res.status(400).json({ error: 'Invalid conversation ID' });
      return;
    }
    
    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required' });
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
    
    const existingBehavior = conversation[0].behaviorSettings as any || {};
    const existingSmsState = existingBehavior?.smsBookingState || {};
    
    const updatedSmsState = {
      ...existingSmsState,
      stage: 'completed',
      calendarEventId: calendarEventId || existingSmsState.calendarEventId,
      manuallyCompleted: true,
      manuallyCompletedAt: new Date().toISOString(),
    };
    
    await tenantDb
      .update(conversations)
      .set({
        appointmentId: bookingId,
        needsHumanAttention: false,
        needsHumanReason: null,
        lastBookingErrorCode: null,
        lastBookingErrorMessage: null,
        behaviorSettings: {
          ...existingBehavior,
          smsBookingState: updatedSmsState,
        },
      })
      .where(eq(conversations.id, conversationId));
    
    console.log(`[BOOKINGS_INBOX] Linked booking ${bookingId} to conversation ${conversationId}`);
    
    res.json({ 
      success: true, 
      message: 'Booking linked to conversation',
      conversationId,
      bookingId,
      calendarEventId,
    });
  } catch (error) {
    console.error('[BOOKINGS_INBOX_LINK] Error:', error);
    res.status(500).json({ error: 'Failed to link booking to conversation' });
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
      { value: 'awaiting_confirm', label: 'Awaiting Confirm' },
      { value: 'creating_booking', label: 'Creating Booking' },
      { value: 'offering_upsells', label: 'Offering Upsells' },
      { value: 'email_collection', label: 'Email Collection' },
      { value: 'booked', label: 'Booked' },
      { value: 'completed', label: 'Completed' },
    ],
  });
});

export default router;
