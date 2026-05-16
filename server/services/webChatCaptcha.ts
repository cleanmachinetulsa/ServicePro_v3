/**
 * Web Chat Captcha Verification (Audit T1 W-1)
 *
 * First message of a web-chat session must clear an invisible captcha
 * (Cloudflare Turnstile or hCaptcha — auto-detected from env).
 * Subsequent messages in the same session are not re-prompted.
 *
 * Fail-open in dev (no secret configured) so local development isn't broken;
 * fail-closed in production unless WEB_CHAT_CAPTCHA_DISABLED=1 is set.
 */

const verifiedSessions = new Map<string, number>(); // sessionId -> verifiedAt
const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [k, ts] of verifiedSessions) {
    if (now - ts > VERIFIED_TTL_MS) verifiedSessions.delete(k);
  }
}

export function isSessionVerified(sessionId: string): boolean {
  pruneExpired();
  const ts = verifiedSessions.get(sessionId);
  if (!ts) return false;
  if (Date.now() - ts > VERIFIED_TTL_MS) {
    verifiedSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function markSessionVerified(sessionId: string) {
  verifiedSessions.set(sessionId, Date.now());
}

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'none';

export function getProvider(): CaptchaProvider {
  if (process.env.TURNSTILE_SECRET_KEY) return 'turnstile';
  if (process.env.HCAPTCHA_SECRET_KEY) return 'hcaptcha';
  return 'none';
}

/**
 * Verify a captcha token. Returns true if verified or if captcha is
 * unconfigured in non-production environments.
 */
export async function verifyCaptchaToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const provider = getProvider();

  if (provider === 'none') {
    if (process.env.NODE_ENV === 'production' && process.env.WEB_CHAT_CAPTCHA_DISABLED !== '1') {
      console.warn('[WEB CHAT CAPTCHA] No captcha provider configured in production. Set TURNSTILE_SECRET_KEY or HCAPTCHA_SECRET_KEY, or WEB_CHAT_CAPTCHA_DISABLED=1 to acknowledge.');
      return { ok: false, reason: 'captcha_not_configured' };
    }
    return { ok: true };
  }

  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' };

  try {
    const url = provider === 'turnstile'
      ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      : 'https://hcaptcha.com/siteverify';
    const secret = provider === 'turnstile'
      ? process.env.TURNSTILE_SECRET_KEY!
      : process.env.HCAPTCHA_SECRET_KEY!;

    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);

    const resp = await fetch(url, { method: 'POST', body });
    if (!resp.ok) return { ok: false, reason: `provider_http_${resp.status}` };
    const data: any = await resp.json();
    if (data?.success === true) return { ok: true };
    return { ok: false, reason: Array.isArray(data?.['error-codes']) ? data['error-codes'].join(',') : 'invalid_token' };
  } catch (err: any) {
    console.warn('[WEB CHAT CAPTCHA] Verify failed:', err?.message);
    return { ok: false, reason: 'verify_error' };
  }
}

/** Test-only helper. */
export function _clearVerifiedSessions() { verifiedSessions.clear(); }
