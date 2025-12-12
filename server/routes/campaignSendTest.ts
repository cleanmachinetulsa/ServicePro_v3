import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import type { TenantDb } from '../tenantDb';
import twilio from 'twilio';
import { truncateSmsResponse } from '../utils/smsLength';

const router = Router();

/**
 * Validate phone number is E.164 format
 */
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
}

/**
 * Render campaign message with test variables (production-aligned)
 * Uses same template variable substitution as production sends
 * Force single-link output by excluding {{bookingLink}}
 */
function renderSmsCampaignTemplate(
  template: string,
  tenantName: string = 'Clean Machine'
): string {
  let message = template;
  
  // Replace first name variants with test value
  message = message.replace(/\{\{firstName\}\}/gi, 'Friend');
  message = message.replace(/\{\{firstNameOrFallback\}\}/gi, 'Friend');
  message = message.replace(/\{\{customerName\}\}/gi, 'Friend');
  
  // Replace business name with tenant name
  message = message.replace(/\{\{businessName\}\}/gi, tenantName);
  
  // Replace rewards link with test value (rewardsLink only - no bookingLink)
  message = message.replace(/\{\{rewardsLink\}\}/gi, 'https://cleanmachinetulsa.com/rewards');
  message = message.replace(/\{rewards_link\}/gi, 'https://cleanmachinetulsa.com/rewards');
  
  // NOTE: Intentionally NOT replacing {{bookingLink}} to force single-link output
  // Remove any remaining bookingLink references
  message = message.replace(/\s*\{\{bookingLink\}\}/gi, '');
  message = message.replace(/\s*\{booking_link\}/gi, '');
  
  // Production also handles {name} replacement for customer personalization
  message = message.replace(/\{name\}/gi, 'Friend');
  
  return message;
}

/**
 * POST /api/campaigns/sms/:id/send-test
 * Send a test SMS using the same template rendering as production
 * Uses MessagingServiceSid if available, single-link output only
 */
router.post('/sms/:id/send-test', async (req: Request, res: Response) => {
  try {
    const tenantDb = (req as any).tenantDb as TenantDb;
    const tenantId = (req as any).tenant?.id || 'root';
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: 'Phone number is required'
      });
    }

    if (!isValidE164(phone)) {
      return res.status(400).json({
        ok: false,
        error: 'Phone number must be in E.164 format (e.g., +1234567890)'
      });
    }

    // Load campaign
    const campaignResult = await tenantDb.execute(sql`
      SELECT * FROM sms_campaigns WHERE id = ${parseInt(req.params.id, 10)}
    `);

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    const campaign = campaignResult.rows[0] as any;

    // Get tenant business name for template rendering
    const tenantResult = await tenantDb.execute(sql`
      SELECT business_name FROM tenants WHERE id = ${tenantId}
    `);
    const tenantName = tenantResult.rows.length > 0 
      ? (tenantResult.rows[0] as any).business_name || 'Clean Machine'
      : 'Clean Machine';

    // Render message using production-aligned renderer
    const renderedMessage = renderSmsCampaignTemplate(campaign.message, tenantName);
    const finalMessage = truncateSmsResponse(renderedMessage);

    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromPhone = campaign.from_number || process.env.MAIN_PHONE_NUMBER;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('[CAMPAIGN TEST SEND] Twilio credentials missing');
      return res.status(500).json({
        ok: false,
        error: 'SMS service not configured'
      });
    }

    if (!TWILIO_MESSAGING_SERVICE_SID && !fromPhone) {
      console.error('[CAMPAIGN TEST SEND] No messaging service or from phone configured');
      return res.status(500).json({
        ok: false,
        error: 'SMS from number not configured'
      });
    }

    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    let messageSid: string | undefined;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      const messageParams: any = {
        to: phone,
        body: finalMessage
      };

      // Prefer MessagingServiceSid for consistency with production
      if (TWILIO_MESSAGING_SERVICE_SID) {
        messageParams.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messageParams.from = fromPhone;
      }

      const result = await twilioClient.messages.create(messageParams);
      messageSid = result.sid;
      console.log(`[CAMPAIGN TEST SEND] ok=true campaignId=${campaign.id} to=${phone} chars=${finalMessage.length} sid=${messageSid}`);
    } catch (twilioError: any) {
      errorCode = twilioError.code;
      errorMessage = twilioError.message;
      console.error(`[CAMPAIGN TEST SEND] failed campaignId=${campaign.id} to=${phone} code=${errorCode} message=${errorMessage}`);
    }

    if (messageSid) {
      return res.json({
        ok: true,
        sid: messageSid,
        to: phone,
        campaignId: campaign.id,
        messagePreview: finalMessage.substring(0, 100),
        previewChars: finalMessage.length
      });
    } else {
      return res.status(500).json({
        ok: false,
        error: errorMessage || 'Failed to send SMS',
        twilioErrorCode: errorCode
      });
    }
  } catch (error: any) {
    console.error('[CAMPAIGN TEST SEND] exception:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
});

export const campaignSendTestRouter = router;
