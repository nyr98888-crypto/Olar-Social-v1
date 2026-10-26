/**
 * Simple in-memory IP/user rate limiter.
 * Serverless: Map is per-instance — enough for soft abuse protection.
 */

const WINDOW_MS = 30_000;
const MAX_HITS = 3;

const hitsByKey = new Map<string, number[]>();

/** Soft-trim timestamps older than the window. */
function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < WINDOW_MS);
}

/**
 * Returns true if the key is allowed; records the hit when allowed.
 * Returns false when the key already has MAX_HITS inside WINDOW_MS.
 */
export function checkIpRateLimit(key: string): boolean {
  const now = Date.now();
  const prev = prune(hitsByKey.get(key) ?? [], now);
  if (prev.length >= MAX_HITS) {
    hitsByKey.set(key, prev);
    return false;
  }
  prev.push(now);
  hitsByKey.set(key, prev);

  // Opportunistic soft-trim of stale keys
  if (hitsByKey.size > 500) {
    for (const [k, ts] of hitsByKey) {
      const kept = prune(ts, now);
      if (kept.length === 0) hitsByKey.delete(k);
      else hitsByKey.set(k, kept);
    }
  }

  return true;
}

export const GENERATE_POST_RATE_LIMIT_MESSAGE =
  "אנא המתן מספר שניות לפני יצירת פוסט נוסף.";

/** Vercel-friendly client IP from request headers. */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
