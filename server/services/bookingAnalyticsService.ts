/**
 * Smart Availability Deep Links L2: Booking Analytics Service
 * Tracks booking initiations from different sources (chat, site, etc.)
 */

import { db } from '../db';
import { bookingInitiationEvents } from '@shared/schema';

const LOG_PREFIX = '[BOOKING ANALYTICS]';

export interface BookingInitiationParams {
  tenantId: string;
  source: 'chat' | 'site' | 'other';
  context?: Record<string, any>;
}

export async function logBookingInitiation(params: BookingInitiationParams): Promise<{ success: boolean; id?: number }> {
  try {
    const { tenantId, source, context = {} } = params;
    
    console.log(`${LOG_PREFIX} Logging initiation for tenant "${tenantId}" from source "${source}"`);
    
    const result = await db.insert(bookingInitiationEvents).values({
      tenantId,
      source,
      context,
    }).returning({ id: bookingInitiationEvents.id });
    
    const insertedId = result[0]?.id;
    
    console.log(`${LOG_PREFIX} Logged initiation event id=${insertedId}`);
    
    return { success: true, id: insertedId };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error logging initiation:`, error);
    return { success: false };
  }
}

export interface BookingAnalyticsSummary {
  totalInitiations: number;
  bySource: { source: string; count: number }[];
}

export async function getBookingAnalyticsSummary(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<BookingAnalyticsSummary> {
  try {
    const { sql, eq, and, gte, lte } = await import('drizzle-orm');
    
    const conditions = [eq(bookingInitiationEvents.tenantId, tenantId)];
    
    if (startDate) {
      conditions.push(gte(bookingInitiationEvents.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(bookingInitiationEvents.createdAt, endDate));
    }
    
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const results = await db.select({
      source: bookingInitiationEvents.source,
      count: sql<number>`count(*)::int`,
    })
      .from(bookingInitiationEvents)
      .where(whereClause)
      .groupBy(bookingInitiationEvents.source);
    
    const totalInitiations = results.reduce((sum, r) => sum + r.count, 0);
    
    return {
      totalInitiations,
      bySource: results.map(r => ({ source: r.source, count: r.count })),
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting summary:`, error);
    return { totalInitiations: 0, bySource: [] };
  }
}
