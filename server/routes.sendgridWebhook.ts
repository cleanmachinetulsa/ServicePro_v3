import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from './db';
import { campaignRecipients, emailSuppressionList } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { json } from 'express';

const router = Router();

/**
 * Raw body middleware for webhook signature verification
 * Captures raw body before JSON parsing so we can verify SendGrid's signature
 */
const rawBodySaver = (req: Request, res: Response, next: NextFunction) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    (req as any).rawBody = data;
    next();
  });
};

/**
 * Verify SendGrid webhook signature
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
function verifySignature(req: Request): boolean {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) {
    console.error('[SENDGRID WEBHOOK] SECURITY: No public key configured - rejecting webhook');
    return false; // Require public key in production
  }
  
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
  
  if (!signature || !timestamp) {
    console.error('[SENDGRID WEBHOOK] Missing signature or timestamp headers');
    return false;
  }
  
  // Verify timestamp is recent (within 10 minutes)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 600) {
    console.error('[SENDGRID WEBHOOK] Timestamp too old or invalid');
    return false;
  }
  
  try {
    // Use raw body for signature verification (SendGrid signs the raw payload)
    const rawBody = (req as any).rawBody || '';
    const payload = timestamp + rawBody;
    
    // Create ECDSA verifier
    const verify = crypto.createVerify('sha256');
    verify.update(payload);
    verify.end();
    
    // Verify signature
    const isValid = verify.verify(publicKey, signature, 'base64');
    if (!isValid) {
      console.error('[SENDGRID WEBHOOK] Invalid signature');
    }
    return isValid;
  } catch (error) {
    console.error('[SENDGRID WEBHOOK] Signature verification error:', error);
    return false;
  }
}

/**
 * SendGrid Event Webhook Handler
 * POST /api/webhooks/sendgrid
 * 
 * IMPORTANT: Uses raw body middleware for signature verification
 */
router.post('/api/webhooks/sendgrid', 
  rawBodySaver, 
  json(), // Parse JSON after saving raw body
  async (req: Request, res: Response) => {
    try {
      // Verify signature
      if (!verifySignature(req)) {
        console.error('[SENDGRID WEBHOOK] Signature verification failed - rejecting webhook');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      const events = Array.isArray(req.body) ? req.body : [req.body];
      
      console.log(`[SENDGRID WEBHOOK] Received ${events.length} events`);
      
      for (const event of events) {
        await processWebhookEvent(event);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[SENDGRID WEBHOOK] Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Process individual webhook event
 */
async function processWebhookEvent(event: any) {
  const eventType = event.event;
  const email = event.email;
  const campaignId = event.campaign_id;
  const recipientId = event.recipient_id;
  
  console.log(`[SENDGRID WEBHOOK] Processing ${eventType} for ${email}`);
  
  // Find recipient record
  let recipient;
  if (recipientId) {
    [recipient] = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, parseInt(recipientId)))
      .limit(1);
  } else if (email && campaignId) {
    [recipient] = await db
      .select()
      .from(campaignRecipients)
      .where(
        sql`${campaignRecipients.email} = ${email} AND ${campaignRecipients.campaignId} = ${parseInt(campaignId)}`
      )
      .limit(1);
  }
  
  if (!recipient) {
    console.warn(`[SENDGRID WEBHOOK] Recipient not found for ${email}`);
    return;
  }
  
  // Update recipient based on event type
  switch (eventType) {
    case 'processed':
      // Email accepted by SendGrid
      break;
    
    case 'delivered':
      await db
        .update(campaignRecipients)
        .set({ 
          status: 'delivered',
          deliveredAt: new Date(event.timestamp * 1000)
        })
        .where(eq(campaignRecipients.id, recipient.id));
      break;
    
    case 'open':
      await db
        .update(campaignRecipients)
        .set({ 
          openedAt: new Date(event.timestamp * 1000)
        })
        .where(eq(campaignRecipients.id, recipient.id));
      break;
    
    case 'click':
      await db
        .update(campaignRecipients)
        .set({ 
          clickedAt: new Date(event.timestamp * 1000)
        })
        .where(eq(campaignRecipients.id, recipient.id));
      break;
    
    case 'bounce':
    case 'dropped':
      // SendGrid uses status codes: 5xx = hard bounce (permanent), 4xx = soft bounce (temporary)
      const statusCode = event.status || event.smtp_response || '';
      const bounceReason = event.reason || event.type || 'unknown';
      const isHardBounce = statusCode.startsWith('5') || 
                          bounceReason.toLowerCase().includes('invalid') ||
                          bounceReason.toLowerCase().includes('not exist') ||
                          bounceReason.toLowerCase().includes('unknown user');
      
      await db
        .update(campaignRecipients)
        .set({ 
          status: 'bounced',
          bouncedAt: new Date(event.timestamp * 1000),
          lastError: `${statusCode}: ${bounceReason}`
        })
        .where(eq(campaignRecipients.id, recipient.id));
      
      // Add to suppression list
      if (isHardBounce) {
        await addToSuppressionList(
          email,
          'hard_bounce',
          `Campaign ${campaignId}: ${statusCode} ${bounceReason}`
        );
      } else {
        // Track soft bounces (don't suppress immediately, but log for monitoring)
        console.log(`[SENDGRID WEBHOOK] Soft bounce for ${email}: ${statusCode} ${bounceReason}`);
      }
      break;
    
    case 'spamreport':
      await db
        .update(campaignRecipients)
        .set({ 
          status: 'complained',
          complainedAt: new Date(event.timestamp * 1000)
        })
        .where(eq(campaignRecipients.id, recipient.id));
      
      // Add to suppression list
      await addToSuppressionList(
        email,
        'spam_complaint',
        `Campaign ${campaignId}: Spam complaint`
      );
      break;
    
    case 'unsubscribe':
    case 'group_unsubscribe':
      await db
        .update(campaignRecipients)
        .set({ 
          status: 'unsubscribed'
        })
        .where(eq(campaignRecipients.id, recipient.id));
      
      // Add to suppression list
      await addToSuppressionList(
        email,
        'unsubscribe',
        `Campaign ${campaignId}: Unsubscribed`
      );
      break;
    
    default:
      console.log(`[SENDGRID WEBHOOK] Unhandled event type: ${eventType}`);
  }
}

/**
 * Add email to suppression list
 */
async function addToSuppressionList(
  email: string,
  reason: string,
  source: string,
  metadata?: any
) {
  try {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(emailSuppressionList)
      .where(eq(emailSuppressionList.email, email.toLowerCase()))
      .limit(1);
    
    if (existing) {
      // Update existing
      await db
        .update(emailSuppressionList)
        .set({
          reason,
          source,
          metadata: metadata || null,
          addedAt: new Date()
        })
        .where(eq(emailSuppressionList.email, email.toLowerCase()));
    } else {
      // Insert new
      await db
        .insert(emailSuppressionList)
        .values({
          email: email.toLowerCase(),
          reason,
          source,
          metadata: metadata || null
        });
    }
    
    console.log(`[SENDGRID WEBHOOK] Added ${email} to suppression list (${reason})`);
  } catch (error) {
    console.error(`[SENDGRID WEBHOOK] Error adding to suppression list:`, error);
  }
}

/**
 * Unsubscribe endpoint (one-click unsubscribe)
 * GET /api/email/unsubscribe?email=...&campaign=...
 */
router.get('/api/email/unsubscribe', async (req: Request, res: Response) => {
  const { email, campaign } = req.query;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).send('Invalid email address');
  }
  
  try {
    // Add to suppression list
    await addToSuppressionList(
      email,
      'unsubscribe',
      campaign ? `Campaign ${campaign}: Manual unsubscribe` : 'Manual unsubscribe'
    );
    
    // Update recipient if campaign provided
    if (campaign) {
      await db
        .update(campaignRecipients)
        .set({ status: 'unsubscribed' })
        .where(
          sql`${campaignRecipients.email} = ${email.toLowerCase()} AND ${campaignRecipients.campaignId} = ${parseInt(campaign as string)}`
        );
    }
    
    // Send success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - Clean Machine</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            padding: 40px;
            text-align: center;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .success-icon {
            font-size: 64px;
            color: #4CAF50;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>You've been unsubscribed</h1>
          <p>Your email address <strong>${email}</strong> has been removed from our mailing list.</p>
          <p>You will no longer receive marketing emails from Clean Machine.</p>
          <br>
          <p style="font-size: 14px; color: #999;">
            Changed your mind? Contact us to resubscribe.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[UNSUBSCRIBE] Error:', error);
    res.status(500).send('An error occurred. Please try again later.');
  }
});

export default router;
