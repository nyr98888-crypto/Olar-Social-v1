/**
 * Race a promise against a hard deadline. Prevents provider hangs from
 * freezing the chat route until Vercel maxDuration kills the function.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`) as Error & {
        status?: number;
        code?: string;
      };
      err.status = 504;
      err.code = "ETIMEDOUT";
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** Fetch options with AbortSignal.timeout when available. */
export function fetchSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

/**
 * fetch with AbortController hard cut — used by image circuit-breaker
 * (FAL 7s → Together 8s).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  label = "fetch"
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parent = options.signal;
    if (parent) {
      if (parent.aborted) controller.abort();
      else {
        parent.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const timed = new Error(
        `${label} timed out after ${timeoutMs}ms`
      ) as Error & { status?: number; code?: string };
      timed.status = 504;
      timed.code = "ETIMEDOUT";
      throw timed;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
