import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import type { ChatTurn } from "../types";
import { fetchSignal, withTimeout } from "../with-timeout";

/** xAI OpenAI-compatible chat completions. */
const XAI_URL = "https://api.x.ai/v1/chat/completions";
/** Fast structured JSON backup — only after OpenRouter fails. */
const GROK_MODEL = "grok-3-mini";
const REQUEST_TIMEOUT_MS = 22_000;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Grok: no JSON object in response");
    return JSON.parse(match[0]);
  }
}

/** Prefer XAI_API_KEY; accept GROK_API_KEY alias. */
export function getGrokApiKey(): string | null {
  const key =
    process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  return key || null;
}

export function isGrokConfigured(): boolean {
  return Boolean(getGrokApiKey());
}

/**
 * Structured JSON via xAI Grok (optional text backup).
 * Used ONLY after OpenRouter fails — never preferred for normal chat.
 */
export async function generateWithGrok(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; model: string }> {
  const apiKey = getGrokApiKey();
  if (!apiKey) throw new Error("XAI_API_KEY / GROK_API_KEY is missing");

  const res = await withTimeout(
    fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
      signal: fetchSignal(REQUEST_TIMEOUT_MS),
    }),
    REQUEST_TIMEOUT_MS + 2_000,
    "Grok"
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Grok ${res.status}: ${body}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok: empty content");

  const output = AgentOutputSchema.parse(extractJson(content));
  return { output, model: GROK_MODEL };
}

export { GROK_MODEL, XAI_URL };
