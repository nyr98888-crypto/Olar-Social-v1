/**
 * In-process concurrency semaphore + HTTP backoff for image providers.
 * Caps parallel Together/FAL gens so Free-tier 429s are less likely.
 */

/** Internal concurrency limiter (Semaphore). */
export class ConcurrencyQueue {
  private maxConcurrent: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/** Max 5 image generations in flight across Together + FAL. */
export const imageGenQueue = new ConcurrencyQueue(5);

/**
 * HTTP fetch with exponential backoff + jitter on 429/503 and network errors.
 * Pass AbortSignal via options.signal for hard timeouts (Together 5s etc.).
 */
export async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  const delay = 1000; // 1 second base

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429 || response.status === 503) {
        attempt++;
        if (attempt >= maxRetries) return response;

        const jitter = Math.floor(Math.random() * 500);
        const totalDelay = delay * Math.pow(2, attempt) + jitter;
        console.warn(
          `[RateLimit ${response.status}] Waiting ${totalDelay}ms before retry ${attempt}/${maxRetries}...`
        );
        await new Promise((res) => setTimeout(res, totalDelay));
        continue;
      }

      return response;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      // Abort/timeout: do not burn retries — rethrow immediately
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.name === "TimeoutError" ||
          /timed out|aborted/i.test(err.message))
      ) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, delay * attempt));
    }
  }

  throw new Error("Max retries exceeded");
}
