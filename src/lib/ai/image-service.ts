/**
 * Image generation — FAL.ai fal-ai/flux/schnell only.
 * Random seed via provider; hard outer timeout ~45s so chat never hangs forever.
 * All prompts go through buildFalVisualPrompt (English-only) before FAL.
 */
import type { BrandDna } from "../../../schemas/agent";
import {
  buildFalVisualPrompt,
  hasHebrewScript,
  type FalVisualPurpose,
} from "./fal-visual-prompt";
import { translateToFalEnglishPrompt } from "./translate-visual-prompt";
import {
  generateImageWithFal,
  FAL_MODEL,
} from "./providers/fal";
import type { GeneratedImage } from "./types";
import { withTimeout } from "./with-timeout";

/** Hard cap matching .cursorrules (~45s) — never block chat forever. */
const IMAGE_HARD_TIMEOUT_MS = 45_000;

/** Subtle SVG placeholder when FAL fails and caller opts in. */
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
  code: "FAL_MISSING_KEY" | "FAL_TIMEOUT" | "FAL_FAILED" | "FAL_EMPTY";
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
  purpose?: FalVisualPurpose | null;
  /** When true, return placeholder URL instead of throwing on FAL failure. */
  fallbackPlaceholder?: boolean;
  /** Prompt already ran Art Director + guardrail — skip second LLM. */
  englishReady?: boolean;
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
 * Generate a real FAL Flux image URL (or optional elegant placeholder).
 * Expects English-safe prompt after Art Director (or runs Art Director here).
 */
export async function generateImage(
  opts: GenerateImageOpts
): Promise<GeneratedImage> {
  const englishPrompt = await resolveFalEnglishPromptAsync({
    ...opts,
    englishReady: opts.englishReady,
  });

  if (!process.env.FAL_KEY?.trim()) {
    const err = toImageError(
      "FAL_MISSING_KEY",
      "FAL_KEY is missing",
      "יצירת תמונה לא מוגדרת כרגע — נסי שוב מאוחר יותר."
    );
    if (opts.fallbackPlaceholder) {
      console.warn("[image-service] FAL_KEY missing — placeholder");
      return {
        url: IMAGE_PLACEHOLDER_DATA_URI,
        seed: 0,
        prompt: englishPrompt,
      };
    }
    throw err;
  }

  const started = Date.now();
  console.log("[image-service] FAL start", {
    model: FAL_MODEL,
    aspectRatio: opts.aspectRatio ?? "1:1",
    purpose: opts.purpose ?? null,
    hadHebrew: hasHebrewScript(opts.prompt),
  });

  try {
    const image = await withTimeout(
      generateImageWithFal({
        prompt: englishPrompt,
        aspectRatio: opts.aspectRatio,
        previousPrompt: opts.previousPrompt,
        userContext: opts.userContext,
        brandDna: opts.brandDna,
        businessName: opts.businessName,
        niche: opts.niche || opts.brandDna?.business_type,
        purpose: opts.purpose,
      }),
      IMAGE_HARD_TIMEOUT_MS,
      "FAL image-service"
    );

    if (!image?.url) {
      throw toImageError(
        "FAL_EMPTY",
        "FAL returned no URL",
        "לא התקבלה תמונה מהשרת — אפשר לנסות שוב."
      );
    }

    console.log("[image-service] OK", {
      latencyMs: Date.now() - started,
      seed: image.seed,
    });
    return image;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /timed out|timeout/i.test(msg);
    const code: ImageServiceError["code"] = isTimeout
      ? "FAL_TIMEOUT"
      : "FAL_FAILED";
    const userMessageHe = isTimeout
      ? "יצירת התמונה ארכה יותר מדי — נסי שוב."
      : "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב.";

    console.error("[image-service] FAILED", {
      latencyMs: Date.now() - started,
      code,
      error: msg.slice(0, 200),
    });

    if (opts.fallbackPlaceholder) {
      return {
        url: IMAGE_PLACEHOLDER_DATA_URI,
        seed: 0,
        prompt: englishPrompt,
      };
    }

    if ((err as ImageServiceError).code) throw err;
    throw toImageError(code, msg, userMessageHe);
  }
}

export { FAL_MODEL, IMAGE_HARD_TIMEOUT_MS, buildFalVisualPrompt };
export { translateToFalEnglishPrompt } from "./translate-visual-prompt";
export {
  applyVisualPromptGuardrail,
  CATEGORY_BLUEPRINTS,
} from "./fal-visual-prompt";
