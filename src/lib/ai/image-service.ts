/**
 * Image generation circuit-breaker:
 *   1) FAL.ai fal-ai/flux/schnell — hard 7s
 *   2) Together AI FLUX.1-schnell — hard 8s
 *   3) Caller / route serves curated category Unsplash (static fallback)
 *
 * All prompts go through Art Director / English guardrail before providers.
 */
import type { BrandDna } from "../../../schemas/agent";
import {
  buildFalVisualPrompt,
  hasHebrewScript,
  resolvePromptDomain,
  type FalVisualPurpose,
} from "./fal-visual-prompt";
import { mergeDomainForbidden } from "./hebrew-disambiguation";
import { translateToFalEnglishPrompt } from "./translate-visual-prompt";
import {
  generateImageWithFal,
  FAL_MODEL,
  FAL_SUBSCRIBE_TIMEOUT_MS,
} from "./providers/fal";
import {
  generateImageWithTogether,
  TOGETHER_IMAGE_MODEL,
  TOGETHER_IMAGE_TIMEOUT_MS,
} from "./providers/together";
import type { GeneratedImage, ImageProviderId } from "./types";
import { withTimeout } from "./with-timeout";

/** Enrich Brand DNA with domain negatives before Flux providers. */
function brandDnaWithDomainNegatives(
  brandDna: BrandDna | null | undefined,
  ...sources: Array<string | null | undefined>
): BrandDna | null {
  if (!brandDna) return null;
  const domain = resolvePromptDomain(
    ...sources,
    brandDna.business_type,
    brandDna.allowed_visual_style
  );
  if (!domain) return brandDna;
  return {
    ...brandDna,
    forbidden_elements: mergeDomainForbidden(
      brandDna.forbidden_elements,
      domain
    ),
  };
}

/** Outer budget ≈ FAL 7s + Together 8s (+ small slack). */
const IMAGE_HARD_TIMEOUT_MS =
  FAL_SUBSCRIBE_TIMEOUT_MS + TOGETHER_IMAGE_TIMEOUT_MS + 2_000;

/** Subtle SVG placeholder when providers fail and caller opts in. */
export const IMAGE_PLACEHOLDER_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="960" viewBox="0 0 768 960">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="100%" stop-color="#f1f5f9"/>
        </linearGradient>
      </defs>
      <rect width="768" height="960" fill="url(#g)"/>
      <text x="384" y="480" text-anchor="middle" fill="#0284c7" font-family="system-ui,sans-serif" font-size="28">תמונה בהכנה</text>
    </svg>`
  );

export type ImageServiceError = Error & {
  code:
    | "FAL_MISSING_KEY"
    | "FAL_TIMEOUT"
    | "FAL_FAILED"
    | "FAL_EMPTY"
    | "IMAGE_ALL_FAILED";
  userMessageHe: string;
};

function toImageError(
  code: ImageServiceError["code"],
  message: string,
  userMessageHe: string
): ImageServiceError {
  const err = new Error(message) as ImageServiceError;
  err.code = code;
  err.userMessageHe = userMessageHe;
  return err;
}

export type GenerateImageOpts = {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "16:9";
  previousPrompt?: string | null;
  userContext?: string | null;
  brandDna?: BrandDna | null;
  businessName?: string | null;
  niche?: string | null;
  /** Canonical business category — logging / callers; niche override at API layer. */
  category?: string | null;
  purpose?: FalVisualPurpose | null;
  /** When true, return placeholder URL instead of throwing when all providers fail. */
  fallbackPlaceholder?: boolean;
  /** Prompt already ran Art Director + guardrail — skip second LLM. */
  englishReady?: boolean;
  /** Optional seed override (regen "שנה תמונה"). */
  seed?: number;
};

/**
 * Resolve the English Flux prompt that will be sent (also used by callers for logging).
 * Sync path — keyword/template only. Prefer resolveFalEnglishPromptAsync for Hebrew.
 */
export function resolveFalEnglishPrompt(opts: {
  prompt?: string | null;
  userContext?: string | null;
  brandDna?: BrandDna | null;
  businessName?: string | null;
  niche?: string | null;
  purpose?: FalVisualPurpose | null;
}): string {
  const raw = opts.prompt?.trim() || opts.userContext?.trim() || "";
  return buildFalVisualPrompt({
    niche: opts.niche || opts.brandDna?.business_type,
    businessName: opts.businessName,
    userHint: opts.userContext,
    hebrewPrompt: hasHebrewScript(raw) ? raw : null,
    englishPrompt: raw || null,
    allowedVisualStyle: opts.brandDna?.allowed_visual_style,
    purpose: opts.purpose,
  });
}

/** Async: Art Director LLM when needed; passthrough when englishReady. */
export async function resolveFalEnglishPromptAsync(opts: {
  prompt?: string | null;
  userContext?: string | null;
  brandDna?: BrandDna | null;
  businessName?: string | null;
  niche?: string | null;
  purpose?: FalVisualPurpose | null;
  englishReady?: boolean;
}): Promise<string> {
  const raw =
    opts.prompt?.trim() ||
    opts.userContext?.trim() ||
    "";
  const { prompt } = await translateToFalEnglishPrompt({
    description:
      raw || "professional local small business commercial photography",
    niche: opts.niche || opts.brandDna?.business_type,
    businessName: opts.businessName,
    purpose: opts.purpose,
    allowedVisualStyle: opts.brandDna?.allowed_visual_style,
    englishReady: opts.englishReady,
  });
  return prompt;
}

/**
 * Circuit-breaker image generation: FAL (7s) → Together (8s) → throw / placeholder.
 */
export async function generateImage(
  opts: GenerateImageOpts
): Promise<GeneratedImage> {
  const englishPrompt = await resolveFalEnglishPromptAsync({
    ...opts,
    englishReady: opts.englishReady,
  });

  const hasFal = Boolean(process.env.FAL_KEY?.trim());
  const hasTogether = Boolean(process.env.TOGETHER_API_KEY?.trim());

  if (!hasFal && !hasTogether) {
    const err = toImageError(
      "FAL_MISSING_KEY",
      "FAL_KEY and TOGETHER_API_KEY missing",
      "יצירת תמונה לא מוגדרת כרגע — נסי שוב מאוחר יותר."
    );
    if (opts.fallbackPlaceholder) {
      console.warn("[image-service] no image keys — placeholder");
      return {
        url: IMAGE_PLACEHOLDER_DATA_URI,
        seed: 0,
        prompt: englishPrompt,
        provider: "static-fallback",
      };
    }
    throw err;
  }

  const started = Date.now();
  const enrichedDna = brandDnaWithDomainNegatives(
    opts.brandDna,
    opts.prompt,
    opts.userContext,
    opts.niche
  );
  const niche =
    opts.niche ||
    enrichedDna?.business_type ||
    opts.brandDna?.business_type ||
    null;

  console.log("[Image Gen] circuit-breaker start", {
    hasFal,
    hasTogether,
    falTimeoutMs: FAL_SUBSCRIBE_TIMEOUT_MS,
    togetherTimeoutMs: TOGETHER_IMAGE_TIMEOUT_MS,
    aspectRatio: opts.aspectRatio ?? "1:1",
    purpose: opts.purpose ?? null,
    category: opts.category ?? null,
    niche,
  });

  // ── 1) Primary: FAL.ai (max 7s) ──────────────────────────────────────
  if (hasFal) {
    try {
      console.log("[Image Gen] ⚡ Attempting primary: FAL.ai…");
      const image = await withTimeout(
        generateImageWithFal({
          prompt: englishPrompt,
          aspectRatio: opts.aspectRatio,
          previousPrompt: opts.previousPrompt,
          userContext: opts.userContext,
          brandDna: enrichedDna,
          businessName: opts.businessName,
          niche,
          purpose: opts.purpose,
          seed: opts.seed,
        }),
        FAL_SUBSCRIBE_TIMEOUT_MS,
        "FAL image-service"
      );

      if (image?.url) {
        console.log("[Image Gen] ✅ Success via FAL.ai", {
          latencyMs: Date.now() - started,
        });
        return {
          ...image,
          provider: (image.provider || "fal") as ImageProviderId,
        };
      }
      console.warn("[Image Gen] ⚠️ FAL.ai empty URL — switching to Together");
    } catch (falErr) {
      console.warn(
        "[Image Gen] ⚠️ FAL.ai timeout/fail → Together",
        falErr instanceof Error ? falErr.message : falErr
      );
    }
  } else {
    console.warn("[Image Gen] ⚠️ FAL_KEY missing — skipping to Together");
  }

  // ── 2) Backup: Together AI FLUX (max 8s) ─────────────────────────────
  if (hasTogether) {
    try {
      console.log("[Image Gen] 🔄 Switching to backup: Together AI FLUX…");
      const image = await withTimeout(
        generateImageWithTogether({
          prompt: englishPrompt,
          aspectRatio: opts.aspectRatio,
          seed: opts.seed,
        }),
        TOGETHER_IMAGE_TIMEOUT_MS,
        "Together image-service"
      );

      if (image?.url) {
        console.log("[Image Gen] ✅ Success via Together AI", {
          latencyMs: Date.now() - started,
          model: TOGETHER_IMAGE_MODEL,
        });
        return image;
      }
      console.warn("[Image Gen] ⚠️ Together empty URL — static fallback");
    } catch (togetherErr) {
      console.error(
        "[Image Gen] ⚠️ Together failed/timed out",
        togetherErr instanceof Error ? togetherErr.message : togetherErr
      );
    }
  } else {
    console.warn("[Image Gen] ⚠️ TOGETHER_API_KEY missing — static fallback");
  }

  // ── 3) Soft placeholder (route prefers Unsplash category asset) ──────
  console.log("[Image Gen] 🛡️ All providers failed", {
    latencyMs: Date.now() - started,
    primary: FAL_MODEL,
  });

  if (opts.fallbackPlaceholder) {
    return {
      url: IMAGE_PLACEHOLDER_DATA_URI,
      seed: 0,
      prompt: englishPrompt,
      provider: "static-fallback",
    };
  }

  throw toImageError(
    "IMAGE_ALL_FAILED",
    "FAL and Together both failed",
    "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב."
  );
}

export {
  FAL_MODEL,
  IMAGE_HARD_TIMEOUT_MS,
  FAL_SUBSCRIBE_TIMEOUT_MS,
  TOGETHER_IMAGE_TIMEOUT_MS,
  buildFalVisualPrompt,
};
export { translateToFalEnglishPrompt } from "./translate-visual-prompt";
export {
  applyVisualPromptGuardrail,
  CATEGORY_BLUEPRINTS,
} from "./fal-visual-prompt";
