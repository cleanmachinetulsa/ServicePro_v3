import { Request, Response, NextFunction } from 'express';
import { toE164, isValid } from '../utils/phone';

/**
 * Phone Normalization Middleware
 * 
 * Automatically validates and normalizes phone numbers in request body to E.164 format.
 * Apply this middleware to routes that accept phone numbers.
 * 
 * Usage:
 *   app.post('/api/endpoint', normalizePhone(['phoneField']), handler);
 *   app.post('/api/endpoint', normalizePhone(['to', 'from']), handler);
 */

interface PhoneNormalizationOptions {
  fields: string[];
  required?: boolean;
  skipValidation?: boolean;
}

/**
 * Middleware factory to normalize phone number fields
 * @param fields - Array of field names to normalize (e.g., ['phone', 'to', 'from'])
 * @param options - Configuration options
 */
export function normalizePhone(
  fields: string | string[],
  options: { required?: boolean; skipValidation?: boolean } = {}
) {
  const fieldArray = Array.isArray(fields) ? fields : [fields];
  const { required = false, skipValidation = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const field of fieldArray) {
        if (field === '__proto__' || field === 'constructor' || field === 'prototype') {
          continue;
        }
        const phoneValue = req.body[field];

        // Skip if field is not present
        if (!phoneValue || phoneValue.trim() === '') {
          if (required) {
            return res.status(400).json({
              success: false,
              message: `${field} is required`,
            });
          }
          continue;
        }

        // Validate phone number format
        if (!skipValidation && !isValid(phoneValue)) {
          return res.status(400).json({
            success: false,
            message: `Invalid phone number format for ${field}`,
            field,
          });
        }

        // Convert to E.164
        const e164Phone = toE164(phoneValue);
        if (!e164Phone) {
          return res.status(400).json({
            success: false,
            message: `Unable to process phone number for ${field}`,
            field,
          });
        }

        // Replace original value with E.164 normalized version
        req.body[field] = e164Phone;
        console.log(`[PHONE NORM] ${field}: ${phoneValue} → ${e164Phone}`);
      }

      next();
    } catch (error) {
      console.error('Phone normalization middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Phone number processing failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Normalize phone numbers in query parameters
 * @param fields - Array of query parameter names to normalize
 */
export function normalizePhoneQuery(
  fields: string | string[],
  options: { required?: boolean } = {}
) {
  const fieldArray = Array.isArray(fields) ? fields : [fields];
  const { required = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const field of fieldArray) {
        if (field === '__proto__' || field === 'constructor' || field === 'prototype') {
          continue;
        }
        const phoneValue = req.query[field] as string;

        if (!phoneValue || phoneValue.trim() === '') {
          if (required) {
            return res.status(400).json({
              success: false,
              message: `${field} is required`,
            });
          }
          continue;
        }

        if (!isValid(phoneValue)) {
          return res.status(400).json({
            success: false,
            message: `Invalid phone number format for ${field}`,
            field,
          });
        }

        const e164Phone = toE164(phoneValue);
        if (!e164Phone) {
          return res.status(400).json({
            success: false,
            message: `Unable to process phone number for ${field}`,
            field,
          });
        }

        req.query[field] = e164Phone;
        console.log(`[PHONE NORM QUERY] ${field}: ${phoneValue} → ${e164Phone}`);
      }

      next();
    } catch (error) {
      console.error('Phone normalization query middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Phone number processing failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
