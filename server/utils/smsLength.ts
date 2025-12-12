/**
 * SMS Length Control Utility
 * 
 * Hard-caps SMS responses to safe length (300 chars max, ~2 segments).
 * Automatically shortens by:
 * - Removing fluff words
 * - Reducing slot lists to max 3 options
 * - Shortening addresses
 */

const MAX_SMS_LENGTH = 300;
const MAX_SLOT_OPTIONS = 3;

interface TruncateOptions {
  maxLength?: number;
  maxSlots?: number;
}

const DEFAULT_FALLBACK = "Thanks for your message!";

/**
 * Truncate SMS response to safe length
 * @param response - Original AI response
 * @param options - Truncation options
 * @returns Truncated response (guaranteed non-empty)
 */
export function truncateSmsResponse(response: string, options: TruncateOptions = {}): string {
  const maxLength = options.maxLength || MAX_SMS_LENGTH;
  const maxSlots = options.maxSlots || MAX_SLOT_OPTIONS;
  
  // Safeguard: ensure we always have something to work with
  if (!response || response.trim().length === 0) {
    return DEFAULT_FALLBACK;
  }
  
  if (response.length <= maxLength) {
    return response;
  }
  
  const originalLength = response.length;
  let result = response;
  
  // Step 1: Reduce slot lists to max 3 options
  result = reduceSlotList(result, maxSlots);
  
  // Step 2: Remove fluff phrases
  result = removeFluffPhrases(result);
  
  // Step 3: Normalize whitespace after fluff removal
  result = result.replace(/\s{2,}/g, ' ').trim();
  
  // Safeguard: if removing fluff left us empty or too short, use original
  if (!result || result.length < 10) {
    result = response;
  }
  
  // Step 4: Shorten addresses
  result = shortenAddresses(result);
  
  // Normalize whitespace again
  result = result.replace(/\s{2,}/g, ' ').trim();
  
  // Step 5: Hard truncate if still too long
  if (result.length > maxLength) {
    // Try to break at sentence boundary
    const sentenceEnd = result.lastIndexOf('.', maxLength - 3);
    if (sentenceEnd > maxLength / 2) {
      result = result.substring(0, sentenceEnd + 1).trim();
    } else {
      // Hard truncate with ellipsis
      result = result.substring(0, maxLength - 3).trim() + '...';
    }
  }
  
  // Final safeguard: never return empty
  if (!result || result.trim().length === 0) {
    console.warn('[SMS LENGTH] Truncation resulted in empty string, using fallback');
    return DEFAULT_FALLBACK;
  }
  
  if (result.length < originalLength) {
    console.log(`[SMS LENGTH] truncated from ${originalLength} to ${result.length}`);
  }
  
  return result;
}

/**
 * Reduce numbered slot lists to max N options
 */
function reduceSlotList(text: string, maxSlots: number): string {
  // Match numbered lists like "1. Saturday Dec 14\n2. Sunday Dec 15\n3. Monday Dec 16\n4. Tuesday Dec 17"
  const listPattern = /(\d+)\.\s*([^\n]+)/g;
  const matches = [...text.matchAll(listPattern)];
  
  if (matches.length <= maxSlots) {
    return text;
  }
  
  // Find the first slot after max and remove everything from there
  let lastKeepEnd = 0;
  for (let i = 0; i < Math.min(matches.length, maxSlots); i++) {
    lastKeepEnd = matches[i].index! + matches[i][0].length;
  }
  
  // Find where remaining items start
  if (matches.length > maxSlots) {
    const nextItemStart = matches[maxSlots].index!;
    // Remove items after maxSlots
    const before = text.substring(0, lastKeepEnd);
    const afterMatches = text.substring(nextItemStart);
    // Find end of list (next non-list content)
    const listEndMatch = afterMatches.match(/[^\d\.\s\n][^\n]*/);
    const after = listEndMatch ? afterMatches.substring(listEndMatch.index!) : '';
    
    return before + '\n' + after;
  }
  
  return text;
}

/**
 * Remove common fluff phrases
 */
function removeFluffPhrases(text: string): string {
  const fluffPatterns = [
    /I'd be happy to help you with that[.!]?\s*/gi,
    /I can definitely help with that[.!]?\s*/gi,
    /Absolutely[,!]?\s*/gi,
    /Of course[,!]?\s*/gi,
    /Sure thing[,!]?\s*/gi,
    /No problem[,!]?\s*/gi,
    /Great question[,!]?\s*/gi,
    /Thanks for reaching out[,!]?\s*/gi,
    /Thank you for contacting us[,!]?\s*/gi,
    /We appreciate your business[,!]?\s*/gi,
    /Please let me know if you have any other questions[.!]?\s*/gi,
    /Feel free to reach out if you need anything else[.!]?\s*/gi,
    /Don't hesitate to contact us[.!]?\s*/gi,
    /Have a great day[,!]?\s*/gi,
    /Looking forward to hearing from you[.!]?\s*/gi,
  ];
  
  let result = text;
  for (const pattern of fluffPatterns) {
    result = result.replace(pattern, '');
  }
  
  return result.trim();
}

/**
 * Shorten long addresses to abbreviated form
 * "3318 South 73rd West Avenue, Tulsa, OK 74132" → "3318 S 73rd W Ave"
 */
function shortenAddresses(text: string): string {
  const addressPatterns: [RegExp, string][] = [
    [/\bSouth\b/gi, 'S'],
    [/\bNorth\b/gi, 'N'],
    [/\bEast\b/gi, 'E'],
    [/\bWest\b/gi, 'W'],
    [/\bAvenue\b/gi, 'Ave'],
    [/\bStreet\b/gi, 'St'],
    [/\bBoulevard\b/gi, 'Blvd'],
    [/\bDrive\b/gi, 'Dr'],
    [/\bRoad\b/gi, 'Rd'],
    [/\bLane\b/gi, 'Ln'],
    [/\bCourt\b/gi, 'Ct'],
    [/\bCircle\b/gi, 'Cir'],
    [/\bPlace\b/gi, 'Pl'],
    [/,\s*Oklahoma\s+\d{5}/gi, ''],
    [/,\s*OK\s+\d{5}/gi, ''],
    [/,\s*Tulsa\s*,?\s*/gi, ', '],
  ];
  
  let result = text;
  for (const [pattern, replacement] of addressPatterns) {
    result = result.replace(pattern, replacement);
  }
  
  // Clean up double spaces and trailing commas
  result = result.replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
  
  return result;
}

/**
 * Get the segment count for an SMS message
 * GSM-7: 160 chars for 1 segment, 153 for subsequent
 * UCS-2 (Unicode): 70 chars for 1 segment, 67 for subsequent
 */
export function getSmsSegmentCount(text: string): number {
  if (!text) return 0;
  
  // Check if message needs UCS-2 encoding (contains non-GSM characters)
  const needsUcs2 = /[^\u0020-\u007E\u00A0-\u00FF]/.test(text);
  
  if (needsUcs2) {
    if (text.length <= 70) return 1;
    return Math.ceil(text.length / 67);
  } else {
    if (text.length <= 160) return 1;
    return Math.ceil(text.length / 153);
  }
}
