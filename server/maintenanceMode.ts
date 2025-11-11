import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { businessSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * In-memory cache for maintenance mode settings
 * Reduces database load during high traffic
 */
interface MaintenanceCache {
  enabled: boolean;
  message: string;
  backupEmail: string | null;
  alertPhone: string | null;
  timestamp: number;
}

let maintenanceCache: MaintenanceCache | null = null;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Invalidate the maintenance mode cache
 * Call this when toggling maintenance mode from admin UI
 */
export function invalidateMaintenanceCache() {
  maintenanceCache = null;
  console.log('[MAINTENANCE] Cache invalidated');
}

/**
 * Get maintenance mode settings with caching
 */
async function getMaintenanceSettings(): Promise<MaintenanceCache> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (maintenanceCache && (now - maintenanceCache.timestamp) < CACHE_TTL) {
    return maintenanceCache;
  }

  // Fetch from database
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.id, 1))
    .limit(1);

  // Update cache
  maintenanceCache = {
    enabled: settings?.maintenanceMode ?? false,
    message: settings?.maintenanceMessage || 'We\'re currently performing maintenance. Please check back soon.',
    backupEmail: settings?.backupEmail ?? null,
    alertPhone: settings?.alertPhone ?? null,
    timestamp: now,
  };

  return maintenanceCache;
}

/**
 * Middleware to check for maintenance mode
 * Redirects public-facing routes to maintenance page when enabled
 * Only admin surfaces bypass this check
 */
export async function checkMaintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Bypass list: Only true admin surfaces and essential static assets
    const bypassPaths = [
      // Admin surfaces (authenticated users only)
      '/dashboard',
      '/messages',
      '/business-settings',
      '/admin',
      '/monitor',
      '/phone',
      '/call-metrics',
      '/sms-monitoring',
      '/facebook-settings',
      '/settings',
      '/live-conversations',
      '/conversation-insights',
      '/customer-database',
      '/damage-assessment',
      '/user-management',
      '/notifications-settings',
      '/analytics',
      '/formatter-test',
      
      // Auth endpoints (needed for admin login)
      '/api/auth/',
      '/api/users/me',
      '/login',
      '/forgot-password',
      '/reset-password',
      '/change-password',
      
      // Backup booking endpoint (allows submissions during maintenance)
      '/api/backup/bookings',
      
      // Essential static assets
      '/assets/',
      '/@vite/',
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      
      // Maintenance page itself
      '/maintenance',
    ];
    
    const shouldBypass = bypassPaths.some(path => req.path.startsWith(path));
    
    if (shouldBypass) {
      return next();
    }
    
    // CRITICAL: Allow authenticated admin users to access API endpoints
    // This ensures admin dashboards remain functional during maintenance
    const isAuthenticated = req.session?.userId;
    const isApiRequest = req.path.startsWith('/api/');
    
    if (isAuthenticated && isApiRequest) {
      // Authenticated users can access all API endpoints during maintenance
      return next();
    }

    // Check if maintenance mode is enabled (with caching)
    const settings = await getMaintenanceSettings();

    if (settings.enabled) {
      // Detect if this is an API request vs HTML request
      const acceptsJson = req.headers.accept?.includes('application/json');
      const isApiPath = req.path.startsWith('/api/');
      
      if (acceptsJson || isApiPath) {
        // API requests: return 503 JSON
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          message: settings.message,
          maintenanceMode: true,
        });
      }

      // HTML requests: redirect to maintenance page
      const params = new URLSearchParams({
        message: settings.message,
      });
      
      if (settings.backupEmail) {
        params.set('email', settings.backupEmail);
      }
      if (settings.alertPhone) {
        params.set('phone', settings.alertPhone);
      }
      
      return res.redirect(`/maintenance?${params.toString()}`);
    }

    next();
  } catch (error) {
    console.error('[MAINTENANCE] Error checking maintenance mode:', error);
    
    // Fail closed: return 503 on database errors (safer for catastrophic failures)
    // This ensures the system doesn't accept bookings if we can't verify maintenance status
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      message: 'Unable to verify system status. Please try again in a moment.',
      maintenanceMode: true,
    });
  }
}
