import { fal } from "@fal-ai/client";
import type { BrandDna } from "../../../../schemas/agent";
import {
  applyVisualPromptGuardrail,
  buildFalVisualPrompt,
  falImageSizeForAspect,
  hasHebrewScript,
  type FalVisualPurpose,
} from "../fal-visual-prompt";
import {
  promptsAreTooSimilar,
  randomFalSeed,
  type GeneratedImage,
} from "../types";
import { withTimeout } from "../with-timeout";
import { imageGenQueue } from "@/lib/api-queue";

/**
 * fal-ai/flux/schnell does NOT support `negative_prompt`.
 * Moderation is FAL's safety checker only — no local Niche Lock blocking.
 */
export const FAL_SUPPORTS_NEGATIVE_PROMPT = false;

const FAL_MODEL = "fal-ai/flux/schnell";

/** Hard outer budget — never block chat forever; FAL needs room to finish. */
export const FAL_SUBSCRIBE_TIMEOUT_MS = 45_000;

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
 * Light anti-lock only: avoid identical previous prompts.
 * No forbidden-word / Niche Lock blocking — FAL moderates itself.
 */
export function sanitizeFalPrompt(
  prompt: string,
  previousPrompt?: string | null
): string {
  let next = prompt.trim();
  if (!next) throw new Error("FAL: empty image prompt");

  if (previousPrompt && promptsAreTooSimilar(next, previousPrompt)) {
    console.warn("[fal] Prompt identical to previous; forcing variation");
    next = `${next}, ${pickVariationHint()}`;
  }

  // Strip Hebrew if any leaked — FAL Flux is English-only
  next = applyVisualPromptGuardrail(next, null);

  return next;
}

/**
 * Direct FAL Flux call — no circuit breaker, no local content blocks.
 */
export async function generateWithFal(
  prompt: string,
  seed: number
): Promise<string> {
  ensureFalConfig();

  const result = await fal.subscribe(FAL_MODEL, {
    input: {
      prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      seed,
      enable_safety_checker: true,
    },
    logs: false,
  });

  const data = result.data as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("FAL returned no image URL");
  return url;
}

/**
 * Generate an image via FAL Flux. Always uses a fresh random seed unless overridden.
 */
export async function generateImageWithFal(opts: {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "16:9";
  previousPrompt?: string | null;
  userContext?: string | null;
  brandDna?: BrandDna | null;
  businessName?: string | null;
  niche?: string | null;
  purpose?: FalVisualPurpose | null;
  seed?: number;
}): Promise<GeneratedImage> {
  ensureFalConfig();

  const niche = opts.niche || opts.brandDna?.business_type || null;

  // Prefer already-English Art Director output; otherwise blueprint merge.
  let englishPrompt = hasHebrewScript(opts.prompt)
    ? buildFalVisualPrompt({
        niche,
        businessName: opts.businessName,
        userHint: opts.userContext,
        hebrewPrompt: opts.prompt,
        englishPrompt: null,
        allowedVisualStyle: opts.brandDna?.allowed_visual_style,
        purpose: opts.purpose,
      })
    : applyVisualPromptGuardrail(opts.prompt || "", null);

  const prompt = sanitizeFalPrompt(englishPrompt, opts.previousPrompt);

  const seed =
    typeof opts.seed === "number" && Number.isFinite(opts.seed)
      ? Math.floor(Math.abs(opts.seed)) % 2147483647
      : randomFalSeed();

  const image_size = falImageSizeForAspect(
    opts.aspectRatio,
    opts.purpose ?? "post"
  );

  console.log("[FAL] Starting image generation…", {
    model: FAL_MODEL,
    seed,
    image_size,
    aspectRatio: opts.aspectRatio ?? "1:1",
    hasFalKey: Boolean(process.env.FAL_KEY),
  });
  console.log("[FAL] Prompt sent:", prompt);

  return imageGenQueue.run(async () => {
    const result = await withTimeout(
      fal.subscribe(FAL_MODEL, {
        input: {
          prompt,
          image_size,
          num_inference_steps: 4,
          seed,
          enable_safety_checker: true,
          num_images: 1,
        },
        logs: false,
      }),
      FAL_SUBSCRIBE_TIMEOUT_MS,
      "FAL subscribe"
    );

    const data = result.data as {
      images?: Array<{ url: string }>;
    };
    const url = data.images?.[0]?.url;
    if (!url) throw new Error("FAL: no image URL returned");

    console.log("[FAL] Image URL returned:", url);

    return { url, seed, prompt, provider: "fal" };
  });
}

/** Exposed for test-engine seed uniqueness checks */
export { randomFalSeed, FAL_MODEL };
