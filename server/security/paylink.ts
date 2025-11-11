import crypto from "crypto";

const ALG = "sha256";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate HMAC-signed payment token for secure invoice payment links
 * Format: {invoiceId}.{exp}.{sig}
 * 
 * @param invoiceId - The invoice ID to sign
 * @param now - Current timestamp (optional, for testing)
 * @returns Signed token string
 */
export function signPayToken(invoiceId: number, now = Math.floor(Date.now() / 1000)): string {
  const secret = process.env.PAYLINK_SECRET;
  
  if (!secret) {
    throw new Error('PAYLINK_SECRET environment variable is not set');
  }
  
  const exp = now + TTL_SECONDS;
  const payload = `${invoiceId}.${exp}`;
  const sig = crypto
    .createHmac(ALG, secret)
    .update(payload)
    .digest("base64url");
  
  return `${payload}.${sig}`;
}

/**
 * Verify HMAC-signed payment token and extract invoice ID
 * 
 * @param token - The signed token to verify
 * @param now - Current timestamp (optional, for testing)
 * @returns Object with ok=true and invoiceId, or ok=false and reason
 */
export function verifyPayToken(
  token: string,
  now = Math.floor(Date.now() / 1000)
): 
  | { ok: true; invoiceId: number }
  | { ok: false; reason: "malformed" | "bad_sig" | "expired" } {
  
  const secret = process.env.PAYLINK_SECRET;
  
  if (!secret) {
    throw new Error('PAYLINK_SECRET environment variable is not set');
  }
  
  const [idStr, expStr, sig] = token.split(".");
  
  if (!idStr || !expStr || !sig) {
    return { ok: false, reason: "malformed" };
  }
  
  const payload = `${idStr}.${expStr}`;
  const expected = crypto
    .createHmac(ALG, secret)
    .update(payload)
    .digest("base64url");
  
  // Convert to buffers for comparison
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  
  // CRITICAL: Check buffer lengths before timingSafeEqual to prevent DoS
  if (expectedBuf.length !== sigBuf.length) {
    return { ok: false, reason: "bad_sig" };
  }
  
  // Now safe to use timing-safe comparison
  if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    return { ok: false, reason: "bad_sig" };
  }
  
  if (now > parseInt(expStr, 10)) {
    return { ok: false, reason: "expired" };
  }
  
  return { ok: true, invoiceId: parseInt(idStr, 10) };
}

/**
 * Get TTL duration in seconds
 */
export function getPayLinkTTL(): number {
  return TTL_SECONDS;
}

/**
 * Format TTL as human-readable string
 */
export function formatPayLinkTTL(): string {
  const days = Math.floor(TTL_SECONDS / (60 * 60 * 24));
  return `${days} days`;
}
