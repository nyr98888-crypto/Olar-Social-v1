/**
 * Together.ai FLUX.1-schnell — circuit-breaker backup when FAL fails/times out.
 */
import type { GeneratedImage } from "../types";
import { randomFalSeed } from "../types";
import { fetchWithTimeout } from "../with-timeout";

export const TOGETHER_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
export const TOGETHER_IMAGE_TIMEOUT_MS = 8_000;
const TOGETHER_IMAGES_URL = "https://api.together.xyz/v1/images/generations";

function togetherSize(aspectRatio?: "1:1" | "4:5" | "16:9"): {
  width: number;
  height: number;
} {
  if (aspectRatio === "16:9") return { width: 1344, height: 768 };
  if (aspectRatio === "4:5") return { width: 768, height: 1024 };
  return { width: 1024, height: 1024 };
}

export async function generateImageWithTogether(opts: {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "16:9";
  seed?: number;
}): Promise<GeneratedImage> {
  const key = process.env.TOGETHER_API_KEY?.trim();
  if (!key) throw new Error("TOGETHER_API_KEY is missing");

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("Together: empty image prompt");

  const seed =
    typeof opts.seed === "number" && Number.isFinite(opts.seed)
      ? Math.floor(Math.abs(opts.seed)) % 2147483647
      : randomFalSeed();
  const { width, height } = togetherSize(opts.aspectRatio);

  console.log("[Together] Starting image generation…", {
    model: TOGETHER_IMAGE_MODEL,
    width,
    height,
    timeoutMs: TOGETHER_IMAGE_TIMEOUT_MS,
  });

  const res = await fetchWithTimeout(
    TOGETHER_IMAGES_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TOGETHER_IMAGE_MODEL,
        prompt,
        width,
        height,
        steps: 4,
        n: 1,
        seed,
        response_format: "url",
      }),
    },
    TOGETHER_IMAGE_TIMEOUT_MS,
    "Together images"
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Together images failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("Together: no image URL returned");

  console.log("[Together] Image URL returned");
  return { url, seed, prompt, provider: "together" };
}
