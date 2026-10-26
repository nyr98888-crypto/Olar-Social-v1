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
  hasLockedSceneLeak,
  promptsAreTooSimilar,
  randomFalSeed,
  type GeneratedImage,
} from "../types";
import { findForbiddenHits } from "../validator";
import { withTimeout } from "../with-timeout";

const FAL_MODEL = "fal-ai/flux/schnell";
/**
 * Hard cap under image-service outer ~45s so chat never hangs forever.
 */
const FAL_SUBSCRIBE_TIMEOUT_MS = 40_000;

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
  if (
    hasLockedSceneLeak(next, brandDna?.business_type) ||
    nicheHits.length > 0
  ) {
    console.warn(
      "[fal] Rejected locked/forbidden scene leak; regenerating from Niche Lock",
      nicheHits
    );
    next = buildFalVisualPrompt({
      niche: brandDna?.business_type,
      allowedVisualStyle: styleHint,
      userHint: userContext,
      hebrewPrompt: hasHebrewScript(prompt) ? prompt : null,
    });
  }

  if (previousPrompt && promptsAreTooSimilar(next, previousPrompt)) {
    console.warn("[fal] Prompt identical to previous; forcing variation");
    next = `${next}, ${pickVariationHint()}`;
  }

  const secondHits = findForbiddenHits(next, brandDna?.forbidden_elements);
  if (
    hasLockedSceneLeak(next, brandDna?.business_type) ||
    secondHits.length > 0
  ) {
    next = buildFalVisualPrompt({
      niche: brandDna?.business_type,
      allowedVisualStyle: styleHint,
      userHint: `${userContext ?? ""}, ${pickVariationHint()}`,
    });
  }

  // Final Hebrew strip + dark-scene guardrail — FAL must never receive Hebrew
  next = applyVisualPromptGuardrail(next, null);

  return next;
}

/**
 * Generate an image via FAL Flux. Always uses a fresh random seed.
 * Prompt is forced through buildFalVisualPrompt (English-only) before subscribe.
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
}): Promise<GeneratedImage> {
  ensureFalConfig();

  const niche = opts.niche || opts.brandDna?.business_type || null;

  // Prefer already-English Art Director output; otherwise blueprint merge.
  // Never pass Hebrew to FAL.
  const englishPrompt = hasHebrewScript(opts.prompt)
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

  const preHits = findForbiddenHits(
    englishPrompt,
    opts.brandDna?.forbidden_elements
  );
  if (preHits.length > 0 && !opts.brandDna?.allowed_visual_style) {
    throw new Error(
      `FAL blocked by Niche Lock (forbidden: ${preHits.join(", ")})`
    );
  }

  const prompt = sanitizeFalPrompt(
    englishPrompt,
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
  // Authoritative demo default: landscape_4_3 for posts/banners; square only for headshots
  const image_size =
    opts.purpose === "headshot" || opts.purpose === "profile"
      ? "square"
      : falImageSizeForAspect(opts.aspectRatio, opts.purpose ?? "post");

  console.log("[FAL] Starting image generation…", {
    model: FAL_MODEL,
    seed,
    image_size,
    aspectRatio: opts.aspectRatio ?? "landscape_4_3",
    hasFalKey: Boolean(process.env.FAL_KEY),
  });
  console.log("[FAL] Prompt sent:", prompt);

  const result = await withTimeout(
    fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        seed,
        image_size,
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

  console.log("[FAL] Image URL returned:", url);

  return { url, seed, prompt };
}

/** Exposed for test-engine seed uniqueness checks */
export { randomFalSeed, FAL_MODEL };
