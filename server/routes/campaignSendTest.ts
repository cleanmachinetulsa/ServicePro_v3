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
 * Render campaign message with test variables
 */
function renderCampaignMessage(template: string): string {
  let message = template;
  // Replace template variables with test values
  message = message.replace(/\{\{firstName.*?\}\}/gi, 'Friend');
  message = message.replace(/\{\{customerName.*?\}\}/gi, 'Friend');
  message = message.replace(/\{\{businessName.*?\}\}/gi, 'Clean Machine');
  message = message.replace(/\{\{rewardsLink.*?\}\}/gi, 'https://cleanmachinetulsa.com/rewards');
  message = message.replace(/\{\{bookingLink.*?\}\}/gi, 'https://cleanmachinetulsa.com/book');
  return message;
}

/**
 * POST /api/campaigns/sms/:id/send-test
 * Send a test SMS using the same template rendering as production
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

    // Render message with test variables
    const renderedMessage = renderCampaignMessage(campaign.message);
    const finalMessage = truncateSmsResponse(renderedMessage);

    // Send via Twilio
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = campaign.from_number || process.env.MAIN_PHONE_NUMBER;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('[CAMPAIGN TEST] Twilio credentials missing');
      return res.status(500).json({
        ok: false,
        error: 'SMS service not configured'
      });
    }

    if (!fromPhone) {
      console.error('[CAMPAIGN TEST] No from phone configured');
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
      const result = await twilioClient.messages.create({
        to: phone,
        from: fromPhone,
        body: finalMessage
      });
      messageSid = result.sid;
      console.log(`[CAMPAIGN TEST SEND] success=true sid=${messageSid} campaignId=${campaign.id} to=${phone}`);
    } catch (twilioError: any) {
      errorCode = twilioError.code;
      errorMessage = twilioError.message;
      console.error(`[CAMPAIGN TEST SEND] failed=true campaignId=${campaign.id} to=${phone} errorCode=${errorCode} error=${errorMessage}`);
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
