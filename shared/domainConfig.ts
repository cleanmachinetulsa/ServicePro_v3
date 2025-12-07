/**
 * CM-DNS-2 & CM-DNS-3: Domain configuration for Clean Machine custom domain support
 * 
 * This configuration enables the app to detect when it's being accessed via
 * the Clean Machine custom domain and redirect visitors appropriately.
 * CM-DNS-3 adds canonical redirect support (www → root, http → https).
 */

export const CLEAN_MACHINE_DOMAIN = 
  (typeof process !== 'undefined' && process.env?.CLEAN_MACHINE_DOMAIN) || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLEAN_MACHINE_DOMAIN) ||
  "cleanmachinetulsa.com";

export const CLEAN_MACHINE_TENANT_SLUG = "cleanmachine";

export const CLEAN_MACHINE_ROOT = "cleanmachinetulsa.com";
export const CLEAN_MACHINE_WWW = "www.cleanmachinetulsa.com";

export const CLEAN_MACHINE_CANONICAL_URL = "https://cleanmachinetulsa.com";
