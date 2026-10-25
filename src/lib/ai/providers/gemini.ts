import { GoogleGenerativeAI } from "@google/generative-ai";
import { AgentOutputSchema, type AgentOutput } from "../../../../schemas/agent";
import type { ChatTurn, ReferenceImage } from "../types";

/** Preferred Flash ID; alternates used only after 503/429 / hard failure. */
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
] as const;

/** Prefer GEMINI_API_KEY; fall back to GOOGLE_AI_API_KEY for existing envs. */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is missing");
  }
  return key;
}

function getClient() {
  return new GoogleGenerativeAI(getGeminiApiKey());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  return (
    status === 429 ||
    status === 503 ||
    /\b(429|503)\b/.test(msg) ||
    /high demand|Service Unavailable|RESOURCE_EXHAUSTED|overloaded/i.test(msg)
  );
}

/**
 * Run `fn(modelId)` with: one backoff retry on 503/429, then alternate model IDs.
 * Used for vision + text-backup only — never preferred for normal chat.
 */
async function withGeminiResilience<T>(
  fn: (modelId: string) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (const modelId of GEMINI_MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(modelId);
      } catch (err) {
        lastError = err;
        const retryable = isRetryableGeminiError(err);
        console.warn(
          `[gemini] ${modelId} attempt ${attempt + 1} failed`,
          err instanceof Error ? err.message : err
        );
        if (retryable && attempt === 0) {
          await sleep(600 + Math.floor(Math.random() * 400));
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini unavailable");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini: no JSON object in response");
    return JSON.parse(match[0]);
  }
}

export async function analyzeReferenceImages(
  images: ReferenceImage[]
): Promise<string> {
  if (!images.length) return "";

  return withGeminiResilience(async (modelId) => {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({ model: modelId });

    const parts: Array<
      string | { inlineData: { mimeType: string; data: string } }
    > = [
      `Analyze these product/brand reference images. Extract a concise English visual brief covering:
- main subject / product
- dominant colors and palette
- style, mood, lighting
- textures and materials
- any text/logos visible
Do NOT invent a garage, workshop, or unrelated scene. Stick to what is visible.`,
    ];

    for (const img of images.slice(0, 2)) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.data },
      });
    }

    const result = await model.generateContent(parts);
    return result.response.text().trim();
  });
}

export async function generateWithGemini(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; model: string }> {
  return withGeminiResilience(async (modelId) => {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const last = messages[messages.length - 1];
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: system }] },
        {
          role: "model",
          parts: [
            {
              text: '{"chat_reply":"מוכן.","intent":"chit_chat","social_post":null,"image_task":{"generate_image":false,"aspect_ratio":"1:1"}}',
            },
          ],
        },
        ...history,
      ],
    });

    const result = await chat.sendMessage(last?.content ?? "");
    const text = result.response.text();
    const output = AgentOutputSchema.parse(extractJson(text));
    return { output, model: modelId };
  });
}

export { GEMINI_MODEL, GEMINI_MODEL_FALLBACKS };
