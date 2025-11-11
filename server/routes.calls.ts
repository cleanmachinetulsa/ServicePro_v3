import { Router, Request, Response } from 'express';
import { db } from './db';
import { conversations, appointments } from '@shared/schema';
import { desc, eq, and, or, gte } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { normalizePhone } from './phoneValidationMiddleware';

const router = Router();

export function registerCallRoutes(app: Router) {
  // Get active customers (recent contacts + scheduled/pending appointments)
  app.get('/api/calls/customers', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get recent conversations (customers who reached out in last 30 days)
      const recentConversations = await db.query.conversations.findMany({
        where: and(
          eq(conversations.platform, 'sms'),
          gte(conversations.lastMessageAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        ),
        orderBy: [desc(conversations.lastMessageAt)],
        limit: 20,
        with: {
          messages: {
            limit: 1,
            orderBy: (messages, { desc }) => [desc(messages.timestamp)],
          }
        }
      });

      // Get upcoming and pending appointments
      const upcomingAppointments = await db.query.appointments.findMany({
        where: or(
          eq(appointments.status, 'scheduled'),
          eq(appointments.status, 'pending')
        ),
        orderBy: [desc(appointments.scheduledFor)],
        limit: 20
      });

      // Combine and format the data
      const customers = [
        ...recentConversations.map(conv => ({
          id: conv.id,
          type: 'conversation' as const,
          name: conv.customerName || conv.phoneNumber || 'Unknown',
          phone: conv.phoneNumber || null,
          lastContact: conv.lastMessageAt,
          status: 'recent_contact',
          preview: conv.messages[0]?.content?.substring(0, 60) || '',
        })),
        ...upcomingAppointments
          .filter(apt => apt.phoneNumber) // Only include appointments with phone numbers
          .map(apt => ({
            id: apt.id,
            type: 'appointment' as const,
            name: apt.customerName || apt.phoneNumber || 'Unknown',
            phone: apt.phoneNumber,
            lastContact: apt.scheduledFor || apt.createdAt, // Use scheduled time for sorting
            status: apt.status,
            preview: apt.serviceType || '',
            scheduledDate: apt.scheduledFor,
          }))
      ];

      // Sort by most recent/upcoming activity (appointments by scheduledFor, conversations by lastMessageAt)
      customers.sort((a, b) => 
        new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
      );

      res.json({
        customers: customers.slice(0, 30), // Top 30 most recent - no success wrapper
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
      // TODO: Fetch from database (voicemails table)
      res.json({
        success: true,
        voicemails: [],
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

      // TODO: Delete from database
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

      // TODO: Update in database
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
