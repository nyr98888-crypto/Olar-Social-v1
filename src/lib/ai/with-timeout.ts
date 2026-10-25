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
