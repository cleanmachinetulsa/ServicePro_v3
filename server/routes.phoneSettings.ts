import { Router, type Request, type Response } from 'express';
import { db } from './db';
import { phoneLines, phoneSchedules } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from './authMiddleware';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/phone-settings/lines
 * Fetch all phone lines with their associated schedules
 */
router.get('/lines', async (req: Request, res: Response) => {
  try {
    const lines = await db.select().from(phoneLines);
    const allSchedules = await db.select().from(phoneSchedules);
    
    const linesWithSchedules = lines.map(line => ({
      ...line,
      schedules: allSchedules.filter(s => s.phoneLineId === line.id),
    }));
    
    res.json({ success: true, lines: linesWithSchedules });
  } catch (error) {
    console.error('[PHONE SETTINGS] Error fetching phone lines:', error);
    res.status(500).json({ error: 'Failed to fetch phone settings' });
  }
});

/**
 * PATCH /api/phone-settings/lines/:id
 * Update a phone line's settings
 */
router.patch('/lines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate updates
    if (updates.phoneNumber || updates.id || updates.createdAt) {
      return res.status(400).json({ error: 'Cannot modify protected fields' });
    }
    
    // Validate forwarding number format if provided
    if (updates.forwardingNumber) {
      // E.164 format validation: +1XXXXXXXXXX (11-15 digits total)
      const e164Regex = /^\+[1-9]\d{10,14}$/;
      if (!e164Regex.test(updates.forwardingNumber)) {
        return res.status(400).json({ 
          error: 'Invalid forwarding number. Must be in E.164 format (e.g., +19188565304)' 
        });
      }
    }
    
    // Validate voicemail greeting length if provided
    if (updates.voicemailGreeting && updates.voicemailGreeting.length > 500) {
      return res.status(400).json({ 
        error: 'Voicemail greeting too long. Maximum 500 characters.' 
      });
    }
    
    // SIP Validation
    if (updates.sipEnabled) {
      // If SIP is enabled, sipEndpoint is required
      if (!updates.sipEndpoint) {
        return res.status(400).json({ 
          error: 'SIP endpoint is required when SIP routing is enabled' 
        });
      }
      
      // Validate SIP endpoint format: username@domain
      const sipEndpointRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!sipEndpointRegex.test(updates.sipEndpoint)) {
        return res.status(400).json({ 
          error: 'Invalid SIP endpoint format. Must be username@domain (e.g., jody@sip.cleanmachinetulsa.com)' 
        });
      }
    }
    
    // Validate SIP credential SID format if provided
    if (updates.sipCredentialSid) {
      if (!updates.sipCredentialSid.startsWith('CL')) {
        return res.status(400).json({ 
          error: 'Invalid credential SID format. Must start with "CL" (Twilio format)' 
        });
      }
    }
    
    // Validate SIP fallback number format if provided
    if (updates.sipFallbackNumber) {
      const e164Regex = /^\+[1-9]\d{10,14}$/;
      if (!e164Regex.test(updates.sipFallbackNumber)) {
        return res.status(400).json({ 
          error: 'Invalid SIP fallback number. Must be in E.164 format (e.g., +19188565711)' 
        });
      }
    }
    
    const [updated] = await db
      .update(phoneLines)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(phoneLines.id, parseInt(id)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Phone line not found' });
    }
    
    res.json({ success: true, line: updated });
  } catch (error) {
    console.error('[PHONE SETTINGS] Error updating phone line:', error);
    res.status(500).json({ error: 'Failed to update phone line' });
  }
});

/**
 * POST /api/phone-settings/schedules
 * Create a new schedule for a phone line
 */
router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const scheduleData = req.body;
    
    // Validate required fields
    if (!scheduleData.phoneLineId || scheduleData.dayOfWeek === undefined || 
        !scheduleData.startTime || !scheduleData.endTime || !scheduleData.action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate day of week (0-6)
    if (scheduleData.dayOfWeek < 0 || scheduleData.dayOfWeek > 6) {
      return res.status(400).json({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(scheduleData.startTime) || !timeRegex.test(scheduleData.endTime)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM (24-hour)' });
    }
    
    // Validate action
    if (scheduleData.action !== 'forward' && scheduleData.action !== 'voicemail') {
      return res.status(400).json({ error: 'Action must be "forward" or "voicemail"' });
    }
    
    const [created] = await db
      .insert(phoneSchedules)
      .values(scheduleData)
      .returning();
    
    res.json({ success: true, schedule: created });
  } catch (error) {
    console.error('[PHONE SETTINGS] Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

/**
 * PATCH /api/phone-settings/schedules/:id
 * Update an existing schedule
 */
router.patch('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate protected fields
    if (updates.id || updates.createdAt || updates.phoneLineId) {
      return res.status(400).json({ error: 'Cannot modify protected fields' });
    }
    
    // Validate time format if provided
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (updates.startTime && !timeRegex.test(updates.startTime)) {
      return res.status(400).json({ error: 'Invalid start time format. Use HH:MM (24-hour)' });
    }
    if (updates.endTime && !timeRegex.test(updates.endTime)) {
      return res.status(400).json({ error: 'Invalid end time format. Use HH:MM (24-hour)' });
    }
    
    // Validate action if provided
    if (updates.action && updates.action !== 'forward' && updates.action !== 'voicemail') {
      return res.status(400).json({ error: 'Action must be "forward" or "voicemail"' });
    }
    
    const [updated] = await db
      .update(phoneSchedules)
      .set(updates)
      .where(eq(phoneSchedules.id, parseInt(id)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json({ success: true, schedule: updated });
  } catch (error) {
    console.error('[PHONE SETTINGS] Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * DELETE /api/phone-settings/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deleted = await db
      .delete(phoneSchedules)
      .where(eq(phoneSchedules.id, parseInt(id)))
      .returning();
    
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PHONE SETTINGS] Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * Helper function: Get routing decision for a phone line at current time
 * Used by voice webhook to determine whether to forward or go to voicemail
 */
export async function getPhoneLineRoutingDecision(phoneNumber: string): Promise<{
  shouldForward: boolean;
  forwardingNumber: string | null;
  ringDuration: number;
  voicemailGreeting: string | null;
  voicemailGreetingUrl: string | null;
  isAfterHours: boolean;
  afterHoursVoicemailGreeting: string | null;
  afterHoursVoicemailGreetingUrl: string | null;
  // SIP routing fields
  sipEnabled: boolean;
  sipEndpoint: string | null;
  sipFallbackNumber: string | null;
}> {
  try {
    // Get phone line config
    const [line] = await db
      .select()
      .from(phoneLines)
      .where(eq(phoneLines.phoneNumber, phoneNumber))
      .limit(1);

    if (!line) {
      return { 
        shouldForward: false, 
        forwardingNumber: null, 
        ringDuration: 10, 
        voicemailGreeting: null, 
        voicemailGreetingUrl: null,
        isAfterHours: false,
        afterHoursVoicemailGreeting: null,
        afterHoursVoicemailGreetingUrl: null,
        sipEnabled: false,
        sipEndpoint: null,
        sipFallbackNumber: null,
      };
    }

    if (!line.forwardingEnabled || !line.forwardingNumber) {
      return { 
        shouldForward: false, 
        forwardingNumber: null,
        ringDuration: line.ringDuration || 10,
        voicemailGreeting: line.voicemailGreeting,
        voicemailGreetingUrl: line.voicemailGreetingUrl,
        isAfterHours: false,
        afterHoursVoicemailGreeting: line.afterHoursVoicemailGreeting,
        afterHoursVoicemailGreetingUrl: line.afterHoursVoicemailGreetingUrl,
        sipEnabled: line.sipEnabled || false,
        sipEndpoint: line.sipEndpoint || null,
        sipFallbackNumber: line.sipFallbackNumber || null,
      };
    }

    // Check current time against schedules (with timezone normalization)
    // Business timezone: America/Chicago (Central Time for Tulsa, Oklahoma)
    const businessTimezone = 'America/Chicago';
    const now = new Date();
    
    // Convert UTC to business timezone using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: businessTimezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const weekdayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    const dayOfWeek = weekdayMap[parts.find(p => p.type === 'weekday')?.value || 'Sunday'];
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const currentTime = `${hour}:${minute}`;

    const schedules = await db
      .select()
      .from(phoneSchedules)
      .where(eq(phoneSchedules.phoneLineId, line.id));

    // Find schedules for today
    const todaySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);
    
    // Check for after-hours (30 minutes after the last schedule end time for today)
    if (todaySchedules.length > 0) {
      // Find the latest end time for today's schedules
      const latestEndTime = todaySchedules.reduce((latest, schedule) => {
        return schedule.endTime > latest ? schedule.endTime : latest;
      }, '00:00');
      
      // Parse latest end time and add 30 minutes
      const [endHour, endMinute] = latestEndTime.split(':').map(Number);
      const endTimeInMinutes = endHour * 60 + endMinute;
      const afterHoursStartMinutes = endTimeInMinutes + 30; // 30-minute buffer
      
      // Parse current time
      const currentHour = parseInt(hour);
      const currentMinute = parseInt(minute);
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Check if we're in the after-hours period
      if (currentTimeInMinutes >= afterHoursStartMinutes) {
        console.log(`[PHONE ROUTING] After hours detected - current: ${currentTime}, latest schedule ends: ${latestEndTime}, after-hours starts at ${Math.floor(afterHoursStartMinutes / 60)}:${String(afterHoursStartMinutes % 60).padStart(2, '0')}`);
        return {
          shouldForward: false,
          forwardingNumber: null,
          ringDuration: line.ringDuration || 10,
          voicemailGreeting: line.voicemailGreeting,
          voicemailGreetingUrl: line.voicemailGreetingUrl,
          isAfterHours: true,
          afterHoursVoicemailGreeting: line.afterHoursVoicemailGreeting,
          afterHoursVoicemailGreetingUrl: line.afterHoursVoicemailGreetingUrl,
          sipEnabled: line.sipEnabled || false,
          sipEndpoint: line.sipEndpoint || null,
          sipFallbackNumber: line.sipFallbackNumber || null,
        };
      }
    }

    // Find matching schedule for current day and time (normal business hours)
    const activeSchedule = schedules.find(s => {
      return s.dayOfWeek === dayOfWeek &&
             currentTime >= s.startTime &&
             currentTime <= s.endTime &&
             s.action === 'forward';
    });

    return {
      shouldForward: !!activeSchedule,
      forwardingNumber: activeSchedule ? line.forwardingNumber : null,
      ringDuration: line.ringDuration || 10,
      voicemailGreeting: line.voicemailGreeting,
      voicemailGreetingUrl: line.voicemailGreetingUrl,
      isAfterHours: false,
      afterHoursVoicemailGreeting: line.afterHoursVoicemailGreeting,
      afterHoursVoicemailGreetingUrl: line.afterHoursVoicemailGreetingUrl,
      sipEnabled: line.sipEnabled || false,
      sipEndpoint: line.sipEndpoint || null,
      sipFallbackNumber: line.sipFallbackNumber || null,
    };
  } catch (error) {
    console.error('[PHONE ROUTING] Error determining routing:', error);
    return { 
      shouldForward: false, 
      forwardingNumber: null, 
      ringDuration: 10, 
      voicemailGreeting: null, 
      voicemailGreetingUrl: null,
      isAfterHours: false,
      afterHoursVoicemailGreeting: null,
      afterHoursVoicemailGreetingUrl: null,
      sipEnabled: false,
      sipEndpoint: null,
      sipFallbackNumber: null,
    };
  }
}

export default router;
