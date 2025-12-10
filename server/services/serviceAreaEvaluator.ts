import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { tenantConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getTravelTimeMinutes } from './travelTimeService';

/**
 * SP-BOOKING-ADDRESS+PRICING-FIX: Service area classification enum
 * - IN_AREA: Within normal service radius, proceed with booking
 * - EXTENDED: Beyond normal radius but within extended radius, needs escalation
 * - OUT_OF_AREA: Beyond all service radii, reject with message
 * - UNKNOWN: Geocode/routing failed, cannot determine area (keep customer on address step)
 */
export type ServiceAreaClassification = 'IN_AREA' | 'EXTENDED' | 'OUT_OF_AREA' | 'UNKNOWN';

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
 * SP-BOOKING-ADDRESS+PRICING-FIX: Enhanced service area evaluation result
 */
export interface ServiceAreaResult {
  classification: ServiceAreaClassification;
  inServiceArea: boolean; // Backwards compat: true for IN_AREA and EXTENDED
  isExtendedArea: boolean;
  isUnknown: boolean; // True when geocode/routing failed
  travelMinutes: number | null;
  softDeclineMessage: string | null;
  unknownMessage: string | null; // User-facing message for UNKNOWN classification
  // Debug info for troubleshooting (logged but not exposed to users)
  debug?: {
    address?: string;
    geocodedLat?: number;
    geocodedLng?: number;
    homeBaseLat?: number;
    homeBaseLng?: number;
    baseRadiusMinutes?: number;
    extendedRadiusMinutes?: number | null;
    errorReason?: string;
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
  // SP-BOOKING-ADDRESS+PRICING-FIX: Return UNKNOWN when coordinates missing (geocode failed)
  if (!targetLat || !targetLng) {
    console.error('[SERVICE_AREA_EVAL] UNKNOWN - Missing coordinates', {
      tenantId,
      address: addressString || '(not provided)',
      reason: 'Geocode failed or no coordinates provided',
    });
    return { 
      classification: 'UNKNOWN',
      inServiceArea: false, 
      isExtendedArea: false,
      isUnknown: true,
      travelMinutes: null, 
      softDeclineMessage: null,
      unknownMessage: 'We had trouble verifying your address. Please double-check it and try again.',
      debug: {
        address: addressString,
        errorReason: 'missing_coordinates',
      },
    };
  }

  const tenantDb = wrapTenantDb(db, tenantId);

  const [config] = await tenantDb
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantId, tenantId))
    .limit(1);

  if (!config?.homeBaseLat || !config?.homeBaseLng) {
    // If tenant has not configured home base, allow booking (no restriction)
    console.warn('[SERVICE_AREA_EVAL] No home base configured for tenant:', tenantId);
    return { 
      classification: 'IN_AREA',
      inServiceArea: true, 
      isExtendedArea: false,
      isUnknown: false,
      travelMinutes: null, 
      softDeclineMessage: null,
      unknownMessage: null,
    };
  }

  // Convert numeric to number for calculations
  const homeBaseLat = Number(config.homeBaseLat);
  const homeBaseLng = Number(config.homeBaseLng);
  const baseRadiusMinutes = config.serviceAreaMaxMinutes ?? 25;
  // SP-BOOKING-ADDRESS+PRICING-FIX: Support extended radius from config
  // null means extended area is disabled (no fallback to default)
  const extendedRadiusMinutes = config.serviceAreaExtendedMinutes ?? null;

  const travelMinutes = await getTravelTimeMinutes(
    homeBaseLat,
    homeBaseLng,
    targetLat,
    targetLng
  );

  // SP-BOOKING-ADDRESS+PRICING-FIX: Return UNKNOWN when travel time calculation fails
  if (travelMinutes == null) {
    console.error('[SERVICE_AREA_EVAL] UNKNOWN - Travel time calculation failed', {
      tenantId,
      address: addressString || '(not provided)',
      targetLat,
      targetLng,
      homeBaseLat,
      homeBaseLng,
      reason: 'Distance Matrix API failed or returned no data',
    });
    return { 
      classification: 'UNKNOWN',
      inServiceArea: false, 
      isExtendedArea: false,
      isUnknown: true,
      travelMinutes: null, 
      softDeclineMessage: null,
      unknownMessage: 'We had trouble calculating the drive time to your address. Please verify the address is correct.',
      debug: {
        address: addressString,
        geocodedLat: targetLat,
        geocodedLng: targetLng,
        homeBaseLat,
        homeBaseLng,
        errorReason: 'travel_time_calculation_failed',
      },
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

  // SP-BOOKING-ADDRESS+PRICING-FIX: Log EXTENDED and OUT_OF_AREA for debugging
  if (classification !== 'IN_AREA') {
    console.warn('[SERVICE_AREA_EVAL]', classification, {
      tenantId,
      address: addressString || '(not provided)',
      normalizedAddress: addressString || '(raw)',
      travelTimeMinutes: travelMinutes,
      baseRadiusMinutes,
      extendedRadiusMinutes,
      classification,
    });
  }

  return {
    classification,
    inServiceArea: classification !== 'OUT_OF_AREA', // IN_AREA or EXTENDED both allow booking
    isExtendedArea: classification === 'EXTENDED',
    isUnknown: false,
    travelMinutes,
    softDeclineMessage: classification === 'OUT_OF_AREA' ? softDeclineMessage : null,
    unknownMessage: null,
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
