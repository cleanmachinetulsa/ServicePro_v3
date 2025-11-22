import { sendSMS } from './notifications';
import { db } from './db';
import { errorLogs } from '@shared/schema';
import { wrapTenantDb } from './tenantDb';

// In-memory tracking for duplicate error prevention
const recentErrors = new Map<string, number>();
const ERROR_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface ErrorDetails {
  type: 'api' | 'database' | 'external_service' | 'validation' | 'runtime' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  endpoint?: string;
  userId?: string;
  requestData?: any;
  metadata?: any;
}

/**
 * Log error to database and optionally notify admin
 */
export async function logError(details: ErrorDetails): Promise<void> {
  const tenantDb = wrapTenantDb(db, 'root');
  try {
    // CRITICAL FIX: Always log to database and check failover BEFORE duplicate suppression
    // This ensures repeated identical errors still count toward auto-failover threshold
    
    // Log to database (ALWAYS, even for duplicates)
    await tenantDb.insert(errorLogs).values({
      errorType: details.type,
      severity: details.severity,
      message: details.message,
      stack: details.stack || null,
      endpoint: details.endpoint || null,
      userId: details.userId || null,
      requestData: details.requestData || null,
      metadata: details.metadata || null,
    });

    console.error(`[ERROR MONITOR] ${details.severity.toUpperCase()} - ${details.type}: ${details.message}`);

    // Check if auto-failover should be triggered (for high/critical errors BEFORE notification suppression)
    if (details.severity === 'high' || details.severity === 'critical') {
      try {
        const { checkAutoFailover } = await import('./autoFailover');
        const failoverResult = await checkAutoFailover();
        
        if (failoverResult.triggered) {
          console.warn(`[AUTO-FAILOVER] ✅ Maintenance mode triggered: ${failoverResult.reason}`);
        } else if (failoverResult.suppressed) {
          console.log(`[AUTO-FAILOVER] ⏸️  Trigger suppressed: ${failoverResult.reason}`);
        }
      } catch (failoverError) {
        console.error('[AUTO-FAILOVER] ⚠️  Failed to check failover conditions:', failoverError);
        // Don't block error logging if failover check fails
      }
    }

    // NOW check for duplicates to suppress notifications (but error is already logged)
    const errorSignature = `${details.type}:${details.endpoint}:${details.message.substring(0, 100)}`;
    const now = Date.now();
    const lastOccurrence = recentErrors.get(errorSignature);

    // Skip NOTIFICATION if same error occurred recently (but error is still logged above)
    if (lastOccurrence && (now - lastOccurrence) < ERROR_COOLDOWN_MS) {
      console.log(`[ERROR MONITOR] Duplicate error notification suppressed: ${errorSignature}`);
      return; // Skip notification but error was logged
    }

    // Update recent errors map for notification suppression
    recentErrors.set(errorSignature, now);

    // Notify admin for high/critical errors (only for first occurrence in cooldown window)
    if (details.severity === 'high' || details.severity === 'critical') {
      await notifyAdmin(details);
    }

    // Clean up old entries from memory map (keep last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    for (const [key, timestamp] of recentErrors.entries()) {
      if (timestamp < oneHourAgo) {
        recentErrors.delete(key);
      }
    }
  } catch (error) {
    // Fallback: if error monitoring fails, log to console
    console.error('[ERROR MONITOR] Failed to log error:', error);
    console.error('[ERROR MONITOR] Original error:', details);
  }
}

/**
 * Send notifications to admin about critical errors
 */
async function notifyAdmin(details: ErrorDetails): Promise<void> {
  const message = `🚨 CRITICAL: ${details.type} error at ${details.endpoint || 'unknown'}\n\n${details.message.substring(0, 150)}\n\nCheck dashboard immediately.`;

  // Always send SMS for critical errors to catch issues immediately
  try {
    const adminPhone = process.env.BUSINESS_OWNER_PHONE;
    if (adminPhone) {
      console.log('[ERROR MONITOR] 📱 Sending critical error SMS to business owner');
      await sendSMS(
        adminPhone,
        message
      );
      console.log('[ERROR MONITOR] ✅ Critical error SMS sent successfully');
    } else {
      console.warn('[ERROR MONITOR] ⚠️ No BUSINESS_OWNER_PHONE configured - cannot send SMS alerts');
    }
  } catch (error) {
    console.error('[ERROR MONITOR] ❌ Failed to send SMS alert:', error);
  }
}

/**
 * Express middleware for automatic error logging
 */
export function errorMonitoringMiddleware(err: any, req: any, res: any, next: any) {
  // Determine error severity based on status code
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (err.status >= 500) severity = 'high';
  if (err.status === 500 || !err.status) severity = 'critical';
  if (err.status >= 400 && err.status < 500) severity = 'medium';

  // Determine error type
  let errorType: ErrorDetails['type'] = 'runtime';
  if (err.name === 'ValidationError') errorType = 'validation';
  if (err.message?.includes('database') || err.code?.startsWith('PG')) errorType = 'database';
  if (req.path?.startsWith('/api/')) errorType = 'api';

  // Log the error
  logError({
    type: errorType,
    severity,
    message: err.message || 'Unknown error',
    stack: err.stack,
    endpoint: `${req.method} ${req.path}`,
    userId: req.session?.userId?.toString(),
    requestData: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
    metadata: {
      headers: req.headers,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  // Pass to next error handler
  next(err);
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logError({
        type: 'api',
        severity: 'high',
        message: error.message || 'Async handler error',
        stack: error.stack,
        endpoint: `${req.method} ${req.path}`,
        userId: req.session?.userId?.toString(),
        requestData: {
          body: req.body,
          query: req.query,
        },
      });
      next(error);
    });
  };
}

/**
 * Get recent errors for admin dashboard
 */
export async function getRecentErrors(limit: number = 50): Promise<typeof errorLogs.$inferSelect[]> {
  const tenantDb = wrapTenantDb(db, 'root');
  const { desc } = await import('drizzle-orm');
  return tenantDb
    .select()
    .from(errorLogs)
    .orderBy(desc(errorLogs.createdAt))
    .limit(limit);
}

/**
 * Mark error as resolved
 */
export async function markErrorResolved(errorId: number): Promise<void> {
  const tenantDb = wrapTenantDb(db, 'root');
  const { eq } = await import('drizzle-orm');
  await tenantDb
    .update(errorLogs)
    .set({ resolved: new Date() })
    .where(eq(errorLogs.id, errorId));
}
