import { Router, Request, Response } from 'express';
import { conversations, appointments, callEvents, customers, messages } from '@shared/schema';
import { desc, eq, and, or, gte, sql } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { normalizePhone } from './phoneValidationMiddleware';
import { isVoiceConfiguredForTenant, getVoiceDiagnostics } from './services/voiceConfigService';

const router = Router();

export function registerCallRoutes(app: Router) {
  // Voice configuration status endpoint
  app.get('/api/voice/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || 'root';
      const status = await isVoiceConfiguredForTenant(tenantId);
      
      res.json({
        success: true,
        isConfigured: status.isConfigured,
        errors: status.errors,
        warnings: status.warnings,
      });
    } catch (error) {
      console.error('[VOICE STATUS] Error checking voice configuration:', error);
      res.status(500).json({
        success: false,
        isConfigured: false,
        message: 'Failed to check voice configuration',
      });
    }
  });

  // Voice diagnostics endpoint (admin only)
  app.get('/api/voice/diagnostics', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user?.role !== 'owner' && user?.role !== 'manager') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      const tenantId = (req as any).tenantId || 'root';
      const diagnostics = await getVoiceDiagnostics(tenantId);
      
      res.json({
        success: true,
        diagnostics,
      });
    } catch (error) {
      console.error('[VOICE DIAGNOSTICS] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get voice diagnostics',
      });
    }
  });

  // Get active customers (recent contacts + scheduled/pending appointments)
  app.get('/api/calls/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get recent conversations (customers who reached out in last 30 days)
      const recentConversations = await req.tenantDb!
        .select({
          id: conversations.id,
          customerName: conversations.customerName,
          customerPhone: conversations.customerPhone,
          lastMessageTime: conversations.lastMessageTime,
        })
        .from(conversations)
        .where(
          req.tenantDb!.withTenantFilter(conversations,
            and(
              eq(conversations.platform, 'sms'),
              gte(conversations.lastMessageTime, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            )
          )
        )
        .orderBy(desc(conversations.lastMessageTime))
        .limit(20);

      // Get the most recent message for each conversation
      const conversationIds = recentConversations.map(c => c.id);
      const recentMessages = conversationIds.length > 0
        ? await req.tenantDb!
            .select({
              conversationId: messages.conversationId,
              content: messages.content,
            })
            .from(messages)
            .where(req.tenantDb!.withTenantFilter(messages, sql`${messages.conversationId} IN (${sql.join(conversationIds.map(id => sql`${id}`), sql`, `)})`))
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
      const upcomingAppointments = await req.tenantDb!
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
          req.tenantDb!.withTenantFilter(appointments,
            or(
              eq(appointments.status, 'scheduled'),
              eq(appointments.status, 'pending')
            )
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
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        // No Twilio configured - return empty array
        return res.json({
          success: true,
          calls: [],
        });
      }

      // Query Twilio for active calls (in-progress status)
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      const activeCalls = await client.calls.list({
        status: 'in-progress',
        limit: 20,
      });

      // Format for frontend
      const formattedCalls = activeCalls.map(call => ({
        callSid: call.sid,
        direction: call.direction,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        timestamp: call.dateCreated?.toISOString() || new Date().toISOString(),
      }));

      res.json({
        success: true,
        calls: formattedCalls,
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
      // Fetch recent calls from database (last 50 calls)
      const recentCalls = await req.tenantDb!
        .select()
        .from(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents))
        .orderBy(desc(callEvents.createdAt))
        .limit(50);

      // Format for frontend
      const formattedCalls = recentCalls.map(call => ({
        id: call.id,
        callSid: call.callSid,
        direction: call.direction,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        timestamp: call.createdAt?.toISOString() || new Date().toISOString(),
        recordingUrl: call.recordingUrl,
        transcriptionText: call.transcriptionText,
        answeredBy: call.answeredBy,
      }));

      res.json({
        success: true,
        calls: formattedCalls,
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
      
      // Fetch call details from database
      const [call] = await req.tenantDb!
        .select()
        .from(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.id, callId)))
        .limit(1);

      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found',
        });
      }

      // Format for frontend
      res.json({
        success: true,
        call: {
          id: call.id,
          callSid: call.callSid,
          direction: call.direction,
          from: call.from,
          to: call.to,
          status: call.status,
          duration: call.duration,
          recordingUrl: call.recordingUrl,
          recordingSid: call.recordingSid,
          transcriptionText: call.transcriptionText,
          transcriptionStatus: call.transcriptionStatus,
          answeredBy: call.answeredBy,
          price: call.price,
          priceUnit: call.priceUnit,
          timestamp: call.createdAt?.toISOString() || new Date().toISOString(),
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
      const userId = (req as any).user?.id;
      const userEmail = (req as any).user?.username;
      
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.MAIN_PHONE_NUMBER;
      const businessPhone = process.env.BUSINESS_OWNER_PERSONAL_PHONE;

      // Safety check: prevent calling business numbers
      const businessNumbers = [
        businessPhone?.replace(/\D/g, ''),
        twilioPhone?.replace(/\D/g, ''),
        '9188565711', // Main line
        '9182820103', // Emergency line
      ].filter(Boolean);
      
      const toNormalized = to.replace(/\D/g, '');
      if (businessNumbers.includes(toNormalized)) {
        console.warn(`[CALL SAFETY] Admin ${userEmail} (${userId}) attempted to call business number ${to}`);
        return res.status(400).json({
          success: false,
          message: 'Cannot initiate call to business phone numbers. This would create a call loop.',
        });
      }

      if (!accountSid || !authToken || !twilioPhone || !businessPhone) {
        console.error('[CALL] Missing Twilio credentials');
        return res.status(503).json({
          success: false,
          message: 'Phone service temporarily unavailable. Please try again or contact support.',
        });
      }

      // Get public base URL for TwiML callbacks
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_URL || 'https://cleanmachine.app';

      if (!baseUrl) {
        return res.status(503).json({
          success: false,
          message: 'Service configuration error. Please contact support.',
        });
      }

      console.log(`[CALL INITIATE] Admin ${userEmail} (ID: ${userId}) initiating click-to-call to ${to}`);

      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      // Create TwiML URL for connecting to customer
      const twimlUrl = `${baseUrl}/api/voice/connect-customer?phone=${encodeURIComponent(to)}`;

      // Initiate call to business phone first (will then connect to customer)
      const call = await client.calls.create({
        from: twilioPhone,
        to: businessPhone,
        url: twimlUrl,
        statusCallback: `${baseUrl}/api/voice/click-to-call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      console.log(`[CALL SUCCESS] Admin ${userEmail} initiated CallSid ${call.sid}, connecting ${businessPhone} to ${to}`);

      // Log the outbound call with admin user info and customer phone for bridge preservation
      try {
        const { logCallEvent } = await import('./callLoggingService');
        await logCallEvent(req.tenantDb!, {
          callSid: call.sid,
          direction: 'outbound',
          from: twilioPhone,
          to: to,
          customerPhone: to, // Store customer phone for mute/hold operations
          status: 'initiated',
        });
        
        // Log to audit table
        await req.tenantDb!.insert(await import('@shared/schema').then(s => s.auditLog)).values({
          userId: userId || null,
          action: 'click_to_call_initiated',
          entityType: 'call',
          entityId: call.sid,
          metadata: { 
            customerPhone: to,
            adminEmail: userEmail 
          },
        });
      } catch (error) {
        console.error('[CALL] Failed to log call event:', error);
        // Don't fail the call if logging fails
      }

      res.json({ 
        success: true, 
        callSid: call.sid,
        message: 'Call initiated successfully - you will receive a call shortly'
      });
    } catch (error: any) {
      console.error(`[CALL ERROR] Failed to initiate call to ${req.body.to}:`, error);
      
      // Provide better error messages based on error type
      let userMessage = 'Failed to initiate call. Please try again.';
      
      if (error.code === 21211) {
        userMessage = 'Invalid phone number format. Please check the number and try again.';
      } else if (error.code === 20429) {
        userMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
      } else if (error.message?.includes('authentication')) {
        userMessage = 'Phone service authentication error. Please contact support.';
      } else if (error.message?.includes('timeout')) {
        userMessage = 'Call request timed out. Please check your connection and try again.';
      }
      
      res.status(500).json({
        success: false,
        message: userMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // End call
  app.post('/api/calls/:id/end', requireAuth, async (req: Request, res: Response) => {
    try {
      const callSid = req.params.id; // This is the Twilio CallSid, not database ID

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res.status(503).json({
          success: false,
          message: 'Phone service not configured',
        });
      }

      // Use Twilio API to end the call
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      await client.calls(callSid).update({ status: 'completed' });

      console.log(`[CALL END] Call ${callSid} terminated by admin`);

      res.json({
        success: true,
        message: 'Call ended successfully',
      });
    } catch (error: any) {
      console.error('Error ending call:', error);
      
      let userMessage = 'Failed to end call';
      if (error.code === 20404) {
        userMessage = 'Call not found or already ended';
      }

      res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  });

  // Mute/unmute call
  app.post('/api/calls/:id/mute', requireAuth, async (req: Request, res: Response) => {
    try {
      const callSid = req.params.id; // This is the Twilio CallSid
      const { muted } = req.body;

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res.status(503).json({
          success: false,
          message: 'Phone service not configured',
        });
      }

      // Fetch customer phone from database (stored during call logging)
      const [callEvent] = await req.tenantDb!
        .select({ customerPhone: callEvents.customerPhone })
        .from(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.callSid, callSid)))
        .limit(1);

      if (!callEvent?.customerPhone) {
        console.error(`[CALL MUTE] No customerPhone found for CallSid ${callSid}`);
        return res.status(404).json({
          success: false,
          message: 'Call not found or customer phone missing',
        });
      }

      const customerPhone = callEvent.customerPhone;

      // Use Twilio API to mute/unmute via TwiML update
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      // Get public base URL for TwiML callbacks
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_URL || 'https://cleanmachine.app';

      // TwiML URL for mute (silence) or unmute (reconnect with customer phone)
      const twimlUrl = muted
        ? `${baseUrl}/api/voice/mute-call`
        : `${baseUrl}/api/voice/unmute-call?phone=${encodeURIComponent(customerPhone)}`;

      await client.calls(callSid).update({ url: twimlUrl });

      console.log(`[CALL ${muted ? 'MUTE' : 'UNMUTE'}] Call ${callSid} ${muted ? 'muted' : 'unmuted'}`);

      res.json({
        success: true,
        muted,
        message: muted ? 'Call muted' : 'Call unmuted',
      });
    } catch (error: any) {
      console.error('Error muting call:', error);
      
      let userMessage = 'Failed to mute call';
      if (error.code === 20404) {
        userMessage = 'Call not found or already ended';
      }

      res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  });

  // Hold/unhold call
  app.post('/api/calls/:id/hold', requireAuth, async (req: Request, res: Response) => {
    try {
      const callSid = req.params.id; // This is the Twilio CallSid
      const { held } = req.body;

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        return res.status(503).json({
          success: false,
          message: 'Phone service not configured',
        });
      }

      // Fetch customer phone from database (stored during call logging)
      const [callEvent] = await req.tenantDb!
        .select({ customerPhone: callEvents.customerPhone })
        .from(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.callSid, callSid)))
        .limit(1);

      if (!callEvent?.customerPhone) {
        console.error(`[CALL HOLD] No customerPhone found for CallSid ${callSid}`);
        return res.status(404).json({
          success: false,
          message: 'Call not found or customer phone missing',
        });
      }

      const customerPhone = callEvent.customerPhone;

      // Use Twilio API to update call with hold music or resume
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      // Get public base URL for TwiML callbacks
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_URL || 'https://cleanmachine.app';

      // TwiML URL for hold music or resume (with customer phone for reconnection)
      const twimlUrl = held 
        ? `${baseUrl}/api/voice/hold-music`
        : `${baseUrl}/api/voice/resume-call?phone=${encodeURIComponent(customerPhone)}`;

      await client.calls(callSid).update({ url: twimlUrl });

      console.log(`[CALL ${held ? 'HOLD' : 'RESUME'}] Call ${callSid} ${held ? 'on hold' : 'resumed'}`);

      res.json({
        success: true,
        held,
        message: held ? 'Call placed on hold' : 'Call resumed',
      });
    } catch (error: any) {
      console.error('Error holding call:', error);
      
      let userMessage = 'Failed to hold call';
      if (error.code === 20404) {
        userMessage = 'Call not found or already ended';
      }

      res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  });

  // Voicemail routes
  app.get('/api/voicemail/inbox', requireAuth, async (req: Request, res: Response) => {
    try {
      // Fetch all call events with recordings (voicemails)
      const voicemails = await req.tenantDb!
        .select()
        .from(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents, sql`${callEvents.recordingUrl} IS NOT NULL`))
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

      await req.tenantDb!
        .delete(callEvents)
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.id, id)));

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

      await req.tenantDb!
        .update(callEvents)
        .set({ readAt: new Date() })
        .where(req.tenantDb!.withTenantFilter(callEvents, eq(callEvents.id, id)));

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
