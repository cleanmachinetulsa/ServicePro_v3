import { Router, Request, Response } from 'express';
import { db } from './db';
import type { TenantDb } from './tenantDb';
import { smsDeliveryStatus } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { verifyTwilioSignature } from './twilioSignatureMiddleware';
import { getWebSocketServer } from './websocketService';

const router = Router();

/**
 * Twilio Status Callback Webhook
 * 
 * This endpoint receives delivery status updates from Twilio for every SMS sent.
 * Status progression: queued → sending → sent → delivered (or failed/undelivered)
 * 
 * To configure in Twilio:
 * 1. Go to Twilio Console → Messaging → Settings → Geo permissions
 * 2. Add StatusCallback URL: https://your-replit-url.replit.app/api/twilio/status-callback
 * 3. Or set per-message when sending SMS via the API
 * 
 * POST /api/twilio/status-callback
 * SECURITY: Twilio signature verification enabled
 */
router.post('/status-callback', verifyTwilioSignature, async (req: Request, res: Response) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      Body,
      ErrorCode,
      ErrorMessage,
      NumSegments,
      Price,
      PriceUnit,
      Direction,
    } = req.body;

    console.log('[TWILIO STATUS] Received status callback:', {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
    });

    // Check if we already have this message in our database
    const existingRecord = await req.tenantDb!
      .select()
      .from(smsDeliveryStatus)
      .where(req.tenantDb!.withTenantFilter(smsDeliveryStatus, eq(smsDeliveryStatus.messageSid, MessageSid)))
      .limit(1);

    if (existingRecord.length > 0) {
      // Update existing record
      const updates: any = {
        status: MessageStatus,
        updatedAt: new Date(),
      };

      // Set timestamp based on status
      if (MessageStatus === 'sent') {
        updates.sentAt = new Date();
      } else if (MessageStatus === 'delivered') {
        updates.deliveredAt = new Date();
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        updates.failedAt = new Date();
        updates.errorCode = ErrorCode ? parseInt(ErrorCode) : null;
        updates.errorMessage = ErrorMessage || null;
      }

      // Update price if available (Twilio sends this on final status)
      if (Price) {
        updates.price = Price;
        updates.priceUnit = PriceUnit || 'USD';
      }

      await req.tenantDb!
        .update(smsDeliveryStatus)
        .set(updates)
        .where(req.tenantDb!.withTenantFilter(smsDeliveryStatus, eq(smsDeliveryStatus.messageSid, MessageSid)));

      console.log('[TWILIO STATUS] Updated existing record:', MessageSid);
    } else {
      // Create new record (in case we missed the initial send)
      await req.tenantDb!.insert(smsDeliveryStatus).values({
        messageSid: MessageSid,
        to: To,
        from: From,
        body: Body,
        status: MessageStatus,
        direction: Direction || 'outbound-api',
        price: Price || null,
        priceUnit: PriceUnit || 'USD',
        errorCode: ErrorCode ? parseInt(ErrorCode) : null,
        errorMessage: ErrorMessage || null,
        numSegments: NumSegments ? parseInt(NumSegments) : null,
        sentAt: MessageStatus === 'sent' ? new Date() : null,
        deliveredAt: MessageStatus === 'delivered' ? new Date() : null,
        failedAt: (MessageStatus === 'failed' || MessageStatus === 'undelivered') ? new Date() : null,
      });

      console.log('[TWILIO STATUS] Created new record for:', MessageSid);
    }

    // Log errors to help with troubleshooting
    if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
      console.error('[TWILIO STATUS] ❌ Message delivery failed:', {
        MessageSid,
        To,
        ErrorCode,
        ErrorMessage,
      });
    } else if (MessageStatus === 'delivered') {
      console.log('[TWILIO STATUS] ✅ Message delivered successfully:', MessageSid);
    }

    // 🔴 REAL-TIME: Broadcast SMS delivery status to connected clients
    const io = getWebSocketServer();
    if (io) {
      io.to('monitoring').emit('sms_status_update', {
        messageSid: MessageSid,
        status: MessageStatus,
        to: To,
        from: From,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        timestamp: new Date().toISOString(),
      });
      console.log('[WEBSOCKET] SMS status update broadcast:', MessageSid, MessageStatus);
    }

    // Respond to Twilio with 200 OK
    res.status(200).send('OK');
  } catch (error) {
    console.error('[TWILIO STATUS] Error processing status callback:', error);
    // Still return 200 to prevent Twilio from retrying
    res.status(200).send('Error processed');
  }
});

/**
 * Get SMS delivery statistics with time-based filtering
 * GET /api/twilio/delivery-stats?days=30
 */
router.get('/delivery-stats', async (req: Request, res: Response) => {
  try {
    const { days = '30', limit = 100 } = req.query;
    const daysInt = parseInt(days as string);

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysInt);

    // Get all records within date range
    const records = await req.tenantDb!
      .select()
      .from(smsDeliveryStatus)
      .limit(parseInt(limit as string));

    // Filter by date in JavaScript (could be optimized with SQL WHERE clause)
    const filteredRecords = records.filter(r => 
      r.createdAt && new Date(r.createdAt) >= dateThreshold
    );

    // Calculate statistics
    const stats = {
      total: filteredRecords.length,
      delivered: filteredRecords.filter(r => r.status === 'delivered').length,
      failed: filteredRecords.filter(r => r.status === 'failed' || r.status === 'undelivered').length,
      pending: filteredRecords.filter(r => r.status === 'queued' || r.status === 'sending' || r.status === 'sent').length,
      deliveryRate: 0,
      totalCost: 0,
      avgSegments: 0,
    };

    // Calculate delivery rate
    const finalStatuses = filteredRecords.filter(r => 
      r.status === 'delivered' || r.status === 'failed' || r.status === 'undelivered'
    );
    if (finalStatuses.length > 0) {
      stats.deliveryRate = (stats.delivered / finalStatuses.length) * 100;
    }

    // Calculate total cost
    stats.totalCost = filteredRecords.reduce((sum, r) => {
      return sum + (parseFloat(r.price as string || '0'));
    }, 0);

    // Calculate average segments
    const segmentRecords = filteredRecords.filter(r => r.numSegments !== null);
    if (segmentRecords.length > 0) {
      stats.avgSegments = segmentRecords.reduce((sum, r) => sum + (r.numSegments || 0), 0) / segmentRecords.length;
    }

    res.json({
      success: true,
      stats,
      records: filteredRecords.slice(0, 50), // Return first 50 for preview
    });
  } catch (error) {
    console.error('[TWILIO STATUS] Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery statistics',
    });
  }
});

/**
 * Get time-series trends data for charts
 * GET /api/twilio/trends?days=30&groupBy=day
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { days = '30', groupBy = 'day' } = req.query;
    const daysInt = parseInt(days as string);

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysInt);

    // Get all records
    const records = await req.tenantDb!
      .select()
      .from(smsDeliveryStatus)
      .limit(1000); // Get more records for trend analysis

    // Filter by date
    const filteredRecords = records.filter(r => 
      r.createdAt && new Date(r.createdAt) >= dateThreshold
    );

    // Group by time period
    const getTimeKey = (date: Date) => {
      if (groupBy === 'day') {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      }
    };

    // Aggregate data by time period
    const timeSeriesData: Record<string, {
      date: string;
      total: number;
      delivered: number;
      failed: number;
      pending: number;
      cost: number;
      deliveryRate: number;
    }> = {};

    filteredRecords.forEach(record => {
      if (!record.createdAt) return;
      
      const timeKey = getTimeKey(new Date(record.createdAt));
      
      if (!timeSeriesData[timeKey]) {
        timeSeriesData[timeKey] = {
          date: timeKey,
          total: 0,
          delivered: 0,
          failed: 0,
          pending: 0,
          cost: 0,
          deliveryRate: 0,
        };
      }

      timeSeriesData[timeKey].total++;
      
      if (record.status === 'delivered') {
        timeSeriesData[timeKey].delivered++;
      } else if (record.status === 'failed' || record.status === 'undelivered') {
        timeSeriesData[timeKey].failed++;
      } else if (record.status === 'queued' || record.status === 'sending' || record.status === 'sent') {
        timeSeriesData[timeKey].pending++;
      }

      timeSeriesData[timeKey].cost += parseFloat(record.price as string || '0');
    });

    // Calculate delivery rates
    Object.values(timeSeriesData).forEach(data => {
      const completed = data.delivered + data.failed;
      if (completed > 0) {
        data.deliveryRate = (data.delivered / completed) * 100;
      }
    });

    // Convert to array and sort by date
    const trendsArray = Object.values(timeSeriesData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    res.json({
      success: true,
      trends: trendsArray,
      period: groupBy,
      daysAnalyzed: daysInt,
    });
  } catch (error) {
    console.error('[TWILIO STATUS] Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends data',
    });
  }
});

/**
 * Get error breakdown
 * GET /api/twilio/error-breakdown
 */
router.get('/error-breakdown', async (req: Request, res: Response) => {
  try {
    const failedMessages = await req.tenantDb!
      .select()
      .from(smsDeliveryStatus)
      .where(req.tenantDb!.withTenantFilter(smsDeliveryStatus, eq(smsDeliveryStatus.status, 'failed')))
      .limit(100);

    // Group by error code
    const errorBreakdown: Record<number, { count: number; message: string; examples: string[] }> = {};

    failedMessages.forEach(msg => {
      if (msg.errorCode) {
        if (!errorBreakdown[msg.errorCode]) {
          errorBreakdown[msg.errorCode] = {
            count: 0,
            message: msg.errorMessage || 'Unknown error',
            examples: [],
          };
        }
        errorBreakdown[msg.errorCode].count++;
        if (errorBreakdown[msg.errorCode].examples.length < 3) {
          errorBreakdown[msg.errorCode].examples.push(msg.to);
        }
      }
    });

    res.json({
      success: true,
      totalFailed: failedMessages.length,
      errorBreakdown,
    });
  } catch (error) {
    console.error('[TWILIO STATUS] Error fetching error breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error breakdown',
    });
  }
});

export default router;
