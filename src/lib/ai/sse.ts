/** Minimal SSE framing for Next.js ReadableStream responses. */

export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseResponse(
  stream: ReadableStream<Uint8Array>,
  init?: ResponseInit
): Response {
  return new Response(stream, {
    ...init,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(init?.headers ?? {}),
    },
  });
}
