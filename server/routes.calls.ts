import { Router, Request, Response } from 'express';
import { db } from './db';
import { conversations, appointments, callEvents, customers, messages } from '@shared/schema';
import { desc, eq, and, or, gte, sql } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { normalizePhone } from './phoneValidationMiddleware';

const router = Router();

export function registerCallRoutes(app: Router) {
  // Get active customers (recent contacts + scheduled/pending appointments)
  app.get('/api/calls/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get recent conversations (customers who reached out in last 30 days)
      const recentConversations = await db
        .select({
          id: conversations.id,
          customerName: conversations.customerName,
          customerPhone: conversations.customerPhone,
          lastMessageTime: conversations.lastMessageTime,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.platform, 'sms'),
            gte(conversations.lastMessageTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(conversations.lastMessageTime))
        .limit(20);

      // Get the most recent message for each conversation
      const conversationIds = recentConversations.map(c => c.id);
      const recentMessages = conversationIds.length > 0
        ? await db
            .select({
              conversationId: messages.conversationId,
              content: messages.content,
            })
            .from(messages)
            .where(sql`${messages.conversationId} IN (${sql.join(conversationIds.map(id => sql`${id}`), sql`, `)})`)
            .orderBy(desc(messages.timestamp))
        : [];

      // Create a map of conversation ID to latest message
      const messageMap = new Map<number, string>();
      recentMessages.forEach(msg => {
        if (msg.conversationId && !messageMap.has(msg.conversationId)) {
          messageMap.set(msg.conversationId, msg.content?.substring(0, 60) || '');
        }
      });

      // Get upcoming and pending appointments with customer data
      const upcomingAppointments = await db
        .select({
          id: appointments.id,
          customerId: appointments.customerId,
          scheduledTime: appointments.scheduledTime,
          status: appointments.status,
          serviceType: appointments.serviceType,
          customerName: customers.name,
          customerPhone: customers.phone,
        })
        .from(appointments)
        .leftJoin(customers, eq(appointments.customerId, customers.id))
        .where(
          or(
            eq(appointments.status, 'scheduled'),
            eq(appointments.status, 'pending')
          )
        )
        .orderBy(desc(appointments.scheduledTime))
        .limit(20);

      // Combine and format the data
      const customerList = [
        ...recentConversations.map(conv => ({
          id: conv.id,
          type: 'conversation' as const,
          name: conv.customerName || conv.customerPhone || 'Unknown',
          phone: conv.customerPhone || null,
          lastContact: conv.lastMessageTime,
          status: 'recent_contact',
          preview: messageMap.get(conv.id) || '',
        })),
        ...upcomingAppointments
          .filter(apt => apt.customerPhone) // Only include appointments with customer phone numbers
          .map(apt => ({
            id: apt.id,
            type: 'appointment' as const,
            name: apt.customerName || apt.customerPhone || 'Unknown',
            phone: apt.customerPhone,
            lastContact: apt.scheduledTime,
            status: apt.status,
            preview: apt.serviceType || '',
            scheduledDate: apt.scheduledTime,
          }))
      ];

      // Sort by most recent/upcoming activity
      customerList.sort((a, b) => {
        const aTime = a.lastContact ? new Date(a.lastContact).getTime() : 0;
        const bTime = b.lastContact ? new Date(b.lastContact).getTime() : 0;
        return bTime - aTime;
      });

      res.json({
        customers: customerList.slice(0, 30), // Top 30 most recent - no success wrapper
      });
    } catch (error) {
      console.error('Error fetching active customers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active customers',
      });
    }
  });

  // Get active calls
  app.get('/api/calls/active', requireAuth, async (req: Request, res: Response) => {
    try {
      // TODO: Implement with Twilio Voice SDK
      res.json({
        success: true,
        calls: [], // No active calls until Twilio is configured
      });
    } catch (error) {
      console.error('Error fetching active calls:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active calls',
      });
    }
  });

  // Get recent calls
  app.get('/api/calls/recent', requireAuth, async (req: Request, res: Response) => {
    try {
      // TODO: Fetch from database (calls table)
      res.json({
        success: true,
        calls: [], // Empty until real call data exists
      });
    } catch (error) {
      console.error('Error fetching recent calls:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent calls',
      });
    }
  });

  // Get specific call details
  app.get('/api/calls/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);
      
      // TODO: Fetch from database
      res.json({
        success: true,
        call: {
          id: callId,
          status: 'in-progress',
          from: '+19182820103',
          to: '+19188565711',
          direction: 'outbound',
        },
      });
    } catch (error) {
      console.error('Error fetching call details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch call details',
      });
    }
  });

  // Initiate outbound call
  app.post('/api/calls/initiate', requireAuth, normalizePhone('to', { required: true }), async (req: Request, res: Response) => {
    try {
      const { to } = req.body;

      // Phone number is now validated and normalized to E.164 by middleware
      console.log(`[CALL] Initiating call to ${to}`);

      // TODO: Implement with Twilio Voice SDK
      // Example:
      // const call = await twilioClient.calls.create({
      //   to: to,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   url: 'https://your-app.com/voice/outbound-call'
      // });

      res.status(501).json({
        success: false,
        message: 'Twilio Voice not configured. Please set up Twilio Voice integration to make calls.',
        needsSetup: true,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate call',
      });
    }
  });

  // End call
  app.post('/api/calls/:id/end', requireAuth, async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);

      // TODO: Implement with Twilio Voice SDK
      res.json({
        success: true,
        message: 'Call ended',
      });
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end call',
      });
    }
  });

  // Mute/unmute call
  app.post('/api/calls/:id/mute', requireAuth, async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);
      const { muted } = req.body;

      // TODO: Implement with Twilio Voice SDK
      res.json({
        success: true,
        muted,
      });
    } catch (error) {
      console.error('Error muting call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mute call',
      });
    }
  });

  // Hold/unhold call
  app.post('/api/calls/:id/hold', requireAuth, async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);
      const { held } = req.body;

      // TODO: Implement with Twilio Voice SDK
      res.json({
        success: true,
        held,
      });
    } catch (error) {
      console.error('Error holding call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to hold call',
      });
    }
  });

  // Voicemail routes
  app.get('/api/voicemail/inbox', requireAuth, async (req: Request, res: Response) => {
    try {
      // Fetch all call events with recordings (voicemails)
      const voicemails = await db
        .select()
        .from(callEvents)
        .where(sql`${callEvents.recordingUrl} IS NOT NULL`)
        .orderBy(desc(callEvents.createdAt));

      // Transform to match frontend interface
      const formattedVoicemails = voicemails.map(call => ({
        id: call.id,
        from: call.from,
        duration: call.duration || 0,
        timestamp: call.createdAt?.toISOString() || new Date().toISOString(),
        transcription: call.transcriptionText,
        recordingUrl: call.recordingUrl,
        isNew: call.readAt === null,
      }));

      res.json({
        success: true,
        voicemails: formattedVoicemails,
      });
    } catch (error) {
      console.error('Error fetching voicemails:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch voicemails',
      });
    }
  });

  // Delete voicemail
  app.delete('/api/voicemail/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      await db
        .delete(callEvents)
        .where(eq(callEvents.id, id));

      res.json({
        success: true,
        message: 'Voicemail deleted',
      });
    } catch (error) {
      console.error('Error deleting voicemail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete voicemail',
      });
    }
  });

  // Mark voicemail as read
  app.post('/api/voicemail/:id/mark-read', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      await db
        .update(callEvents)
        .set({ readAt: new Date() })
        .where(eq(callEvents.id, id));

      res.json({
        success: true,
        message: 'Voicemail marked as read',
      });
    } catch (error) {
      console.error('Error marking voicemail as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark voicemail as read',
      });
    }
  });
}
