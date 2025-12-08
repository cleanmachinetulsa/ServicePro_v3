/**
 * Stripe Safe Call Wrapper (SP-27)
 * 
 * Wraps all Stripe API calls in try/catch with proper error handling:
 * - Returns structured result objects instead of throwing
 * - Logs WARN for expected config issues
 * - Logs ERROR only for truly unexpected failures
 * - Prevents route crashes when Stripe config is missing
 */

import { stripe, isStripeConfigured } from './stripeService';

export interface StripeSafeResult<T> {
  ok: boolean;
  result?: T;
  error?: string;
  code?: string;
}

type StripeErrorCode = 
  | 'NOT_CONFIGURED' 
  | 'MISSING_PRICE_ID' 
  | 'API_ERROR' 
  | 'RATE_LIMIT' 
  | 'AUTHENTICATION_ERROR'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Safely execute a Stripe API call with proper error handling
 * 
 * @param fn - Async function that makes the Stripe API call
 * @param context - Description of the operation for logging
 * @returns StripeSafeResult with ok=true and result, or ok=false and error details
 * 
 * @example
 * const result = await stripeSafeCall(
 *   () => stripe.customers.create({ email: 'test@example.com' }),
 *   'create customer'
 * );
 * if (!result.ok) {
 *   console.log('Failed:', result.error, result.code);
 * }
 */
export async function stripeSafeCall<T>(
  fn: () => Promise<T>,
  context: string
): Promise<StripeSafeResult<T>> {
  if (!isStripeConfigured() || !stripe) {
    console.warn(`[STRIPE SAFE] ${context}: Stripe not configured - operation skipped`);
    return {
      ok: false,
      error: 'Stripe not configured. Billing features are disabled.',
      code: 'NOT_CONFIGURED',
    };
  }

  try {
    const result = await fn();
    return { ok: true, result };
  } catch (error: any) {
    const errorCode = classifyStripeError(error);
    const errorMessage = error?.message || 'Unknown Stripe error';

    if (isExpectedError(errorCode)) {
      console.warn(`[STRIPE SAFE] ${context}: ${errorMessage} (${errorCode})`);
    } else {
      console.error(`[STRIPE SAFE] ${context}: ${errorMessage}`, {
        code: errorCode,
        type: error?.type,
        raw: error?.raw,
      });
    }

    return {
      ok: false,
      error: errorMessage,
      code: errorCode,
    };
  }
}

/**
 * Classify Stripe error into a standardized error code
 */
function classifyStripeError(error: any): StripeErrorCode {
  if (!error) return 'UNKNOWN_ERROR';

  const type = error.type || error.code;

  switch (type) {
    case 'StripeAuthenticationError':
    case 'authentication_error':
      return 'AUTHENTICATION_ERROR';
    case 'StripeRateLimitError':
    case 'rate_limit_error':
      return 'RATE_LIMIT';
    case 'StripeInvalidRequestError':
    case 'invalid_request_error':
      if (error.message?.includes('No such price')) return 'MISSING_PRICE_ID';
      return 'INVALID_REQUEST';
    case 'StripeAPIError':
    case 'api_error':
      return 'API_ERROR';
    case 'StripeConnectionError':
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
      return 'NETWORK_ERROR';
    default:
      if (error.message?.includes('network') || error.message?.includes('connection')) {
        return 'NETWORK_ERROR';
      }
      return 'UNKNOWN_ERROR';
  }
}

/**
 * Check if error is expected (should be WARN not ERROR)
 * Expected errors: config issues, rate limits, network issues
 * Unexpected errors: authentication, invalid requests (bugs)
 */
function isExpectedError(code: StripeErrorCode): boolean {
  return ['NOT_CONFIGURED', 'MISSING_PRICE_ID', 'RATE_LIMIT', 'NETWORK_ERROR'].includes(code);
}

/**
 * Get Stripe configuration health status
 * Used by /api/root/billing/health endpoint
 */
export function getStripeConfigHealth(): {
  hasStripeApiKey: boolean;
  hasWebhookSecret: boolean;
  defaultPriceIdsPresent: boolean;
  missingConfig: string[];
  isOperational: boolean;
} {
  const missingConfig: string[] = [];

  const hasStripeApiKey = !!process.env.STRIPE_SECRET_KEY;
  if (!hasStripeApiKey) missingConfig.push('STRIPE_SECRET_KEY');

  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  if (!hasWebhookSecret) missingConfig.push('STRIPE_WEBHOOK_SECRET');

  const hasStarterPrice = !!process.env.STRIPE_PRICE_STARTER;
  const hasProPrice = !!process.env.STRIPE_PRICE_PRO;
  const hasElitePrice = !!process.env.STRIPE_PRICE_ELITE;

  if (!hasStarterPrice) missingConfig.push('STRIPE_PRICE_STARTER');
  if (!hasProPrice) missingConfig.push('STRIPE_PRICE_PRO');
  if (!hasElitePrice) missingConfig.push('STRIPE_PRICE_ELITE');

  const defaultPriceIdsPresent = hasStarterPrice && hasProPrice && hasElitePrice;

  const isOperational = hasStripeApiKey && hasWebhookSecret;

  return {
    hasStripeApiKey,
    hasWebhookSecret,
    defaultPriceIdsPresent,
    missingConfig,
    isOperational,
  };
}

/**
 * Test Stripe API connectivity (for health checks)
 */
export async function testStripeConnectivity(): Promise<StripeSafeResult<{ connected: boolean }>> {
  return stripeSafeCall(
    async () => {
      if (!stripe) throw new Error('Stripe not configured');
      await stripe.balance.retrieve();
      return { connected: true };
    },
    'test connectivity'
  );
}
