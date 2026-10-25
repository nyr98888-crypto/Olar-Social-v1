import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import { ChatReplyJsonExtractor } from "../chat-reply-extractor";
import type { ChatTurn } from "../types";
import { fetchSignal, withTimeout } from "../with-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Current Haiku on OpenRouter (claude-3.5-haiku retired — 404). */
const PRIMARY_MODEL = "anthropic/claude-haiku-5.5";
const SECONDARY_MODEL = "openai/gpt-4o-mini";
/** Per-model hard cap — fail over fast instead of hanging the route. */
const REQUEST_TIMEOUT_MS = 22_000;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenRouter: no JSON object in response");
    return JSON.parse(match[0]);
  }
}

function isHaiku55Family(model: string): boolean {
  return (
    model.includes("claude-haiku-5.5") ||
    model.includes("claude-haiku-latest")
  );
}

async function callOpenRouter(
  model: string,
  system: string,
  messages: ChatTurn[]
): Promise<AgentOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const payload: Record<string, unknown> = {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  // Haiku 5.5: adaptive thinking on by default — keep effort low for chat latency.
  // Prefer not sending temperature (removed in 5.5 migration guidance).
  if (isHaiku55Family(model)) {
    payload.reasoning = { effort: "low" };
  } else {
    payload.temperature = 0.7;
  }

  const res = await withTimeout(
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Yona Social Agent",
      },
      body: JSON.stringify(payload),
      signal: fetchSignal(REQUEST_TIMEOUT_MS),
    }),
    REQUEST_TIMEOUT_MS + 2_000,
    `OpenRouter ${model}`
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`OpenRouter ${res.status}: ${body}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter: empty content");

  return AgentOutputSchema.parse(extractJson(content));
}

export async function generateWithOpenRouter(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; model: string }> {
  try {
    const output = await callOpenRouter(PRIMARY_MODEL, system, messages);
    return { output, model: PRIMARY_MODEL };
  } catch (primaryErr) {
    const status = (primaryErr as { status?: number }).status;
    console.warn(
      "[openrouter] primary failed → secondary",
      status ??
        (primaryErr instanceof Error ? primaryErr.message : primaryErr)
    );
    try {
      const output = await callOpenRouter(SECONDARY_MODEL, system, messages);
      return { output, model: SECONDARY_MODEL };
    } catch (secondaryErr) {
      console.warn(
        "[openrouter] secondary failed",
        secondaryErr instanceof Error ? secondaryErr.message : secondaryErr
      );
      // Prefer the more recent / informative error for upstream failover
      throw secondaryErr;
    }
  }
}

export type OpenRouterTokenCallback = (delta: string) => void;

/** Stream open + first bytes; body read still bounded by route maxDuration. */
const STREAM_TIMEOUT_MS = 35_000;

async function streamOpenRouterModel(
  model: string,
  system: string,
  messages: ChatTurn[],
  onToken?: OpenRouterTokenCallback
): Promise<{ output: AgentOutput; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const payload: Record<string, unknown> = {
    model,
    stream: true,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  if (isHaiku55Family(model)) {
    payload.reasoning = { effort: "low" };
  } else {
    payload.temperature = 0.7;
  }

  const res = await withTimeout(
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Yona Social Agent",
      },
      body: JSON.stringify(payload),
      signal: fetchSignal(STREAM_TIMEOUT_MS),
    }),
    STREAM_TIMEOUT_MS + 2_000,
    `OpenRouter stream ${model}`
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`OpenRouter ${res.status}: ${body}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  if (!res.body) throw new Error("OpenRouter: empty stream body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const extractor = new ChatReplyJsonExtractor();
  let rawJson = "";
  let lineBuf = "";

  const consumeDataPayload = (payload: string) => {
    if (!payload || payload === "[DONE]") return;
    let parsed: {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const delta = parsed.choices?.[0]?.delta?.content;
    if (!delta) return;
    rawJson += delta;
    const replyDelta = extractor.push(delta);
    if (replyDelta && onToken) onToken(replyDelta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuf += decoder.decode(value, { stream: true });
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      consumeDataPayload(trimmed.slice(5).trim());
    }
  }

  if (lineBuf.trim().startsWith("data:")) {
    consumeDataPayload(lineBuf.trim().slice(5).trim());
  }

  if (!rawJson.trim()) throw new Error("OpenRouter: empty streamed content");
  return {
    output: AgentOutputSchema.parse(extractJson(rawJson)),
    model,
  };
}

/**
 * Phase A+B: stream structured JSON from OpenRouter; emit chat_reply tokens live.
 * On primary failure → secondary. Caller handles Groq/Gemini failover if both fail.
 */
export async function streamWithOpenRouter(
  system: string,
  messages: ChatTurn[],
  onToken?: OpenRouterTokenCallback
): Promise<{ output: AgentOutput; model: string }> {
  try {
    return await streamOpenRouterModel(
      PRIMARY_MODEL,
      system,
      messages,
      onToken
    );
  } catch (primaryErr) {
    const status = (primaryErr as { status?: number }).status;
    console.warn(
      "[openrouter] stream primary failed → secondary",
      status ??
        (primaryErr instanceof Error ? primaryErr.message : primaryErr)
    );
    try {
      return await streamOpenRouterModel(
        SECONDARY_MODEL,
        system,
        messages,
        onToken
      );
    } catch (secondaryErr) {
      console.warn(
        "[openrouter] stream secondary failed",
        secondaryErr instanceof Error ? secondaryErr.message : secondaryErr
      );
      throw secondaryErr;
    }
  }
}

export { PRIMARY_MODEL as OPENROUTER_PRIMARY_MODEL, SECONDARY_MODEL };
