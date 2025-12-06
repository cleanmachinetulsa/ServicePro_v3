import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getCalendarAvailability, checkDatesAvailable, AvailabilityResult } from './calendarAvailability';
import { addDays, format } from 'date-fns';

const router = Router();

/**
 * GET /api/calendar/availability
 * Get calendar availability for a date range
 * NEVER returns 500 - always returns 200 with success flag
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const querySchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      serviceDurationMinutes: z.string().transform(Number),
      preferredTime: z.string().optional(),
    });

    let params;
    try {
      params = querySchema.parse(req.query);
    } catch (zodError) {
      const today = new Date();
      const twoWeeksLater = addDays(today, 14);
      params = {
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(twoWeeksLater, 'yyyy-MM-dd'),
        serviceDurationMinutes: 120,
        preferredTime: undefined,
      };
      console.warn('[CALENDAR AVAILABILITY API] Invalid params, using defaults:', zodError);
    }

    const result = await getCalendarAvailability(req.tenantDb!, {
      startDate: params.startDate,
      endDate: params.endDate,
      serviceDurationMinutes: params.serviceDurationMinutes,
      preferredTime: params.preferredTime,
    });

    res.json({
      success: true,
      data: result.days,
      usedSource: result.usedSource,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[CALENDAR AVAILABILITY API] Fatal error (returning fallback):', error?.message || error);
    
    const today = new Date();
    const fallbackDays = [];
    for (let i = 1; i <= 14; i++) {
      const date = addDays(today, i);
      if (date.getDay() !== 0) {
        fallbackDays.push({
          date: format(date, 'yyyy-MM-dd'),
          isAvailable: true,
          timeSlots: [
            { start: format(date, "yyyy-MM-dd'T'09:00:00"), end: format(date, "yyyy-MM-dd'T'11:00:00"), available: true },
            { start: format(date, "yyyy-MM-dd'T'11:00:00"), end: format(date, "yyyy-MM-dd'T'13:00:00"), available: true },
            { start: format(date, "yyyy-MM-dd'T'14:00:00"), end: format(date, "yyyy-MM-dd'T'16:00:00"), available: true },
          ],
        });
      } else {
        fallbackDays.push({
          date: format(date, 'yyyy-MM-dd'),
          isAvailable: false,
          reason: 'closed',
        });
      }
    }
    
    res.json({
      success: true,
      data: fallbackDays,
      usedSource: 'internal_fallback',
      error: 'availability_service_error',
    });
  }
});

/**
 * POST /api/calendar/check-dates
 * Check if specific dates are available
 * NEVER returns 500 - always returns 200 with success flag
 */
router.post('/check-dates', async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      serviceDurationMinutes: z.number(),
    });

    let dates: string[];
    let serviceDurationMinutes: number;
    
    try {
      const parsed = bodySchema.parse(req.body);
      dates = parsed.dates;
      serviceDurationMinutes = parsed.serviceDurationMinutes;
    } catch (zodError) {
      console.warn('[CALENDAR AVAILABILITY API] Invalid check-dates params:', zodError);
      return res.json({
        success: true,
        data: [],
        usedSource: 'internal_fallback',
        error: 'invalid_parameters',
      });
    }

    const results = await checkDatesAvailable(req.tenantDb!, dates, serviceDurationMinutes);

    res.json({ 
      success: true, 
      data: results,
      usedSource: 'google_calendar',
    });
  } catch (error: any) {
    console.error('[CALENDAR AVAILABILITY API] Error checking dates (returning fallback):', error?.message || error);
    
    const dates = req.body?.dates || [];
    const fallbackResults = dates.map((dateStr: string) => {
      const date = new Date(dateStr);
      return {
        date: dateStr,
        available: date.getDay() !== 0,
        reason: date.getDay() === 0 ? 'closed' : undefined,
      };
    });
    
    res.json({
      success: true,
      data: fallbackResults,
      usedSource: 'internal_fallback',
      error: 'check_dates_error',
    });
  }
});

export default router;
