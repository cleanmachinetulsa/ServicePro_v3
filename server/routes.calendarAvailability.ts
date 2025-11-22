import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getCalendarAvailability, checkDatesAvailable } from './calendarAvailability';

const router = Router();

/**
 * GET /api/calendar/availability
 * Get calendar availability for a date range
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const querySchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      serviceDurationMinutes: z.string().transform(Number),
      preferredTime: z.string().optional(),
    });

    const params = querySchema.parse(req.query);

    const availability = await getCalendarAvailability(req.tenantDb!, {
      startDate: params.startDate,
      endDate: params.endDate,
      serviceDurationMinutes: params.serviceDurationMinutes,
      preferredTime: params.preferredTime,
    });

    res.json({ success: true, data: availability });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors,
      });
    }

    console.error('[CALENDAR AVAILABILITY API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar availability',
    });
  }
});

/**
 * POST /api/calendar/check-dates
 * Check if specific dates are available
 */
router.post('/check-dates', async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), // Array of YYYY-MM-DD
      serviceDurationMinutes: z.number(),
    });

    const { dates, serviceDurationMinutes } = bodySchema.parse(req.body);

    const results = await checkDatesAvailable(req.tenantDb!, dates, serviceDurationMinutes);

    res.json({ success: true, data: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors,
      });
    }

    console.error('[CALENDAR AVAILABILITY API] Error checking dates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check date availability',
    });
  }
});

export default router;
