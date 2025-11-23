/**
 * Server-side wrapper for industry bootstrap data.
 * Re-exports the bootstrap configuration from the client config for use in backend.
 */

// Import the bootstrap data (TypeScript will handle this properly)
import { INDUSTRY_BOOTSTRAP_MAP } from '../client/src/config/industryBootstrapDefaults';

export { INDUSTRY_BOOTSTRAP_MAP };

/**
 * Get bootstrap data for a specific industry.
 * Returns null if industry not found or no bootstrap data available.
 */
export function getBootstrapDataForIndustry(industryId: string) {
  return INDUSTRY_BOOTSTRAP_MAP[industryId] || null;
}

/**
 * Check if bootstrap data exists for an industry.
 */
export function hasBootstrapData(industryId: string): boolean {
  return industryId in INDUSTRY_BOOTSTRAP_MAP;
}

/**
 * Get all industry IDs that have bootstrap data.
 */
export function getIndustriesWithBootstrap(): string[] {
  return Object.keys(INDUSTRY_BOOTSTRAP_MAP);
}
