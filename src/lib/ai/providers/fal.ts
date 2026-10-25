import { fal } from "@fal-ai/client";
import {
  hasLockedSceneLeak,
  promptsAreTooSimilar,
  randomFalSeed,
  type GeneratedImage,
} from "../types";

const FAL_MODEL = "fal-ai/flux/schnell";

const ASPECT_TO_SIZE: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 768, height: 960 },
  "16:9": { width: 1280, height: 720 },
};

const VARIATION_HINTS = [
  "alternate camera angle",
  "softer natural daylight",
  "tighter crop on subject",
  "wider environmental context",
  "subtle golden-hour warmth",
  "clean minimal backdrop matching brand palette",
  "shallow depth of field, subject sharp",
];

function ensureFalConfig() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is missing");
  fal.config({ credentials: key });
}

function pickVariationHint(): string {
  return VARIATION_HINTS[Math.floor(Math.random() * VARIATION_HINTS.length)];
}

/**
 * Dedup + anti-lock: reject identical previous prompts and stale locked scenes
 * (garage / מוסך / workshop), then regenerate a clean variation from current input.
 */
export function sanitizeFalPrompt(
  prompt: string,
  previousPrompt?: string | null,
  userContext?: string | null
): string {
  let next = prompt.trim();
  if (!next) throw new Error("FAL: empty image prompt");

  const contextHint =
    userContext?.trim() ||
    "brand product lifestyle scene derived from current user request";

  if (hasLockedSceneLeak(next)) {
    console.warn("[fal] Rejected locked scene leak; regenerating prompt");
    next = `Professional social media product photograph based on: ${contextHint}. Clean contemporary setting, no garage, no workshop, no auto-repair shop. High quality commercial lighting. ${pickVariationHint()}`;
  }

  if (previousPrompt && promptsAreTooSimilar(next, previousPrompt)) {
    console.warn("[fal] Prompt identical to previous; forcing variation");
    next = `${next}, ${pickVariationHint()}`;
  }

  // Second pass if variation somehow reintroduced a lock word
  if (hasLockedSceneLeak(next)) {
    next = `Clean commercial product photography for social media, ${contextHint}, modern aesthetic, ${pickVariationHint()}`;
  }

  return next;
}

/**
 * Generate an image via FAL Flux. Always uses a fresh random seed.
 */
export async function generateImageWithFal(opts: {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "16:9";
  previousPrompt?: string | null;
  userContext?: string | null;
}): Promise<GeneratedImage> {
  ensureFalConfig();

  const prompt = sanitizeFalPrompt(
    opts.prompt,
    opts.previousPrompt,
    opts.userContext
  );

  const seed = randomFalSeed();
  const size = ASPECT_TO_SIZE[opts.aspectRatio ?? "1:1"] ?? ASPECT_TO_SIZE["1:1"];

  const result = await fal.subscribe(FAL_MODEL, {
    input: {
      prompt,
      seed,
      image_size: size,
      num_images: 1,
      enable_safety_checker: true,
    },
  });

  const data = result.data as {
    images?: Array<{ url: string }>;
  };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("FAL: no image URL returned");

  return { url, seed, prompt };
}

/** Exposed for test-engine seed uniqueness checks */
export { randomFalSeed, FAL_MODEL };
