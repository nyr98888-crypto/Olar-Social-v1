/**
 * Client fetch helper: short UX timeout + one retry on cold-start / gateway errors.
 */

export const CLIENT_CHAT_TIMEOUT_MS = 45_000;
export const CLIENT_IMAGE_TIMEOUT_MS = 40_000;

const RETRYABLE = new Set([502, 503, 504]);

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      /timed out|aborted/i.test(err.message))
  );
}

export type FetchJsonResult = {
  res: Response;
  data: Record<string, unknown>;
};

/**
 * POST/GET JSON with AbortSignal.timeout and a single retry on 502/504/network blip.
 */
export async function fetchJsonWithRetry(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<FetchJsonResult> {
  const { timeoutMs = CLIENT_CHAT_TIMEOUT_MS, ...rest } = init;
  const maxAttempts = 2;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, {
        ...rest,
        signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (RETRYABLE.has(res.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
        continue;
      }

      return { res, data };
    } catch (err) {
      lastErr = err;
      // Retry once on abort/timeout only for likely cold starts (short delay)
      if (attempt < maxAttempts && isAbortError(err)) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

export { isAbortError };
