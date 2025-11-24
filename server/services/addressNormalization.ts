/**
 * Phase 16 - Address Normalization Service
 * 
 * Provides simple address normalization for household grouping.
 * Converts addresses to a canonical format to identify customers
 * living at the same address despite minor variations in how
 * the address is entered.
 */

export interface RawAddress {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Normalize an address into a canonical string format for household matching
 * 
 * @param raw - Raw address components
 * @returns Normalized address string or null if insufficient data
 * 
 * @example
 * normalizeAddress({
 *   addressLine1: '123 Main St.',
 *   city: 'Tulsa',
 *   state: 'OK',
 *   postalCode: '74105'
 * })
 * // Returns: "123 MAIN ST | TULSA | OK | 74105 | USA"
 */
export function normalizeAddress(raw: RawAddress): string | null {
  const parts: string[] = [];

  const line1 = raw.addressLine1?.trim();
  const line2 = raw.addressLine2?.trim();
  const city = raw.city?.trim();
  const state = raw.state?.trim();
  const postal = raw.postalCode?.trim();
  const country = raw.country?.trim() || 'USA';

  // Need at least line1 or city+postal to form a household key
  if (!line1 && !city && !postal) {
    return null;
  }

  /**
   * Normalize a single address component
   * - Convert to uppercase
   * - Remove periods
   * - Collapse multiple spaces
   */
  function norm(s: string | undefined | null): string | null {
    if (!s) return null;
    return s
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const nLine1 = norm(line1);
  const nLine2 = norm(line2);
  const nCity = norm(city);
  const nState = norm(state);
  const nPostal = postal ? postal.replace(/\s+/g, '') : null;
  const nCountry = norm(country);

  // Build normalized address string
  if (nLine1) parts.push(nLine1);
  if (nLine2) parts.push(nLine2);
  if (nCity) parts.push(nCity);
  if (nState) parts.push(nState);
  if (nPostal) parts.push(nPostal);
  if (nCountry) parts.push(nCountry);

  if (parts.length === 0) return null;

  return parts.join(' | ');
}

/**
 * Parse a full address string into components (best-effort)
 * 
 * @param fullAddress - Full address as a single string
 * @returns Parsed address components
 * 
 * @example
 * parseAddress("123 Main St, Tulsa, OK 74105")
 * // Returns: { addressLine1: "123 Main St", city: "Tulsa", state: "OK", postalCode: "74105" }
 */
export function parseAddress(fullAddress: string | null | undefined): RawAddress {
  if (!fullAddress) {
    return {};
  }

  const address = fullAddress.trim();
  
  // Basic regex patterns for US addresses
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
  const stateMatch = address.match(/,?\s*([A-Z]{2})\s*\d{5}/);
  
  let postalCode: string | undefined;
  let state: string | undefined;
  let remainder = address;

  if (zipMatch) {
    postalCode = zipMatch[1];
    remainder = remainder.replace(zipMatch[0], '').trim();
  }

  if (stateMatch) {
    state = stateMatch[1];
    remainder = remainder.replace(stateMatch[0], '').trim();
  }

  // Split by comma to get address line and city
  const parts = remainder.split(',').map(p => p.trim()).filter(Boolean);
  
  let addressLine1: string | undefined;
  let city: string | undefined;

  if (parts.length >= 2) {
    addressLine1 = parts[0];
    city = parts[1];
  } else if (parts.length === 1) {
    addressLine1 = parts[0];
  }

  return {
    addressLine1,
    city,
    state,
    postalCode,
  };
}
