import { fal } from "@fal-ai/client";
import type { BrandDna } from "../../../../schemas/agent";
import {
  applyVisualPromptGuardrail,
  buildFalVisualPrompt,
  falImageSizeForAspect,
  hasHebrewScript,
  resolvePromptDomain,
  type FalVisualPurpose,
} from "../fal-visual-prompt";
import {
  applyDomainPromptGuardrail,
  mergeDomainForbidden,
} from "../hebrew-disambiguation";
import {
  hasLockedSceneLeak,
  promptsAreTooSimilar,
  randomFalSeed,
  type GeneratedImage,
} from "../types";
import { findForbiddenHits } from "../validator";
import { withTimeout } from "../with-timeout";

/**
 * fal-ai/flux/schnell does NOT support `negative_prompt`.
 * Domain negatives are baked into the English prompt as "avoid: ..."
 * and kept in Brand DNA forbidden_elements.
 */
export const FAL_SUPPORTS_NEGATIVE_PROMPT = false;

const FAL_MODEL = "fal-ai/flux/schnell";
/**
 * Circuit-breaker: FAL gets max 7s then we cut over to Together AI.
 */
export const FAL_SUBSCRIBE_TIMEOUT_MS = 7_000;

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
  seed?: number;
}): Promise<GeneratedImage> {
  ensureFalConfig();

  const niche = opts.niche || opts.brandDna?.business_type || null;
  const domain = resolvePromptDomain(
    opts.userContext,
    niche,
    opts.brandDna?.business_type,
    opts.brandDna?.allowed_visual_style,
    opts.prompt
  );

  // Prefer already-English Art Director output; otherwise blueprint merge.
  // Never pass Hebrew to FAL. Never literal-translate without domain cross-check.
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
    : applyVisualPromptGuardrail(opts.prompt || "", null, domain);

  // Bake domain avoid: clause (FLUX has no negative_prompt param)
  if (domain) {
    englishPrompt = applyDomainPromptGuardrail(englishPrompt, domain);
  }

  const forbidden = mergeDomainForbidden(
    opts.brandDna?.forbidden_elements,
    domain
  );

  const preHits = findForbiddenHits(englishPrompt, forbidden);
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

  const postHits = findForbiddenHits(prompt, forbidden);
  if (postHits.length > 0) {
    throw new Error(
      `FAL blocked by Niche Lock after sanitize (forbidden: ${postHits.join(", ")})`
    );
  }

  const seed =
    typeof opts.seed === "number" && Number.isFinite(opts.seed)
      ? Math.floor(Math.abs(opts.seed)) % 10_000_000
      : randomFalSeed();
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
    domain: domain?.id ?? null,
    negativePromptSupported: FAL_SUPPORTS_NEGATIVE_PROMPT,
  });
  console.log("[FAL] Prompt sent:", prompt);

  // Input: prompt + image_size + seed only — no negative_prompt (unsupported by flux/schnell)
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

  return { url, seed, prompt, provider: "fal" };
}

/** Exposed for test-engine seed uniqueness checks */
export { randomFalSeed, FAL_MODEL };
