import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getTravelTimeMinutes } from './travelTimeService';

/**
 * SERVICE-AREA-FIX: Service area classification enum
 * - IN_AREA: Within normal service radius, proceed with booking
 * - EXTENDED: Beyond normal radius but within extended radius, needs map confirmation + escalation
 * - OUT_OF_AREA: Beyond all service radii, reject with message
 */
export type ServiceAreaClassification = 'IN_AREA' | 'EXTENDED' | 'OUT_OF_AREA';

/**
 * SERVICE-AREA-FIX: Classify address based on drive time thresholds
 */
export function classifyServiceArea({
  driveTimeMinutes,
  baseRadiusMinutes,
  extendedRadiusMinutes,
}: {
  driveTimeMinutes: number;
  baseRadiusMinutes: number;
  extendedRadiusMinutes: number | null;
}): ServiceAreaClassification {
  if (driveTimeMinutes <= baseRadiusMinutes) {
    return 'IN_AREA';
  }
  if (extendedRadiusMinutes != null && driveTimeMinutes <= extendedRadiusMinutes) {
    return 'EXTENDED';
  }
  return 'OUT_OF_AREA';
}

/**
 * SERVICE-AREA-FIX: Enhanced service area evaluation with IN_AREA/EXTENDED/OUT_OF_AREA classification
 */
export interface ServiceAreaResult {
  classification: ServiceAreaClassification;
  inServiceArea: boolean; // Backwards compat: true for IN_AREA and EXTENDED
  isExtendedArea: boolean;
  travelMinutes: number | null;
  softDeclineMessage: string | null;
  // Debug info for troubleshooting (logged but not exposed to users)
  debug?: {
    address?: string;
    geocodedLat?: number;
    geocodedLng?: number;
    homeBaseLat?: number;
    homeBaseLng?: number;
    baseRadiusMinutes?: number;
    extendedRadiusMinutes?: number | null;
  };
}

/**
 * Evaluates whether a target location is within the tenant's service area
 * based on travel time from home base
 * 
 * SERVICE-AREA-FIX: Now returns full classification (IN_AREA/EXTENDED/OUT_OF_AREA)
 */
export async function evaluateServiceArea(
  tenantId: string,
  targetLat: number | null,
  targetLng: number | null,
  addressString?: string
): Promise<ServiceAreaResult> {
  if (!targetLat || !targetLng) {
    // Cannot evaluate without coordinates - treat as inside service area
    return { 
      classification: 'IN_AREA',
      inServiceArea: true, 
      isExtendedArea: false,
      travelMinutes: null, 
      softDeclineMessage: null 
    };
  }

  const tenantDb = wrapTenantDb(db, tenantId);

  const [config] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  if (!config?.homeBaseLat || !config?.homeBaseLng) {
    // If tenant has not configured home base, treat as inside service area
    console.warn('[SERVICE AREA] No home base configured for tenant:', tenantId);
    return { 
      classification: 'IN_AREA',
      inServiceArea: true, 
      isExtendedArea: false,
      travelMinutes: null, 
      softDeclineMessage: null 
    };
  }

  // Convert numeric to number for calculations
  const homeBaseLat = Number(config.homeBaseLat);
  const homeBaseLng = Number(config.homeBaseLng);
  const baseRadiusMinutes = config.serviceAreaMaxMinutes ?? 25;
  // SERVICE-AREA-FIX: Support extended radius from config
  const extendedRadiusMinutes = (config as any).serviceAreaExtendedMinutes ?? null;

  const travelMinutes = await getTravelTimeMinutes(
    homeBaseLat,
    homeBaseLng,
    targetLat,
    targetLng
  );

  if (travelMinutes == null) {
    // Could not calculate travel time - treat as inside service area
    console.warn('[SERVICE AREA] Could not calculate travel time for tenant:', tenantId);
    return { 
      classification: 'IN_AREA',
      inServiceArea: true, 
      isExtendedArea: false,
      travelMinutes: null, 
      softDeclineMessage: null 
    };
  }

  // SERVICE-AREA-FIX: Use the classification function
  const classification = classifyServiceArea({
    driveTimeMinutes: travelMinutes,
    baseRadiusMinutes,
    extendedRadiusMinutes,
  });

  const softDeclineMessage =
    config.serviceAreaSoftDeclineMessage ??
    'It appears your location is slightly outside our service area, but we do sometimes make exceptions.';

  // SERVICE-AREA-FIX: Log misclassifications for debugging (non-IN_AREA only)
  if (classification !== 'IN_AREA' && tenantId === 'root') {
    console.warn('[SERVICE AREA] Non-IN_AREA classification for root tenant:', {
      address: addressString || '(not provided)',
      geocodedLat: targetLat,
      geocodedLng: targetLng,
      homeBaseLat,
      homeBaseLng,
      travelMinutes,
      baseRadiusMinutes,
      extendedRadiusMinutes,
      classification,
    });
  }

  return {
    classification,
    inServiceArea: classification !== 'OUT_OF_AREA', // IN_AREA or EXTENDED both allow booking
    isExtendedArea: classification === 'EXTENDED',
    travelMinutes,
    softDeclineMessage: classification === 'OUT_OF_AREA' ? softDeclineMessage : null,
    debug: {
      address: addressString,
      geocodedLat: targetLat,
      geocodedLng: targetLng,
      homeBaseLat,
      homeBaseLng,
      baseRadiusMinutes,
      extendedRadiusMinutes,
    },
  };
}
