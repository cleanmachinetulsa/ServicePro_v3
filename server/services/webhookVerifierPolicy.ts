import type { Request, Response } from 'express';

export type WebhookProvider = 'stripe' | 'facebook' | 'sendgrid' | 'square' | 'meta';

export interface WebhookFailure {
  provider: WebhookProvider;
  reason: 'missing_secret' | 'missing_signature' | 'invalid_signature' | 'malformed' | 'stale_timestamp';
  detail?: string;
}

const isProduction = () => process.env.NODE_ENV === 'production';

export function logWebhookWarning(failure: WebhookFailure): void {
  console.warn(`[WEBHOOK ${failure.provider.toUpperCase()}] ${failure.reason}${failure.detail ? `: ${failure.detail}` : ''}`);
}

export function logWebhookSecurityFailure(failure: WebhookFailure): void {
  console.error(`[WEBHOOK ${failure.provider.toUpperCase()}] SECURITY: ${failure.reason}${failure.detail ? `: ${failure.detail}` : ''}`);
}

/**
 * Centralized fail-closed policy for webhook signature verification.
 *
 * In production: every signature failure (missing secret, missing header, invalid HMAC,
 * stale timestamp, malformed payload) results in HTTP 401 with a structured warning log.
 *
 * In development: failures are logged as soft warnings and the handler is allowed to
 * continue so local testing without provider secrets remains possible. Set
 * WEBHOOK_VERIFY_STRICT=1 to force production-style enforcement in dev.
 *
 * Returns true if the request should proceed (dev soft-pass), false if the response
 * has already been written and the handler must stop.
 */
export function rejectIfProduction(res: Response, failure: WebhookFailure): boolean {
  const strict = isProduction() || process.env.WEBHOOK_VERIFY_STRICT === '1';
  if (strict) {
    logWebhookSecurityFailure(failure);
    if (!res.headersSent) {
      res.status(401).json({
        error: 'webhook_signature_invalid',
        provider: failure.provider,
        reason: failure.reason,
      });
    }
    return false;
  }
  logWebhookWarning({ ...failure, detail: `${failure.detail || ''} (dev soft-pass)` });
  return true;
}
