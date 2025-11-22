import { Router, Request, Response } from 'express';
import { db } from './db';
import { facebookPageTokens, conversations, messages } from '@shared/schema';
import { insertFacebookPageTokenSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { getOrCreateConversation, addMessage } from './conversationService';
import { generateAIResponse } from './openai';

const router = Router();

/**
 * Get all configured Facebook pages
 * GET /api/facebook/pages
 */
router.get('/pages', async (req: Request, res: Response) => {
  try {
    const pages = await db
      .select()
      .from(facebookPageTokens)
      .orderBy(facebookPageTokens.createdAt);

    // Don't expose the full access token in the response
    const sanitizedPages = pages.map(page => ({
      ...page,
      pageAccessToken: page.pageAccessToken ? '***HIDDEN***' : null,
    }));

    res.json({ success: true, pages: sanitizedPages });
  } catch (error) {
    console.error('[FACEBOOK] Error fetching pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Facebook pages',
    });
  }
});

/**
 * Add a new Facebook page
 * POST /api/facebook/pages
 */
router.post('/pages', async (req: Request, res: Response) => {
  try {
    const validatedData = insertFacebookPageTokenSchema.parse(req.body);

    // Test the access token before saving
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${validatedData.pageId}`,
        {
          params: { access_token: validatedData.pageAccessToken },
        }
      );

      console.log('[FACEBOOK] ✅ Page token validated:', response.data.name);
    } catch (error) {
      console.error('[FACEBOOK] ❌ Invalid page token:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid Facebook page access token',
      });
    }

    const newPage = await db
      .insert(facebookPageTokens)
      .values(validatedData)
      .returning();

    res.json({ success: true, page: newPage[0] });
  } catch (error) {
    console.error('[FACEBOOK] Error adding page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add Facebook page',
    });
  }
});

/**
 * Update Facebook page settings
 * PUT /api/facebook/pages/:id
 */
router.put('/pages/:id', async (req: Request, res: Response) => {
  try {
    const pageId = parseInt(req.params.id);
    const validatedData = insertFacebookPageTokenSchema.partial().parse(req.body);

    const updatedPage = await db
      .update(facebookPageTokens)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(facebookPageTokens.id, pageId))
      .returning();

    if (updatedPage.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({ success: true, page: updatedPage[0] });
  } catch (error) {
    console.error('[FACEBOOK] Error updating page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update page',
    });
  }
});

/**
 * Delete Facebook page
 * DELETE /api/facebook/pages/:id
 */
router.delete('/pages/:id', async (req: Request, res: Response) => {
  try {
    const pageId = parseInt(req.params.id);

    const deleted = await db
      .delete(facebookPageTokens)
      .where(eq(facebookPageTokens.id, pageId))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[FACEBOOK] Error deleting page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete page',
    });
  }
});

/**
 * Facebook Messenger Webhook Verification
 * GET /api/facebook/webhook
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // You'll set a verify token in your Facebook App settings
  const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'clean_machine_verify_token_2025';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[FACEBOOK WEBHOOK] ✅ Webhook verified!');
    res.status(200).send(challenge);
  } else {
    console.log('[FACEBOOK WEBHOOK] ❌ Verification failed');
    res.sendStatus(403);
  }
});

/**
 * Facebook Messenger Webhook - Receive Messages
 * POST /api/facebook/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    console.log('[FACEBOOK WEBHOOK] Received webhook:', JSON.stringify(body, null, 2));

    // Check if this is a page subscription
    if (body.object === 'page') {
      // Process webhooks asynchronously (return 200 immediately to Facebook)
      res.status(200).send('EVENT_RECEIVED');

      // Iterate over each entry
      for (const entry of body.entry) {
        // Get the webhook event
        const webhookEvent = entry.messaging?.[0];
        
        if (!webhookEvent) continue;

        const senderId = webhookEvent.sender.id;
        const pageId = webhookEvent.recipient.id;
        
        // Handle messages
        if (webhookEvent.message && !webhookEvent.message.is_echo) {
          const messageText = webhookEvent.message.text;
          const messageId = webhookEvent.message.mid;

          console.log('[FACEBOOK] 📩 New message from:', senderId);
          console.log('[FACEBOOK] Message:', messageText);

          try {
            // Get page info to determine platform
            const pageInfo = await db
              .select()
              .from(facebookPageTokens)
              .where(eq(facebookPageTokens.pageId, pageId))
              .limit(1);

            if (!pageInfo || pageInfo.length === 0 || !pageInfo[0].isActive) {
              console.log('[FACEBOOK] ⚠️ Page not configured or inactive:', pageId);
              continue;
            }

            const platform = pageInfo[0].platform;
            const accessToken = pageInfo[0].pageAccessToken;

            // Get sender's name from Facebook Graph API
            let senderName = 'Facebook User';
            try {
              const userInfoResponse = await axios.get(
                `https://graph.facebook.com/v18.0/${senderId}`,
                {
                  params: { 
                    fields: 'first_name,last_name',
                    access_token: accessToken 
                  },
                }
              );
              const firstName = userInfoResponse.data.first_name || '';
              const lastName = userInfoResponse.data.last_name || '';
              senderName = `${firstName} ${lastName}`.trim() || 'Facebook User';
            } catch (error) {
              console.warn('[FACEBOOK] Could not fetch user info:', error);
            }

            // Create or get conversation
            const { conversation } = await getOrCreateConversation(
              req.tenantDb!,
              '', // No phone number for Facebook
              senderName,
              platform as 'facebook' | 'instagram',
              senderId,
              pageId
            );

            // Add customer message to conversation
            await addMessage(
              req.tenantDb!,
              conversation.id,
              messageText,
              'customer',
              platform as 'facebook' | 'instagram'
            );

            console.log('[FACEBOOK] ✅ Message saved to conversation:', conversation.id);

            // Only generate AI response if conversation is in auto mode
            if (conversation.controlMode === 'auto') {
              // Generate AI response (Facebook doesn't have phone numbers, use sender ID)
              const aiResponse = await generateAIResponse(
                messageText,
                senderId, // Use sender ID instead of phone
                platform as 'sms' | 'web', // Map to existing platform types for AI
                conversation.behaviorSettings as any
              );

              // Send AI response back to Facebook
              if (aiResponse && aiResponse.message) {
                try {
                  const fbResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/me/messages`,
                    {
                      recipient: { id: senderId },
                      message: { text: aiResponse.message },
                      messaging_type: 'RESPONSE', // Required for agent/AI replies
                    },
                    {
                      params: { access_token: accessToken },
                    }
                  );

                  console.log('[FACEBOOK API] ✅ Message sent successfully:', fbResponse.data);

                  // Save AI response to conversation
                  await addMessage(
                    req.tenantDb!,
                    conversation.id,
                    aiResponse.message,
                    'ai',
                    platform as 'facebook' | 'instagram'
                  );

                  console.log('[FACEBOOK] 🤖 AI response sent:', aiResponse.message);
                } catch (sendError: any) {
                  console.error('[FACEBOOK API] ❌ Failed to send AI response:', sendError.response?.data || sendError.message);
                  // Still save the message to database even if sending failed (for debugging)
                  await addMessage(
                    req.tenantDb!,
                    conversation.id,
                    `[Failed to send] ${aiResponse.message}`,
                    'ai',
                    platform as 'facebook' | 'instagram'
                  );
                }
              }
            } else {
              console.log('[FACEBOOK] ⏸️ Conversation in manual mode, skipping AI response');
            }
          } catch (error) {
            console.error('[FACEBOOK] Error processing message:', error);
          }
        }
      }
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('[FACEBOOK WEBHOOK] Error processing webhook:', error);
    res.status(500).send('ERROR');
  }
});

/**
 * Send message to Facebook Messenger
 * POST /api/facebook/send-message
 */
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { recipientId, message, pageId } = req.body;

    if (!recipientId || !message || !pageId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId, message, and pageId are required',
      });
    }

    // Get page access token
    const pageTokens = await db
      .select()
      .from(facebookPageTokens)
      .where(eq(facebookPageTokens.pageId, pageId));

    if (pageTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facebook page not configured',
      });
    }

    const accessToken = pageTokens[0].pageAccessToken;

    // Send message via Facebook Graph API
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE', // Required for Facebook Send API
      },
      {
        params: { access_token: accessToken },
      }
    );

    console.log('[FACEBOOK API] ✅ Message sent successfully:', response.data);

    res.json({
      success: true,
      messageId: response.data.message_id,
    });
  } catch (error: any) {
    console.error('[FACEBOOK] ❌ Failed to send message:', error.response?.data || error);
    res.status(500).json({
      success: false,
      message: 'Failed to send Facebook message',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
