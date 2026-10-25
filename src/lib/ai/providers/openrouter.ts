import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import type { ChatTurn } from "../types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "anthropic/claude-3.5-haiku";
const SECONDARY_MODEL = "openai/gpt-4o-mini";

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

async function callOpenRouter(
  model: string,
  system: string,
  messages: ChatTurn[]
): Promise<AgentOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Yona Social Agent",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

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
    if (status === 429 || status === 500 || status === 502 || status === 503) {
      const output = await callOpenRouter(SECONDARY_MODEL, system, messages);
      return { output, model: SECONDARY_MODEL };
    }
    // Also try secondary on parse / unexpected failures once
    try {
      const output = await callOpenRouter(SECONDARY_MODEL, system, messages);
      return { output, model: SECONDARY_MODEL };
    } catch {
      throw primaryErr;
    }
  }
}
