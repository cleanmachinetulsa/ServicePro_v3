import { Express, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import axios from 'axios';
import { db } from './db';
import { facebookPageTokens, conversations, messageReactions, messages } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import { normalizePhone } from './phoneValidationMiddleware';
import {
  getAllConversations,
  getConversationById,
  getOrCreateConversation,
  addMessage,
  takeoverConversation,
  handoffConversation,
  updateBehaviorSettings,
  pauseConversation,
  resumeConversation,
  closeConversation,
} from './conversationService';

/**
 * Register conversation monitoring routes
 */
export function registerConversationRoutes(app: Express) {
  // Apply authentication middleware to all conversation routes
  app.use('/api/conversations*', requireAuth);
  // Create a new conversation (from Messages UI)
  // Phone validation happens via conditional middleware below
  app.post('/api/conversations/create', async (req: Request, res: Response, next: NextFunction) => {
    const { platform } = req.body;
    
    // Apply phone normalization only for SMS platform
    if (platform === 'sms') {
      return normalizePhone('phone', { required: true })(req, res, () => {
        handleConversationCreate(req, res);
      });
    }
    
    // For other platforms, skip phone validation
    handleConversationCreate(req, res);
  });

  // Separated handler for conversation creation logic
  async function handleConversationCreate(req: Request, res: Response) {
    try {
      const { phone, email, socialId, name, platform, phoneLineId } = req.body;

      if (platform === 'sms') {
        // Phone is already validated and normalized to E.164 by middleware
        const conversation = await getOrCreateConversation(
          phone,
          name || null,
          'sms',
          undefined, // facebookSenderId
          undefined, // facebookPageId
          undefined, // emailAddress
          undefined, // emailThreadId
          undefined, // emailSubject
          phoneLineId // Pass phoneLineId for SMS
        );

        res.json({
          success: true,
          conversation,
          message: 'SMS conversation created successfully',
        });
      } else if (platform === 'email') {
        if (!email) {
          return res.status(400).json({
            success: false,
            message: 'Email is required for email conversations',
          });
        }

        const conversation = await getOrCreateConversation(
          email,
          name || null,
          'email'
        );

        res.json({
          success: true,
          conversation,
          message: 'Email conversation created successfully',
        });
      } else if (platform === 'facebook' || platform === 'instagram') {
        if (!socialId) {
          return res.status(400).json({
            success: false,
            message: `${platform} user ID is required`,
          });
        }

        const conversation = await getOrCreateConversation(
          socialId,
          name || null,
          platform
        );

        res.json({
          success: true,
          conversation,
          message: `${platform} conversation created successfully`,
        });
      } else if (platform === 'web') {
        const identifier = phone || email || `web-${Date.now()}`;
        
        const conversation = await getOrCreateConversation(
          identifier,
          name || null,
          'web'
        );

        res.json({
          success: true,
          conversation,
          message: 'Web conversation created successfully',
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid platform specified',
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get all conversations
  app.get('/api/conversations', async (req: Request, res: Response) => {
    try {
      const { status, phoneLineId } = req.query;
      const phoneLineIdNum = phoneLineId ? parseInt(phoneLineId as string) : undefined;
      const conversations = await getAllConversations(status as string, phoneLineIdNum);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversations',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get conversation by ID with paginated message history
  app.get('/api/conversations/:id', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { before, limit } = req.query;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      // Parse pagination parameters
      const options: { before?: Date; limit?: number } = {};
      if (before && typeof before === 'string') {
        options.before = new Date(before);
      }
      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          options.limit = limitNum;
        }
      }

      const conversation = await getConversationById(conversationId, options);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error('Error getting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Take over conversation (switch to manual mode)
  app.post('/api/conversations/:id/takeover', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentUsername } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      if (!agentUsername) {
        return res.status(400).json({
          success: false,
          message: 'Agent username is required',
        });
      }

      const conversation = await takeoverConversation(conversationId, agentUsername);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation taken over successfully',
      });
    } catch (error) {
      console.error('Error taking over conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to take over conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Hand off conversation back to AI
  app.post('/api/conversations/:id/handoff', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await handoffConversation(conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation handed off to AI successfully',
      });
    } catch (error) {
      console.error('Error handing off conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to hand off conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update behavior settings
  app.patch('/api/conversations/:id/behavior', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const behaviorSettings = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await updateBehaviorSettings(conversationId, behaviorSettings);

      res.json({
        success: true,
        data: conversation,
        message: 'Behavior settings updated successfully',
      });
    } catch (error) {
      console.error('Error updating behavior settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update behavior settings',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Pause conversation
  app.post('/api/conversations/:id/pause', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await pauseConversation(conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation paused successfully',
      });
    } catch (error) {
      console.error('Error pausing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pause conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Resume conversation
  app.post('/api/conversations/:id/resume', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await resumeConversation(conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation resumed successfully',
      });
    } catch (error) {
      console.error('Error resuming conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resume conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Close conversation
  app.post('/api/conversations/:id/close', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await closeConversation(conversationId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation closed successfully',
      });
    } catch (error) {
      console.error('Error closing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to close conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Send manual message as agent
  app.post('/api/conversations/:id/send-message', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, channel, attachments = [], phoneLineId } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      // Allow empty content if attachments are present
      if ((!content || !content.trim()) && attachments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Either message content or attachments are required',
        });
      }

      // Get conversation to find customer phone
      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Replace template variables with actual data
      const { replaceTemplateVariables } = await import('./templateVariableService');
      const processedContent = await replaceTemplateVariables(content, {
        conversationId,
        operatorName: req.body.operatorName || 'agent',
        userId: (req as any).session?.userId, // Pass authenticated user ID for operator name lookup
      });

      // Deliver message to customer based on channel BEFORE saving to database
      if (conversation.platform === 'sms') {
        // Check if customer has opted out of SMS
        const { isOptedOut } = await import('./smsConsentService');
        const optedOut = await isOptedOut(conversationId);
        
        if (optedOut) {
          return res.status(403).json({
            success: false,
            message: 'Customer has opted out of SMS messages',
            details: 'This customer replied STOP and cannot receive SMS messages. They must send START to opt back in.',
          });
        }
        
        // Check if Twilio is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
          return res.status(500).json({
            success: false,
            message: 'SMS delivery is not configured. Missing Twilio credentials.',
          });
        }

        // Send via Twilio for SMS
        try {
          if (!conversation.customerPhone) {
            return res.status(400).json({
              success: false,
              message: 'No customer phone number available for SMS delivery',
            });
          }

          // Use sendSMS from notifications to handle phone line properly
          const { sendSMS } = await import('./notifications');
          await sendSMS(
            conversation.customerPhone,
            processedContent,
            conversationId,
            undefined,
            phoneLineId || conversation.phoneLineId || undefined
          );
          
          console.log(`[SMS SEND SUCCESS] Manual message sent via SMS to ${conversation.customerPhone} using phone line ${phoneLineId || conversation.phoneLineId || 'default'}`);
        } catch (smsError: any) {
          console.error('[SMS SEND ERROR] Failed to deliver SMS:', {
            conversationId,
            customerPhone: conversation.customerPhone,
            error: smsError.message || String(smsError),
            errorCode: smsError.code,
            errorStatus: smsError.status,
            phoneLineId: phoneLineId || conversation.phoneLineId,
          });
          return res.status(500).json({
            success: false,
            message: 'Failed to deliver SMS message',
            error: smsError.message || String(smsError),
            errorCode: smsError.code,
            details: 'The message was not sent to the customer. Please try again or contact them via another channel.',
          });
        }
      } else if (conversation.platform === 'facebook' || conversation.platform === 'instagram') {
        // Send via Facebook/Instagram Messenger
        try {
          if (!conversation.facebookSenderId || !conversation.facebookPageId) {
            return res.status(400).json({
              success: false,
              message: 'No Facebook sender ID or page ID available for message delivery',
            });
          }

          // Get page access token
          const pageTokens = await db
            .select()
            .from(facebookPageTokens)
            .where(eq(facebookPageTokens.pageId, conversation.facebookPageId));

          if (pageTokens.length === 0 || !pageTokens[0].isActive) {
            return res.status(404).json({
              success: false,
              message: 'Facebook page not configured or inactive',
            });
          }

          const accessToken = pageTokens[0].pageAccessToken;

          // Send message via Facebook Graph API
          const response = await axios.post(
            `https://graph.facebook.com/v18.0/me/messages`,
            {
              recipient: { id: conversation.facebookSenderId },
              message: { text: processedContent },
              messaging_type: 'RESPONSE', // Required for agent replies
            },
            {
              params: { access_token: accessToken },
            }
          );

          // Log success for debugging
          console.log(`[Facebook API] Message sent successfully:`, response.data);

          console.log(`Manual message sent via ${conversation.platform} to ${conversation.facebookSenderId}`);
        } catch (fbError: any) {
          console.error('Error sending Facebook/Instagram message:', fbError);
          return res.status(500).json({
            success: false,
            message: 'Failed to deliver message via Facebook/Instagram',
            error: fbError.response?.data || fbError.message || String(fbError),
            details: 'The message was not sent to the customer. Please try again or contact them via another channel.',
          });
        }
      }

      // Save message to database after successful delivery (or for web chat)
      const messageMetadata = attachments.length > 0 ? { attachments } : null;
      let message;
      
      try {
        message = await addMessage(
          conversationId, 
          processedContent || '', 
          'agent', 
          channel || 'web',
          messageMetadata,
          phoneLineId || conversation.phoneLineId || undefined
        );
        // For web chat, the message is broadcast via WebSocket in addMessage
      } catch (dbError: any) {
        // CRITICAL ERROR: Database save failed - this is unacceptable
        console.error('[MESSAGE DB SAVE ERROR] CRITICAL: Message was delivered but failed to save to database:', {
          conversationId,
          error: dbError.message || String(dbError),
          platform: conversation.platform,
          stack: dbError.stack,
        });
        
        // Log as CRITICAL error - triggers SMS alert to business owner
        try {
          const { logError } = await import('./errorMonitoring');
          await logError({
            type: 'database',
            severity: 'critical',
            message: `Database save failed for delivered message (conversation ${conversationId})`,
            endpoint: req.path,
            metadata: {
              conversationId,
              platform: conversation.platform,
              errorMessage: dbError.message || String(dbError),
              errorStack: dbError.stack,
              messageContent: processedContent ? processedContent.substring(0, 100) : '[no text content]',
            },
          });
        } catch (logErr) {
          console.error('[MESSAGE DB SAVE ERROR] Failed to log critical error:', logErr);
        }
        
        // If message was sent via SMS/Facebook/Instagram, return success=false but 200 status
        // This ensures Twilio doesn't retry, but UI knows there was a problem
        if (conversation.platform !== 'web') {
          return res.status(200).json({
            success: false,
            data: null,
            message: 'Message delivered but database save failed',
            error: 'Database save failed - message history may be incomplete',
            details: conversation.platform === 'sms' 
              ? 'Message sent via SMS but not saved to database. Technical team has been notified.'
              : conversation.platform === 'facebook'
              ? 'Message sent via Facebook Messenger but not saved to database. Technical team has been notified.'
              : conversation.platform === 'instagram'
              ? 'Message sent via Instagram DM but not saved to database. Technical team has been notified.'
              : 'Message sent but not saved to database. Technical team has been notified.',
          });
        }
        
        // For web chat, database save is critical since there's no external delivery
        throw dbError;
      }

      res.json({
        success: true,
        data: message,
        message: conversation.platform === 'sms' 
          ? 'Message sent successfully via SMS'
          : conversation.platform === 'facebook'
          ? 'Message sent successfully via Facebook Messenger'
          : conversation.platform === 'instagram'
          ? 'Message sent successfully via Instagram DM'
          : 'Message sent successfully',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get messages for a conversation
  app.get('/api/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await getConversationById(conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation.messages || [],
      });
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get AI reply suggestions for a conversation
  app.get('/api/conversations/:id/suggestions', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const conversation = await getConversationById(conversationId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Generate AI suggestions
      const { generateReplySuggestions } = await import('./aiSuggestionService');
      const suggestions = await generateReplySuggestions(
        conversationId,
        conversation.customerPhone || '',
        conversation.messages || [],
        conversation.platform as 'sms' | 'web'
      );

      res.json({
        success: true,
        suggestions,
      });
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate AI suggestions',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Return conversation to AI mode
  app.post('/api/conversations/:id/return-to-ai', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentName, notifyCustomer } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const { returnToAI } = await import('./handoffDetectionService');
      const { notifyReturnToAI } = await import('./smsNotificationService');
      const { sendSMS } = await import('./notifications');

      const conversation = await getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      // Return to AI
      const customerNotification = await returnToAI(conversationId, agentName, notifyCustomer !== false);

      // Send notification to customer if requested and on SMS
      if (notifyCustomer !== false && conversation.platform === 'sms' && customerNotification && conversation.customerPhone) {
        // Use the conversation's phoneLineId if available, otherwise default to Main Line
        await sendSMS(conversation.customerPhone, customerNotification, conversationId, undefined, conversation.phoneLineId || 1);
      }

      // Notify business owner
      await notifyReturnToAI(
        conversationId,
        conversation.customerName,
        conversation.customerPhone || 'Unknown',
        agentName
      );

      res.json({
        success: true,
        message: 'Conversation returned to AI',
      });
    } catch (error) {
      console.error('Error returning to AI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to return conversation to AI',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark conversation as read (reset unread count)
  app.post('/api/conversations/:id/mark-read', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await db
        .update(conversations)
        .set({ unreadCount: 0 })
        .where(eq(conversations.id, conversationId))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: updated[0],
        message: 'Conversation marked as read',
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark conversation as read',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark specific messages as read (iMessage-quality read receipts)
  app.post('/api/conversations/:id/messages/read', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { messageIds, readerRole } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'messageIds array is required and must not be empty',
        });
      }

      if (!readerRole || !['agent', 'customer'].includes(readerRole)) {
        return res.status(400).json({
          success: false,
          message: 'readerRole must be either "agent" or "customer"',
        });
      }

      // Get messages to determine which ones weren't authored by the reader
      const messagesToCheck = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            inArray(messages.id, messageIds)
          )
        );

      if (messagesToCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No messages found',
        });
      }

      // Filter out messages authored by the reader (agents don't mark their own messages as read)
      const messagesToMarkAsRead = messagesToCheck.filter(msg => {
        if (readerRole === 'agent') {
          // Agents mark customer messages as read
          return msg.sender === 'customer';
        } else {
          // Customers mark agent/AI messages as read
          return msg.sender === 'agent' || msg.sender === 'ai';
        }
      });

      if (messagesToMarkAsRead.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No eligible messages to mark as read',
        });
      }

      const readAt = new Date();
      const idsToUpdate = messagesToMarkAsRead.map(m => m.id);

      // Update messages to mark as read
      const updatedMessages = await db
        .update(messages)
        .set({ 
          deliveryStatus: 'read',
          readAt 
        })
        .where(inArray(messages.id, idsToUpdate))
        .returning();

      // Emit WebSocket event for real-time updates
      const { emitToRoom } = await import('./websocketService');
      emitToRoom(`conversation-${conversationId}`, 'messages_read', {
        conversationId,
        messageIds: idsToUpdate,
        reader: {
          role: readerRole
        },
        readAt: readAt.toISOString()
      });

      res.json({
        success: true,
        data: updatedMessages,
        message: `${updatedMessages.length} message(s) marked as read`,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark messages as read',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get available template variables
  app.get('/api/template-variables', async (req: Request, res: Response) => {
    const { AVAILABLE_VARIABLES } = await import('./templateVariableService');
    res.json({
      success: true,
      variables: AVAILABLE_VARIABLES,
    });
  });

  // Assign conversation to agent
  app.post('/api/conversations/:id/assign', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { agentName } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await db
        .update(conversations)
        .set({ assignedAgent: agentName || null })
        .where(eq(conversations.id, conversationId))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: agentName ? `Assigned to ${agentName}` : 'Assignment removed',
      });
    } catch (error) {
      console.error('Error assigning conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Snooze conversation until a specific time
  app.post('/api/conversations/:id/snooze', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { snoozedUntil } = req.body;

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await db
        .update(conversations)
        .set({ snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null })
        .where(eq(conversations.id, conversationId))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: snoozedUntil ? 'Conversation snoozed' : 'Snooze removed',
      });
    } catch (error) {
      console.error('Error snoozing conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to snooze conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Mark conversation as resolved
  app.post('/api/conversations/:id/resolve', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const updated = await db
        .update(conversations)
        .set({ 
          status: 'closed',
          resolved: true,
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      res.json({
        success: true,
        data: updated[0],
        message: 'Conversation marked as resolved',
      });
    } catch (error) {
      console.error('Error resolving conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve conversation',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get call events for a conversation
  app.get('/api/conversations/:id/call-events', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);

      if (isNaN(conversationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID',
        });
      }

      const { getCallEventsForConversation } = await import('./callLoggingService');
      const callEvents = await getCallEventsForConversation(conversationId);

      res.json({
        success: true,
        data: callEvents,
      });
    } catch (error) {
      console.error('Error fetching call events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch call events',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  // Message Reactions API
  // Add a reaction to a message
  app.post('/api/messages/:messageId/reactions', requireAuth, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const user = (req as any).user as { id: number } | undefined;
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      if (!emoji) {
        return res.status(400).json({ success: false, message: 'Emoji is required' });
      }
      
      // Insert reaction (ignore if duplicate due to unique constraint)
      const [reaction] = await db.insert(messageReactions).values({
        messageId: parseInt(messageId),
        userId,
        emoji,
      }).returning().catch((err) => {
        if (err.code === '23505') { // Duplicate key error
          return [null];
        }
        throw err;
      });
      
      res.json({ success: true, reaction });
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ success: false, message: 'Failed to add reaction' });
    }
  });
  
  // Remove a reaction
  app.delete('/api/messages/reactions/:reactionId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { reactionId } = req.params;
      const user = (req as any).user as { id: number } | undefined;
      const userId = user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      
      // Delete reaction (only if it belongs to the user)
      await db.delete(messageReactions).where(
        and(
          eq(messageReactions.id, parseInt(reactionId)),
          eq(messageReactions.userId, userId)
        )
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing reaction:', error);
      res.status(500).json({ success: false, message: 'Failed to remove reaction' });
    }
  });
  
  // Get reactions for a conversation's messages
  app.get('/api/conversations/:conversationId/reactions', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      
      // Get all message IDs for this conversation
      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, parseInt(conversationId)),
        columns: { id: true },
      });
      
      const messageIds = conversationMessages.map(m => m.id);
      
      if (messageIds.length === 0) {
        return res.json({ success: true, reactions: [] });
      }
      
      // Get all reactions for these messages
      const reactions = await db.query.messageReactions.findMany({
        where: inArray(messageReactions.messageId, messageIds),
      });
      
      res.json({ success: true, reactions });
    } catch (error) {
      console.error('Error getting reactions:', error);
      res.status(500).json({ success: false, message: 'Failed to get reactions' });
    }
  });
  
  // Search messages within a conversation
  app.get('/api/conversations/:conversationId/search', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.json({ success: true, results: [] });
      }
      
      const searchTerm = q.trim().toLowerCase();
      
      // Get all messages for this conversation
      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, parseInt(conversationId)),
        orderBy: (messages, { desc }) => [desc(messages.timestamp)],
      });
      
      // Filter messages that contain the search term
      const results = conversationMessages.filter(msg => 
        msg.content.toLowerCase().includes(searchTerm)
      );
      
      res.json({ 
        success: true, 
        results,
        count: results.length 
      });
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to search messages' });
    }
  });
}
