import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getTravelTimeMinutes } from './travelTimeService';

/**
 * Evaluates whether a target location is within the tenant's service area
 * based on travel time from home base
 */
export async function evaluateServiceArea(
  tenantId: string,
  targetLat: number | null,
  targetLng: number | null
): Promise<{
  inServiceArea: boolean;
  travelMinutes: number | null;
  softDeclineMessage: string | null;
}> {
  if (!targetLat || !targetLng) {
    // Cannot evaluate without coordinates - treat as inside service area
    return { inServiceArea: true, travelMinutes: null, softDeclineMessage: null };
  }

  const tenantDb = wrapTenantDb(db, tenantId);

  const [config] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  if (!config?.homeBaseLat || !config?.homeBaseLng) {
    // If tenant has not configured home base, treat as inside service area
    console.warn('[SERVICE AREA] No home base configured for tenant');
    return { inServiceArea: true, travelMinutes: null, softDeclineMessage: null };
  }

  // Convert numeric to number for calculations
  const homeBaseLat = Number(config.homeBaseLat);
  const homeBaseLng = Number(config.homeBaseLng);
  const maxMinutes = config.serviceAreaMaxMinutes ?? 25;

  const travelMinutes = await getTravelTimeMinutes(
    homeBaseLat,
    homeBaseLng,
    targetLat,
    targetLng
  );

  if (travelMinutes == null) {
    // Could not calculate travel time - treat as inside service area
    console.warn('[SERVICE AREA] Could not calculate travel time');
    return { inServiceArea: true, travelMinutes: null, softDeclineMessage: null };
  }

  const softDeclineMessage =
    config.serviceAreaSoftDeclineMessage ??
    'It appears your location is slightly outside our service area, but we do sometimes make exceptions.';

  return {
    inServiceArea: travelMinutes <= maxMinutes,
    travelMinutes,
    softDeclineMessage,
  };
}
