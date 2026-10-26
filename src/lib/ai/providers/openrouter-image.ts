/**
 * OpenRouter image generation — exclusive backup when FAL fails.
 * Uses OPENROUTER_API_KEY. Never calls Together.
 */
import { AI_CONFIG } from "@/lib/ai-config";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://oneloop.app",
    "X-Title": "One Loop",
  };
}

function modelsToTry(): string[] {
  const primary = AI_CONFIG.OPENROUTER_IMAGE_MODEL;
  const fallbacks = AI_CONFIG.OPENROUTER_IMAGE_FALLBACKS || [];
  return [primary, ...fallbacks].filter(
    (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
  );
}

function b64ToDataUrl(b64: string, mediaType?: string | null): string {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").trim();
  const mime = mediaType?.trim() || "image/png";
  return `data:${mime};base64,${clean}`;
}

function extractUrlFromImagesApi(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    data?: Array<{
      url?: string;
      b64_json?: string;
      media_type?: string;
    }>;
  };
  const item = d.data?.[0];
  if (!item) return null;
  if (typeof item.url === "string" && item.url.trim()) return item.url.trim();
  if (typeof item.b64_json === "string" && item.b64_json.trim()) {
    return b64ToDataUrl(item.b64_json, item.media_type);
  }
  return null;
}

function extractUrlFromChat(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choice = (data as {
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{
              type?: string;
              image_url?: { url?: string } | string;
              imageUrl?: { url?: string };
            }>;
        images?: Array<{ image_url?: { url?: string } }>;
      };
    }>;
  }).choices?.[0]?.message;

  if (!choice) return null;

  // Newer OpenRouter shape: message.images[]
  const fromImages = choice.images?.[0]?.image_url?.url;
  if (fromImages?.trim()) return fromImages.trim();

  const content = choice.content;
  if (typeof content === "string") {
    const m = content.match(/https?:\/\/\S+/);
    if (m) return m[0];
    const dataUri = content.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/);
    if (dataUri) return dataUri[0];
    return null;
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === "image_url" || part?.image_url || part?.imageUrl) {
        const raw = part.image_url ?? part.imageUrl;
        const url = typeof raw === "string" ? raw : raw?.url;
        if (url?.trim()) return url.trim();
      }
    }
  }
  return null;
}

async function tryImagesApi(
  apiKey: string,
  model: string,
  prompt: string,
  seed: number
): Promise<string | null> {
  const res = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      aspect_ratio: "1:1",
      seed,
    }),
    signal: AbortSignal.timeout(AI_CONFIG.OPENROUTER_IMAGE_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn("[OpenRouter image] /images failed", {
      status: res.status,
      model,
      body: text.slice(0, 200),
    });
    return null;
  }
  try {
    return extractUrlFromImagesApi(JSON.parse(text));
  } catch {
    return null;
  }
}

async function tryChatModalities(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string | null> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
    signal: AbortSignal.timeout(AI_CONFIG.OPENROUTER_IMAGE_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn("[OpenRouter image] chat/modalities failed", {
      status: res.status,
      model,
      body: text.slice(0, 200),
    });
    return null;
  }
  try {
    return extractUrlFromChat(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Generate an image via OpenRouter (backup path).
 * Returns https URL or data:image/*;base64,… 
 */
export async function generateImageWithOpenRouter(opts: {
  prompt: string;
  seed?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("OpenRouter image: empty prompt");

  const seed =
    typeof opts.seed === "number" && Number.isFinite(opts.seed)
      ? Math.floor(Math.abs(opts.seed)) % 2147483647
      : Math.floor(Math.random() * 2147483647);

  const models = modelsToTry();
  let lastErr: unknown;

  for (const model of models) {
    console.log("[OpenRouter image] trying", { model, seed });
    try {
      const fromImages = await tryImagesApi(apiKey, model, prompt, seed);
      if (fromImages) {
        console.log("[OpenRouter image] ✅ /images OK", { model });
        return fromImages;
      }
      const fromChat = await tryChatModalities(apiKey, model, prompt);
      if (fromChat) {
        console.log("[OpenRouter image] ✅ chat/modalities OK", { model });
        return fromChat;
      }
      lastErr = new Error(`OpenRouter returned no image for model=${model}`);
    } catch (err) {
      lastErr = err;
      console.warn(
        "[OpenRouter image] model failed → next",
        model,
        err instanceof Error ? err.message : err
      );
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "OpenRouter image generation failed"));
}

export function isOpenRouterImageConfigured(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() &&
      AI_CONFIG.OPENROUTER_IMAGE_MODEL.trim()
  );
}
