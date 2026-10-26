import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import { AI_CONFIG } from "@/lib/ai-config";
import { ChatReplyJsonExtractor } from "../chat-reply-extractor";
import type { ChatTurn } from "../types";
import { fetchSignal, withTimeout } from "../with-timeout";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Ranked OpenRouter models (hybrid) — text/chat exclusive path.
 * 1) gpt-4o-mini — speed + Hebrew reliability (user override)
 * 2) claude-haiku-5.5 — cursorrules alternate
 * 3) claude-3.5-sonnet — marketing depth
 * 4–5) open-source / free fallbacks inside OpenRouter only
 *
 * OpenRouter API allows at most 3 entries in `models` per request —
 * we send the top 3 via models[], then sequential-retry 4–5 if needed.
 */
export const OPENROUTER_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-haiku-5.5",
  "anthropic/claude-3.5-sonnet",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-exp:free",
] as const;

/** Max length OpenRouter accepts for the `models` array (primary + fallbacks). */
export const OPENROUTER_MODELS_BATCH_SIZE = 3;

export type OpenRouterModelId = (typeof OPENROUTER_MODELS)[number];

const PRIMARY_MODEL = OPENROUTER_MODELS[0];
const SECONDARY_MODEL = "anthropic/claude-haiku-5.5";

/** Per-request hard cap — fail over fast instead of hanging the route. */
const REQUEST_TIMEOUT_MS = 28_000;

/** Soft Hebrew error when OPENROUTER_API_KEY is unset. */
export const OPENROUTER_MISSING_KEY_HE =
  "חסר מפתח OpenRouter בשרת — הגדירו OPENROUTER_API_KEY ונסו שוב.";

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("OpenRouter: no JSON object in response");
      return JSON.parse(match[0]);
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error("OpenRouter: JSON parse failed");
    }
  }
}

function isHaiku55Family(model: string): boolean {
  return (
    model.includes("claude-haiku-5.5") ||
    model.includes("claude-haiku-latest")
  );
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "Yona Social Agent",
  };
}

function isUnknownModelError(status: number, body: string): boolean {
  return (
    status === 400 ||
    status === 404 ||
    /not found|unknown model|invalid model|no endpoints/i.test(body)
  );
}

type OpenRouterChatResult = {
  output: AgentOutput;
  model: string;
};

/**
 * Single request with OpenRouter `models` array for automatic in-request fallback.
 * Skips Haiku-only `reasoning` so fallback models stay compatible.
 */
async function callOpenRouterModelsArray(
  system: string,
  messages: ChatTurn[]
): Promise<OpenRouterChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  // API hard-cap: models[] ≤ 3. Top 3 go in one request; rest are client sequential.
  const batch = OPENROUTER_MODELS.slice(0, OPENROUTER_MODELS_BATCH_SIZE);
  const payload: Record<string, unknown> = {
    model: batch[0],
    models: batch.slice(1),
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const res = await withTimeout(
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify(payload),
      signal: fetchSignal(REQUEST_TIMEOUT_MS),
    }),
    REQUEST_TIMEOUT_MS + 2_000,
    "OpenRouter models[]"
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`OpenRouter ${res.status}: ${body}`) as Error & {
      status?: number;
      body?: string;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter: empty content");

  const usedModel = data.model?.trim() || batch[0];
  console.log("[openrouter] models[] OK", { usedModel, batch });
  return {
    output: AgentOutputSchema.parse(extractJson(content)),
    model: usedModel,
  };
}

/** Client-side sequential retry when models[] is rejected or fails entirely. */
async function callOpenRouterSingle(
  model: string,
  system: string,
  messages: ChatTurn[]
): Promise<OpenRouterChatResult> {
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

  if (isHaiku55Family(model)) {
    payload.reasoning = { effort: "low" };
  } else {
    payload.temperature = 0.7;
  }

  const res = await withTimeout(
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
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
      body?: string;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter: empty content");

  return {
    output: AgentOutputSchema.parse(extractJson(content)),
    model: data.model?.trim() || model,
  };
}

/**
 * Structured JSON via OpenRouter ranked fallbacks.
 * 1) models[] batch (top 3)
 * 2) client sequential for remaining ranked IDs (and full list if batch failed)
 */
export async function generateWithOpenRouter(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; model: string }> {
  try {
    return await callOpenRouterModelsArray(system, messages);
  } catch (arrErr) {
    const status = (arrErr as { status?: number }).status;
    const body = (arrErr as { body?: string }).body ?? "";
    console.warn(
      "[openrouter] models[] batch failed → sequential client fallback",
      status ?? (arrErr instanceof Error ? arrErr.message : arrErr),
      isUnknownModelError(status ?? 0, body) ? "(unknown model IDs)" : ""
    );
  }

  // Prefer tail models first if batch already exhausted top-3, else full list
  let lastErr: unknown;
  for (const model of OPENROUTER_MODELS) {
    try {
      const result = await callOpenRouterSingle(model, system, messages);
      console.log("[openrouter] sequential OK", { model: result.model });
      return result;
    } catch (err) {
      lastErr = err;
      const st = (err as { status?: number }).status ?? 0;
      const b = (err as { body?: string }).body ?? "";
      if (isUnknownModelError(st, b)) {
        console.warn(`[openrouter] skip unknown/unavailable model: ${model}`);
        continue;
      }
      console.warn(
        `[openrouter] ${model} failed → next`,
        st || (err instanceof Error ? err.message : err)
      );
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter: all ranked models failed");
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
      headers: openRouterHeaders(apiKey),
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
      body?: string;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (!res.body) throw new Error("OpenRouter: empty stream body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const extractor = new ChatReplyJsonExtractor();
  let rawJson = "";
  let lineBuf = "";

  const consumeDataPayload = (payloadStr: string) => {
    if (!payloadStr || payloadStr === "[DONE]") return;
    let parsed: {
      model?: string;
      choices?: Array<{ delta?: { content?: string } }>;
    };
    try {
      parsed = JSON.parse(payloadStr);
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
 * Phase A+B: stream structured JSON from OpenRouter ranked models.
 * Walks OPENROUTER_MODELS; skips unknown IDs. Caller handles external failover.
 */
export async function streamWithOpenRouter(
  system: string,
  messages: ChatTurn[],
  onToken?: OpenRouterTokenCallback
): Promise<{ output: AgentOutput; model: string }> {
  let lastErr: unknown;
  for (const model of OPENROUTER_MODELS) {
    try {
      const result = await streamOpenRouterModel(
        model,
        system,
        messages,
        onToken
      );
      console.log("[openrouter] stream OK", { model: result.model });
      return result;
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status ?? 0;
      const body = (err as { body?: string }).body ?? "";
      if (isUnknownModelError(status, body)) {
        console.warn(`[openrouter] stream skip unknown model: ${model}`);
        continue;
      }
      console.warn(
        `[openrouter] stream ${model} failed → next`,
        status || (err instanceof Error ? err.message : err)
      );
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter stream: all ranked models failed");
}

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterFreeChatResult = {
  content: string;
  model: string;
  latencyMs: number;
};

/**
 * Free-form chat completions (Maya studio, non-AgentOutput JSON).
 * Tries primary + fallbacks; never calls Together/Groq/Gemini.
 */
export async function chatWithOpenRouter(opts: {
  messages: OpenRouterChatMessage[];
  temperature?: number;
  maxTokens?: number;
  models?: string[];
  timeoutMs?: number;
  jsonMode?: boolean;
}): Promise<OpenRouterFreeChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(OPENROUTER_MISSING_KEY_HE);
  }

  const models =
    opts.models?.filter(Boolean) ||
    [
      AI_CONFIG.MAYA_CHAT_MODEL,
      ...AI_CONFIG.MAYA_CHAT_FALLBACKS,
      ...OPENROUTER_MODELS,
    ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

  const timeoutMs =
    opts.timeoutMs ?? AI_CONFIG.MAYA_CHAT_TIMEOUT_MS ?? 10_000;
  const started = Date.now();
  let lastErr: unknown;

  for (const model of models) {
    try {
      const payload: Record<string, unknown> = {
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1600,
      };
      if (opts.jsonMode !== false) {
        payload.response_format = { type: "json_object" };
      }

      const res = await withTimeout(
        fetch(OPENROUTER_URL, {
          method: "POST",
          headers: openRouterHeaders(apiKey),
          body: JSON.stringify(payload),
          signal: fetchSignal(timeoutMs),
        }),
        timeoutMs + 2_000,
        `OpenRouter chat ${model}`
      );

      if (!res.ok) {
        const body = await res.text();
        const err = new Error(
          `OpenRouter ${res.status}: ${body.slice(0, 240)}`
        ) as Error & { status?: number; body?: string };
        err.status = res.status;
        err.body = body;
        if (isUnknownModelError(res.status, body)) {
          console.warn(`[openrouter] chat skip unknown model: ${model}`);
          lastErr = err;
          continue;
        }
        lastErr = err;
        console.warn(
          `[openrouter] chat ${model} failed → next`,
          res.status
        );
        continue;
      }

      const data = (await res.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        lastErr = new Error(`OpenRouter empty content (model=${model})`);
        continue;
      }

      return {
        content,
        model: data.model?.trim() || model,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[openrouter] chat ${model} error → next`,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("OpenRouter chat: all models failed");
}

export {
  PRIMARY_MODEL as OPENROUTER_PRIMARY_MODEL,
  SECONDARY_MODEL,
  OPENROUTER_URL,
};
