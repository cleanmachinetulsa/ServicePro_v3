/**
 * SP-23: Performance Logs API
 * Collects Web Vitals and custom performance metrics from the frontend
 */

import type { Express, Request, Response } from 'express';
import { requireAuth } from './authMiddleware';
import { requireRole } from './rbacMiddleware';

interface PerformanceEntry {
  metric: string;
  value: number;
  rating: string;
  timestamp: number;
  url: string;
}

// In-memory storage for performance logs (can be extended to persist to DB if needed)
const perfLogs: PerformanceEntry[] = [];
const MAX_LOGS = 1000; // Rolling buffer size

export function registerPerfRoutes(app: Express) {
  // Receive performance logs from frontend (no auth - logging only, no sensitive data stored)
  // Security: Only stores metric name, value, rating, timestamp, and path - no user identifiers
  app.post('/api/perf/logs', async (req: Request, res: Response) => {
    try {
      const { entries } = req.body;
      
      if (!Array.isArray(entries)) {
        return res.status(400).json({ success: false, error: 'Invalid entries format' });
      }

      // Add entries to rolling buffer (sanitize data - only store what's needed)
      for (const entry of entries) {
        if (perfLogs.length >= MAX_LOGS) {
          perfLogs.shift(); // Remove oldest entry
        }
        // Only store non-identifying performance data
        perfLogs.push({
          metric: String(entry.metric || '').slice(0, 50),
          value: Number(entry.value) || 0,
          rating: String(entry.rating || 'unknown').slice(0, 20),
          timestamp: entry.timestamp || Date.now(),
          url: String(entry.url || '').replace(/[?#].*$/, '').slice(0, 200), // Strip query params, truncate
        });
      }

      // Log performance issues to console for monitoring
      const poorEntries = entries.filter((e: PerformanceEntry) => e.rating === 'poor');
      if (poorEntries.length > 0) {
        console.warn('[PERF] Poor performance metrics detected:', 
          poorEntries.map((e: PerformanceEntry) => `${e.metric}: ${Number(e.value).toFixed(2)}`).join(', ')
        );
      }

      res.json({ success: true, received: entries.length });
    } catch (error) {
      console.error('[PERF] Error processing performance logs:', error);
      res.status(500).json({ success: false, error: 'Failed to process logs' });
    }
  });

  // Get performance summary (admin/owner only - protected endpoint)
  app.get('/api/perf/summary', requireAuth, requireRole('owner'), async (req: Request, res: Response) => {
    try {
      // Calculate averages by metric
      const metricAverages: Record<string, { avg: number; count: number; ratings: Record<string, number> }> = {};
      
      for (const log of perfLogs) {
        if (!metricAverages[log.metric]) {
          metricAverages[log.metric] = { avg: 0, count: 0, ratings: { good: 0, 'needs-improvement': 0, poor: 0 } };
        }
        const stats = metricAverages[log.metric];
        stats.avg = (stats.avg * stats.count + log.value) / (stats.count + 1);
        stats.count++;
        if (log.rating in stats.ratings) {
          stats.ratings[log.rating]++;
        }
      }

      res.json({
        success: true,
        totalLogs: perfLogs.length,
        metrics: metricAverages,
        recentLogs: perfLogs.slice(-10), // Last 10 entries (no sensitive data)
      });
    } catch (error) {
      console.error('[PERF] Error getting summary:', error);
      res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
  });

  console.log('[PERF] Routes registered: /api/perf/logs (open), /api/perf/summary (auth required)');
}
