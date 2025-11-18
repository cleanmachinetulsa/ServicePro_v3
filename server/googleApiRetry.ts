/**
 * Google API Retry Logic with Exponential Backoff
 * Handles transient failures for Calendar, Sheets, and other Google APIs
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000, // Start with 1 second
  maxDelayMs: 10000, // Cap at 10 seconds
  backoffMultiplier: 2, // Double delay each retry
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ERR_NETWORK',
    'socket hang up',
    'network timeout'
  ]
};

/**
 * Check if error is retryable based on error code or HTTP status
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  // Check error code/message (safely handle numeric codes)
  const errorCode = typeof error.code === 'string' ? error.code : String(error.code || '');
  const errorMessage = (error.message || '').toLowerCase();
  
  // Only use .includes() if errorCode is actually a string
  if (typeof error.code === 'string' && retryableErrors.some(code => 
    errorCode.includes(code) || errorMessage.includes(code.toLowerCase())
  )) {
    return true;
  }
  
  // Check HTTP status codes
  const status = error.response?.status || error.status;
  
  // Retryable HTTP status codes:
  // 408 - Request Timeout
  // 429 - Too Many Requests (rate limit)
  // 500 - Internal Server Error
  // 502 - Bad Gateway
  // 503 - Service Unavailable
  // 504 - Gateway Timeout
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  
  // Google API specific errors
  if (error.message?.includes('quota exceeded') || 
      error.message?.includes('rate limit') ||
      error.message?.includes('backend error')) {
    return true;
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @param context - Description for logging (e.g., "Google Calendar fetch events")
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'Google API operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if this is the last attempt
      if (attempt === opts.maxRetries) {
        console.error(`[RETRY] ${context} failed after ${opts.maxRetries} attempts:`, {
          error: error.message,
          code: error.code,
          status: error.response?.status
        });
        throw error;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableErrors)) {
        console.error(`[RETRY] ${context} failed with non-retryable error:`, {
          error: error.message,
          code: error.code,
          status: error.response?.status
        });
        throw error;
      }
      
      // Log retry attempt
      console.warn(`[RETRY] ${context} failed (attempt ${attempt}/${opts.maxRetries}), retrying in ${delay}ms:`, {
        error: error.message,
        code: error.code,
        status: error.response?.status
      });
      
      // Wait before retrying
      await sleep(delay);
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Google Calendar specific retry wrapper
 */
export async function retryCalendarOperation<T>(
  fn: () => Promise<T>,
  context: string = 'Calendar operation'
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000
  }, `Google Calendar: ${context}`);
}

/**
 * Google Sheets specific retry wrapper
 */
export async function retrySheetsOperation<T>(
  fn: () => Promise<T>,
  context: string = 'Sheets operation'
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000
  }, `Google Sheets: ${context}`);
}

/**
 * Google Drive specific retry wrapper
 */
export async function retryDriveOperation<T>(
  fn: () => Promise<T>,
  context: string = 'Drive operation'
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000
  }, `Google Drive: ${context}`);
}
