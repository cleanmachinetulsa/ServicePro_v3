import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * Client-Side Phone Number Utilities - E.164 Standard Enforcement
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
 * Format as user types - allows any input but provides visual feedback
 * @param input - Raw user input
 * @returns Formatted display string (does NOT enforce E.164)
 * 
 * @example
 * formatAsYouType("9188565711") // "(918) 856-5711"
 * formatAsYouType("918856")     // "(918) 856"
 */
export function formatAsYouType(input: string, defaultCountry: CountryCode = 'US'): string {
  if (!input) return '';
  
  try {
    const parsed = parsePhoneNumberFromString(input, defaultCountry);
    
    if (parsed) {
      return parsed.formatNational();
    }
    
    return input;
  } catch {
    return input;
  }
}
