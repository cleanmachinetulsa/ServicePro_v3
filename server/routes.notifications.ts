import { Router, Request, Response } from 'express';
import { db } from './db';
import { notificationSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';
import OpenAI from 'openai';

const router = Router();

const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_ENABLED ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

if (!OPENAI_ENABLED) {
  console.warn('[NOTIFICATIONS] OpenAI API key not configured - AI rephrasing will be disabled');
}

/**
 * Get notification settings by key
 * GET /api/notifications/settings/:key
 */
router.get('/settings/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const [setting] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.settingKey, key))
      .limit(1);

    if (!setting) {
      // Return default settings if not found
      const defaultSettings = getDefaultSettings(key);
      return res.json({
        success: true,
        settings: defaultSettings
      });
    }

    res.json({
      success: true,
      settings: setting
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
});

/**
 * Get all notification settings
 * GET /api/notifications/settings
 */
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await db
      .select()
      .from(notificationSettings);

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching all notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
});

/**
 * Update notification settings
 * PUT /api/notifications/settings/:key
 */
router.put('/settings/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { enabled, config } = req.body;
    const userId = (req as any).user?.id;

    // Check if setting exists
    const [existingSetting] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.settingKey, key))
      .limit(1);

    let result;

    if (existingSetting) {
      // Update existing setting
      [result] = await db
        .update(notificationSettings)
        .set({
          enabled: enabled !== undefined ? enabled : existingSetting.enabled,
          config: config || existingSetting.config,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(notificationSettings.settingKey, key))
        .returning();
    } else {
      // Create new setting
      [result] = await db
        .insert(notificationSettings)
        .values({
          settingKey: key,
          enabled: enabled !== undefined ? enabled : true,
          config: config || getDefaultSettings(key).config,
          updatedBy: userId
        })
        .returning();
    }

    res.json({
      success: true,
      settings: result
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
});

/**
 * Get default settings for a given key
 */
function getDefaultSettings(key: string) {
  const defaults: Record<string, any> = {
    voice_webhook: {
      id: 0,
      settingKey: 'voice_webhook',
      enabled: true,
      config: {
        ringDuration: 20,
        useAIConversation: true, // Default to AI-powered scheduling
        autoReplyMessage: `Hi, it's Jody with Clean Machine Auto Detail, sorry I missed you! How can I help you today?

Here are some of our most popular services. You can also see all of our available services, book online, read reviews and more by visiting cleanmachinetulsa.com

FULL DETAIL | $225-300 

Including Deep Interior Cleaning and Complete Exterior Wash & Wax, we aim make your vehicle look and feel like new!


•DEEP INTERIOR CLEANING | $150-250

Includes upholstery & carpet shampoo, steam cleaning of all surfaces, windows, leather conditioning and more.


•COMPLETE EXTERIOR DETAIL | $150-175

Including our Hand Wash & Wax PLUS 1-step Polish, removing light swirls and oxidation, restoring brilliant paint luster and shine!


•MINI DETAIL | $150-175 

Our routine service includes a premium Hand Wash & Wax PLUS a Basic Interior Cleaning; vacuum/wipedown/glass cleaning. 


*Add-on services -

•Leather / Upholstery protector | $50-60

•Paint polishing | $75-100

•Headlight Restoration | $25ea


May I answer any questions or get your vehicle scheduled?`,
        offerVoicemail: true,
        voicemailGreeting: "Sorry we missed your call. We've sent you a text message. You can also leave a voicemail after the beep.",
        enableVoicemailTranscription: true,
        forwardingEnabled: true
      },
      updatedAt: new Date(),
      updatedBy: null
    },
    sms_reminder: {
      id: 0,
      settingKey: 'sms_reminder',
      enabled: true,
      config: {
        sendDayBefore: true,
        reminderTime: '18:00',
        reminderMessage: "Hi {name}! This is a reminder about your {service} appointment tomorrow at {time}. We're looking forward to making your vehicle shine! Reply CANCEL to cancel."
      },
      updatedAt: new Date(),
      updatedBy: null
    }
  };

  return defaults[key] || {
    id: 0,
    settingKey: key,
    enabled: true,
    config: {},
    updatedAt: new Date(),
    updatedBy: null
  };
}

/**
 * AI Rephrasing endpoint for notification messages
 * POST /api/notifications/rephrase
 */
router.post('/rephrase', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'AI rephrasing is not available - OpenAI API key not configured'
      });
    }

    const { text, creativity, tone, length } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Build prompt based on user preferences
    const creativityLevel = creativity || 50; // 0-100 scale
    const tonePreference = tone || 'friendly'; // friendly, professional, casual, formal
    const lengthPreference = length || 'same'; // shorter, same, longer

    let prompt = `You are helping a business owner rephrase a text message for their auto detailing service. 

Original message:
${text}

Instructions:
- Tone: ${tonePreference}
- Creativity level: ${creativityLevel}% (0% = minimal changes, preserve exact wording; 100% = completely rewrite with fresh wording)
- Length: ${lengthPreference === 'shorter' ? 'Make it more concise' : lengthPreference === 'longer' ? 'Add more detail and warmth' : 'Keep similar length'}
${creativityLevel < 30 ? '- Make MINIMAL changes - mostly fix grammar and flow while keeping the exact words' : ''}
${creativityLevel >= 30 && creativityLevel < 70 ? '- Improve clarity and professionalism while keeping the core message' : ''}
${creativityLevel >= 70 ? '- Feel free to completely rewrite with fresh, engaging language' : ''}

Return ONLY the rephrased text message, no explanations or quotes.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that rephrases business text messages.' },
        { role: 'user', content: prompt }
      ],
      temperature: creativityLevel / 100, // Convert 0-100 to 0-1
      max_tokens: 1000,
    });

    const rephrasedText = completion.choices[0]?.message?.content?.trim() || text;

    res.json({
      success: true,
      original: text,
      rephrased: rephrasedText,
      settings: {
        creativity: creativityLevel,
        tone: tonePreference,
        length: lengthPreference
      }
    });
  } catch (error) {
    console.error('Error rephrasing text:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rephrase text'
    });
  }
});

export default router;
