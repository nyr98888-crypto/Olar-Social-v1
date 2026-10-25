import { fal } from "@fal-ai/client";
import type { BrandDna } from "../../../../schemas/agent";
import {
  hasLockedSceneLeak,
  promptsAreTooSimilar,
  randomFalSeed,
  type GeneratedImage,
} from "../types";
import { findForbiddenHits } from "../validator";
import { withTimeout } from "../with-timeout";

const FAL_MODEL = "fal-ai/flux/schnell";
/** Hard cap so FAL queue stalls never freeze chat until Vercel kills the route. */
const FAL_SUBSCRIBE_TIMEOUT_MS = 45_000;

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
 * Dedup + anti-lock: reject identical previous prompts, stale locked scenes,
 * and Brand DNA forbidden_elements. Prefer allowed_visual_style when regenerating.
 */
export function sanitizeFalPrompt(
  prompt: string,
  previousPrompt?: string | null,
  userContext?: string | null,
  brandDna?: BrandDna | null
): string {
  let next = prompt.trim();
  if (!next) throw new Error("FAL: empty image prompt");

  const styleHint =
    brandDna?.allowed_visual_style?.trim() ||
    userContext?.trim() ||
    "brand product lifestyle scene derived from current user request";

  const nicheHits = findForbiddenHits(next, brandDna?.forbidden_elements);
  if (hasLockedSceneLeak(next) || nicheHits.length > 0) {
    console.warn(
      "[fal] Rejected locked/forbidden scene leak; regenerating from Niche Lock",
      nicheHits
    );
    next = `Professional social media photograph. Visual style: ${styleHint}. High quality commercial lighting. ${pickVariationHint()}`;
  }

  if (previousPrompt && promptsAreTooSimilar(next, previousPrompt)) {
    console.warn("[fal] Prompt identical to previous; forcing variation");
    next = `${next}, ${pickVariationHint()}`;
  }

  // Second pass if variation somehow reintroduced a lock / forbidden word
  const secondHits = findForbiddenHits(next, brandDna?.forbidden_elements);
  if (hasLockedSceneLeak(next) || secondHits.length > 0) {
    next = `Clean commercial photography for social media. Style: ${styleHint}. Modern on-brand aesthetic, ${pickVariationHint()}`;
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
  brandDna?: BrandDna | null;
}): Promise<GeneratedImage> {
  ensureFalConfig();

  // Hard stop if forbidden_elements still present after sanitize path
  const preHits = findForbiddenHits(opts.prompt, opts.brandDna?.forbidden_elements);
  if (preHits.length > 0 && !opts.brandDna?.allowed_visual_style) {
    throw new Error(
      `FAL blocked by Niche Lock (forbidden: ${preHits.join(", ")})`
    );
  }

  const prompt = sanitizeFalPrompt(
    opts.prompt,
    opts.previousPrompt,
    opts.userContext,
    opts.brandDna
  );

  const postHits = findForbiddenHits(
    prompt,
    opts.brandDna?.forbidden_elements
  );
  if (postHits.length > 0) {
    throw new Error(
      `FAL blocked by Niche Lock after sanitize (forbidden: ${postHits.join(", ")})`
    );
  }

  const seed = randomFalSeed();
  const size = ASPECT_TO_SIZE[opts.aspectRatio ?? "1:1"] ?? ASPECT_TO_SIZE["1:1"];

  const result = await withTimeout(
    fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        seed,
        image_size: size,
        num_images: 1,
        enable_safety_checker: true,
      },
    }),
    FAL_SUBSCRIBE_TIMEOUT_MS,
    "FAL subscribe"
  );

  const data = result.data as {
    images?: Array<{ url: string }>;
  };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("FAL: no image URL returned");

  return { url, seed, prompt };
}

/** Exposed for test-engine seed uniqueness checks */
export { randomFalSeed, FAL_MODEL };
