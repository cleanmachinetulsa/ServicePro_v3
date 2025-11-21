/**
 * API routes for sharing calendar availability with customers
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateShareAvailabilityMessage } from './availabilityMessageService';
import { criticalMonitor } from './criticalMonitoring';

const router = Router();

/**
 * POST /api/calendar/share-availability
 * Generate formatted availability message for a specific channel
 */
router.post('/share-availability', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const schema = z.object({
      contactName: z.string().optional(),
      contactFirstName: z.string().optional(),
      channelType: z.enum(['sms', 'email', 'facebook', 'instagram']),
      templateId: z.number().optional(),
      serviceDurationMinutes: z.number().default(180),
      daysAhead: z.number().default(14),
    });

    const params = schema.parse(req.body);

    console.log('[CALENDAR SHARE API] Generating availability message:', {
      channelType: params.channelType,
      templateId: params.templateId,
      serviceDurationMinutes: params.serviceDurationMinutes,
      daysAhead: params.daysAhead,
    });

    // Generate the message
    const result = await generateShareAvailabilityMessage(params);

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[CALENDAR SHARE API] Error generating availability message:', error);

    // Report to monitoring
    await criticalMonitor.reportFailure(
      'Calendar Share API',
      error.message || 'Failed to generate availability message'
    );

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors,
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate availability message',
    });
  }
});

export default router;
