/**
 * Audit T2 Task #20 — sp_chat HttpOnly signed cookie for web-chat identity.
 *
 * The cookie's only payload is a stable random `webId` per browser. The widget
 * uses this server-issued id (instead of the localStorage-only sessionId) as
 * the durable handle for the visitor's conversation and SSE subscription.
 *
 * Format: <base64url(json)>.<base64url(hmac-sha256)>
 * Signed with SESSION_SECRET. 30-day expiry, HttpOnly + SameSite=Lax. Secure in
 * production (TLS is terminated by the platform proxy and forwarded via
 * x-forwarded-proto, which Express sees because `trust proxy` is enabled).
 */

import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'sp_chat';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CookiePayload {
  webId: string;
  iat: number;
}

class WebChatCookieSecretError extends Error {
  constructor() {
    super('SESSION_SECRET is missing or too short; sp_chat web-chat cookies disabled');
    this.name = 'WebChatCookieSecretError';
  }
}

/**
 * Audit T2 Task #20 (code-review fix): fail closed in production.
 *
 * If SESSION_SECRET is missing or weak we MUST refuse to sign/verify cookies
 * rather than fall back to a hardcoded value — otherwise the sp_chat handle
 * (which gates /api/web-chat/stream ownership and identity binding) becomes
 * forgeable. In development we still accept a shorter secret to keep local
 * testing easy, but never use a hardcoded default.
 */
function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const minLen = isProd ? 32 : 8;
  if (!s || s.length < minLen) {
    if (isProd) {
      console.error('[WEB CHAT COOKIE] SESSION_SECRET missing or < 32 chars in production — sp_chat cookie issuance and verification are DISABLED. Set SESSION_SECRET to enable the web-chat live SSE channel.');
    } else {
      console.warn('[WEB CHAT COOKIE] SESSION_SECRET missing or weak — web-chat cookie disabled for this request (dev).');
    }
    throw new WebChatCookieSecretError();
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function sign(payload: CookiePayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyCookieValue(value: string | undefined | null): CookiePayload | null {
  if (!value || typeof value !== 'string' || !value.includes('.')) return null;
  const [body, sig] = value.split('.', 2);
  if (!body || !sig) return null;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null; // fail closed — no secret, no trust
  }
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    ok = false;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as CookiePayload;
    if (!payload?.webId || typeof payload.webId !== 'string') return null;
    if (typeof payload.iat !== 'number') return null;
    if (Date.now() - payload.iat > COOKIE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readWebChatCookie(req: Request): string | null {
  const raw = (req.cookies?.[COOKIE_NAME] as string | undefined) ?? null;
  const payload = verifyCookieValue(raw);
  return payload?.webId ?? null;
}

/**
 * Ensure the visitor has an sp_chat cookie. If absent or invalid, issue a new
 * one and set it on the response. Returns the resolved webId, or null if the
 * server cannot sign cookies (missing/weak SESSION_SECRET in production).
 * Callers MUST handle null and either degrade the live SSE channel or
 * fall back to the legacy client-supplied sessionId.
 */
export function ensureWebChatCookie(req: Request, res: Response): string | null {
  const existing = readWebChatCookie(req);
  if (existing) return existing;
  const webId = `wc-${crypto.randomBytes(12).toString('hex')}`;
  let signed: string;
  try {
    signed = sign({ webId, iat: Date.now() });
  } catch {
    return null;
  }
  res.cookie(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
  return webId;
}

export function webIdentifierFor(webId: string): string {
  return `web-chat-${webId}`;
}

/**
 * Audit T2 Task #20 (round 2) — upsert the (tenant_id, web_id) row in
 * web_chat_identities. Called on /api/web-chat/config (every page load) so
 * the durable identity record exists before the visitor sends anything.
 * Safe to call repeatedly; non-fatal on error.
 */
export async function upsertWebChatIdentity(
  tenantDb: any,
  tenantId: string,
  webId: string,
  patch?: { customerId?: number | null; lastConversationId?: number | null },
): Promise<void> {
  try {
    const { webChatIdentities } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');
    const setClause: Record<string, any> = { updatedAt: new Date() };
    if (patch?.customerId !== undefined) setClause.customerId = patch.customerId;
    if (patch?.lastConversationId !== undefined) setClause.lastConversationId = patch.lastConversationId;
    await tenantDb
      .insert(webChatIdentities)
      .values({
        tenantId,
        webId,
        customerId: patch?.customerId ?? null,
        lastConversationId: patch?.lastConversationId ?? null,
      })
      .onConflictDoUpdate({
        target: [webChatIdentities.tenantId, webChatIdentities.webId],
        set: setClause,
      });
  } catch (err) {
    console.warn('[WEB CHAT IDENTITY] upsert failed (non-fatal):', err);
  }
}
