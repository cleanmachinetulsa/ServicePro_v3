/**
 * CM-DNS-2: Domain configuration for Clean Machine custom domain support
 * 
 * This configuration enables the app to detect when it's being accessed via
 * the Clean Machine custom domain and redirect visitors appropriately.
 */

export const CLEAN_MACHINE_DOMAIN = 
  (typeof process !== 'undefined' && process.env?.CLEAN_MACHINE_DOMAIN) || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLEAN_MACHINE_DOMAIN) ||
  "cleanmachinetulsa.com";

export const CLEAN_MACHINE_TENANT_SLUG = "cleanmachine";
