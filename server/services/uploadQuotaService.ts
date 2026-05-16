/**
 * Anonymous Upload Quota (Audit T1 W-8)
 *
 * Per-session 5-photo / 25-MB / 24-hour cap on /api/upload-photo before
 * a customer has provided verified identity. In-memory tracking is
 * sufficient: this guard exists to stop opportunistic abuse, not to
 * survive process restarts.
 */
const MAX_PHOTOS_PER_SESSION = 5;
const MAX_BYTES_PER_SESSION = 25 * 1024 * 1024; // 25 MB
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface Bucket { uploads: { ts: number; bytes: number }[] }
const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket): Bucket {
  const cutoff = Date.now() - WINDOW_MS;
  bucket.uploads = bucket.uploads.filter((u) => u.ts > cutoff);
  return bucket;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: 'photo_count' | 'byte_total';
  remainingPhotos: number;
  remainingBytes: number;
}

export function checkAndRecordUpload(sessionKey: string, sizeBytes: number): QuotaCheckResult {
  let bucket = buckets.get(sessionKey);
  if (!bucket) { bucket = { uploads: [] }; buckets.set(sessionKey, bucket); }
  prune(bucket);

  const usedBytes = bucket.uploads.reduce((sum, u) => sum + u.bytes, 0);
  const usedCount = bucket.uploads.length;

  if (usedCount + 1 > MAX_PHOTOS_PER_SESSION) {
    return {
      allowed: false,
      reason: 'photo_count',
      remainingPhotos: 0,
      remainingBytes: Math.max(0, MAX_BYTES_PER_SESSION - usedBytes),
    };
  }
  if (usedBytes + sizeBytes > MAX_BYTES_PER_SESSION) {
    return {
      allowed: false,
      reason: 'byte_total',
      remainingPhotos: Math.max(0, MAX_PHOTOS_PER_SESSION - usedCount),
      remainingBytes: Math.max(0, MAX_BYTES_PER_SESSION - usedBytes),
    };
  }

  bucket.uploads.push({ ts: Date.now(), bytes: sizeBytes });
  return {
    allowed: true,
    remainingPhotos: MAX_PHOTOS_PER_SESSION - (usedCount + 1),
    remainingBytes: MAX_BYTES_PER_SESSION - (usedBytes + sizeBytes),
  };
}

export function getAnonymousSessionKey(req: { ip?: string; body?: any; headers?: any; session?: any }): string {
  const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || 'unknown';
  // Audit T1 (round-6 hardening): the quota key MUST be server-trusted —
  // client-supplied session IDs can be rotated freely. Use the express
  // server-issued session id (cookie-bound) + ip. Client-supplied values
  // are intentionally ignored here.
  const serverSession = req.session?.id || 'no-session';
  return `${ip}::${serverSession}`;
}

export const QUOTA_LIMITS = { MAX_PHOTOS_PER_SESSION, MAX_BYTES_PER_SESSION, WINDOW_MS };

/** Test-only helper. */
export function _clearQuotaBuckets() { buckets.clear(); }
