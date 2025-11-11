import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * Phone Number Utilities - E.164 Standard Enforcement
 * 
 * All phone numbers MUST be stored and transmitted in E.164 format:
 * - International format: +[country code][number]
 * - Example: +19188565711
 * 
 * Display formatting should ONLY happen at the UI presentation layer.
 */

/**
 * Convert any phone number input to E.164 format
 * @param input - Raw phone number (any format)
 * @param defaultCountry - Country code for parsing (default: US)
 * @returns E.164 formatted number or null if invalid
 * 
 * @example
 * toE164("(918) 856-5711") // "+19188565711"
 * toE164("918-856-5711")   // "+19188565711"
 * toE164("9188565711")     // "+19188565711"
 * toE164("invalid")        // null
 */
export function toE164(input: string, defaultCountry: CountryCode = 'US'): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    
    if (!parsed || !parsed.isValid()) {
      return null;
    }

    return parsed.number;
  } catch (error) {
    console.error('Phone parsing error:', error);
    return null;
  }
}

/**
 * Format E.164 number for display (national format)
 * @param e164 - Phone number in E.164 format
 * @returns Human-readable format or original if invalid
 * 
 * @example
 * toDisplay("+19188565711") // "(918) 856-5711"
 */
export function toDisplay(e164: string): string {
  if (!e164 || typeof e164 !== 'string') {
    return e164 || '';
  }

  try {
    const parsed = parsePhoneNumberFromString(e164);
    
    if (!parsed) {
      return e164;
    }

    return parsed.formatNational();
  } catch (error) {
    return e164;
  }
}

/**
 * Validate phone number without conversion
 * @param input - Phone number to validate
 * @param country - Country code for validation
 * @returns true if valid phone number
 * 
 * @example
 * isValid("(918) 856-5711") // true
 * isValid("123")            // false
 */
export function isValid(input: string, country: CountryCode = 'US'): boolean {
  return toE164(input, country) !== null;
}

/**
 * Extract country code from E.164 number
 * @param e164 - Phone number in E.164 format
 * @returns Country code or null
 * 
 * @example
 * getCountryCode("+19188565711") // "US"
 * getCountryCode("+447911123456") // "GB"
 */
export function getCountryCode(e164: string): string | null {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    return parsed?.country || null;
  } catch {
    return null;
  }
}

/**
 * Format for display with international code if not US
 * @param e164 - Phone number in E.164 format
 * @returns Formatted display string
 * 
 * @example
 * toDisplaySmart("+19188565711") // "(918) 856-5711"
 * toDisplaySmart("+447911123456") // "+44 7911 123456"
 */
export function toDisplaySmart(e164: string): string {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    
    if (!parsed) {
      return e164;
    }

    if (parsed.country === 'US') {
      return parsed.formatNational();
    }

    return parsed.formatInternational();
  } catch {
    return e164;
  }
}
