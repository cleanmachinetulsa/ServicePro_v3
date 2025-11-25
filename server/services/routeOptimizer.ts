import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { appointments, tenantConfig } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getTravelTimeMinutes } from './travelTimeService';
import { RouteSuggestion } from '@shared/routeOptimization';

/**
 * Generates route-optimized booking suggestions based on location and nearby jobs
 * Suggests time windows that minimize travel time and maximize efficiency
 */
export async function generateRouteSuggestion(
  tenantId: string,
  targetAddress: string,
  targetLat: number | null,
  targetLng: number | null
): Promise<RouteSuggestion | null> {
  if (!targetLat || !targetLng) {
    return null;
  }

  const tenantDb = wrapTenantDb(db, tenantId);

  // Load tenant home base configuration
  const [config] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  if (!config?.homeBaseLat || !config?.homeBaseLng) {
    console.warn('[ROUTE OPTIMIZER] No home base configured for tenant');
    return null;
  }

  // Convert numeric to number for calculations
  const homeBaseLat = Number(config.homeBaseLat);
  const homeBaseLng = Number(config.homeBaseLng);

  // Fetch upcoming jobs for next 3 days
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const upcomingJobs = await tenantDb
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.scheduledTime, new Date())
      )
    )
    .limit(50); // Limit for performance

  let best: RouteSuggestion | null = null;

  // Compare target against each upcoming job
  for (const job of upcomingJobs) {
    if (!job.latitude || !job.longitude) continue;

    const jobLat = Number(job.latitude);
    const jobLng = Number(job.longitude);

    const travelTime = await getTravelTimeMinutes(
      jobLat,
      jobLng,
      targetLat,
      targetLng
    );

    if (travelTime == null) continue;

    // If nearby (< 12 min travel time), suggest adjacent time slot
    if (travelTime <= 12) {
      const jobDate = new Date(job.scheduledTime);
      const suggestedDate = jobDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Extract time from scheduledTime
      const hours = jobDate.getHours();
      const minutes = jobDate.getMinutes();
      const suggestedStart = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // Suggest 1-hour window
      const endHours = hours + 1;
      const suggestedEnd = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      best = {
        reason: 'nearby appointment',
        suggestedDate,
        suggestedStart,
        suggestedEnd,
        confidence: 0.9,
        nearbyJobIds: [job.id],
        travelMinutes: travelTime,
      };
      break; // Found a good match, use it
    }
  }

  // If no nearby jobs found, suggest morning time from home base
  if (!best) {
    const homeTravel = await getTravelTimeMinutes(
      homeBaseLat,
      homeBaseLng,
      targetLat,
      targetLng
    );

    best = {
      reason: 'shorter travel from home base',
      suggestedDate: null, // No specific date, just time window
      suggestedStart: '09:00',
      suggestedEnd: '10:00',
      confidence: 0.6,
      travelMinutes: homeTravel ?? null,
    };
  }

  return best;
}
