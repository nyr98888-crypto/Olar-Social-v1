import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import type { ChatTurn } from "../types";
import { fetchSignal, withTimeout } from "../with-timeout";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/**
 * Groq retired llama-3.3-70b-versatile for free/developer tiers (2026-08-16).
 * Official replacement: openai/gpt-oss-120b (still on api.groq.com OpenAI path).
 */
const GROQ_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 25_000;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Groq: no JSON object in response");
    return JSON.parse(match[0]);
  }
}

/**
 * Structured JSON via Groq openai/gpt-oss-120b (failover #2).
 * Uses OpenAI-compatible chat completions + response_format json_object.
 */
export async function generateWithGroq(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; model: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  const res = await withTimeout(
    fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
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
    "Groq"
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Groq ${res.status}: ${body}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq: empty content");

  const output = AgentOutputSchema.parse(extractJson(content));
  return { output, model: GROQ_MODEL };
}

export { GROQ_MODEL };
