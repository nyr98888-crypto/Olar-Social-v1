/**
 * Dual Image Engine — FAL.ai primary + OpenRouter exclusive backup.
 * Together AI is never called for images.
 *
 * Resilience:
 *  1) FAL fal-ai/flux/schnell — 3 attempts + exponential backoff
 *  2) On FAL error/timeout after retries → OpenRouter Flux (OPENROUTER_API_KEY)
 */
import { fal } from "@fal-ai/client";
import type { BrandDna } from "../../../schemas/agent";
import { AI_CONFIG } from "@/lib/ai-config";
import {
  buildFalVisualPrompt,
  hasHebrewScript,
  type FalVisualPurpose,
} from "./fal-visual-prompt";
import { translateToFalEnglishPrompt } from "./translate-visual-prompt";
import { FAL_SUBSCRIBE_TIMEOUT_MS, FAL_MODEL } from "./providers/fal";
import {
  generateImageWithOpenRouter,
  isOpenRouterImageConfigured,
} from "./providers/openrouter-image";
import { randomFalSeed, type GeneratedImage, type ImageProviderId } from "./types";
import { withTimeout } from "./with-timeout";

export const FAL_MAX_ATTEMPTS = AI_CONFIG.FAL_MAX_ATTEMPTS;
const FAL_RETRY_BASE_MS = 1_000;

/** Outer budget ≈ FAL × 3 retries + OpenRouter backup (+ slack). */
export const IMAGE_HARD_TIMEOUT_MS =
  FAL_SUBSCRIBE_TIMEOUT_MS * FAL_MAX_ATTEMPTS +
  AI_CONFIG.OPENROUTER_IMAGE_TIMEOUT_MS +
  8_000;

/** @deprecated Never returned as soft success — kept for legacy import sites. */
export const IMAGE_PLACEHOLDER_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="960" viewBox="0 0 768 960">
      <rect width="768" height="960" fill="#f1f5f9"/>
      <text x="384" y="480" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="28">no image</text>
    </svg>`
  );

export type ImageServiceError = Error & {
  code:
    | "FAL_MISSING_KEY"
    | "FAL_TIMEOUT"
    | "FAL_FAILED"
    | "FAL_EMPTY"
    | "IMAGE_ALL_FAILED"
    | "KEYS_MISSING";
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
  category?: string | null;
  purpose?: FalVisualPurpose | null;
  /** @deprecated Ignored — never soft-succeed with static/Unsplash. */
  fallbackPlaceholder?: boolean;
  englishReady?: boolean;
  seed?: number;
  /** Test hook: fail the first FAL attempt, then continue retries / backup. */
  forceFailPrimary?: boolean;
};

function ensureFalConfig() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY is missing");
  fal.config({ credentials: key });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Together image generation is fully disabled. */
export function isTogetherBackupConfigured(): boolean {
  return false;
}

/**
 * Single FAL Flux subscribe (no retries). Used by the retry wrapper.
 */
export async function generateWithFalOnce(
  prompt: string,
  seed: number
): Promise<string> {
  ensureFalConfig();
  const res = await fal.subscribe(AI_CONFIG.FAL_MODEL, {
    input: {
      prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      seed,
      enable_safety_checker: true,
    },
    logs: false,
  });
  const data = res.data as { images?: Array<{ url: string }> };
  if (!data?.images?.[0]?.url) {
    throw new Error("FAL returned no image URL");
  }
  return data.images[0].url;
}

/**
 * FAL Flux with built-in 3 attempts + exponential backoff (1s → 2s → 4s).
 */
export async function generateWithFal(
  prompt: string,
  seed: number,
  opts?: { maxAttempts?: number; forceFailFirst?: boolean }
): Promise<string> {
  const maxAttempts = opts?.maxAttempts ?? FAL_MAX_ATTEMPTS;
  let forceFailFirst = Boolean(opts?.forceFailFirst);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (forceFailFirst) {
        forceFailFirst = false;
        throw new Error("Simulated FAL primary failure (forceFailPrimary)");
      }
      const url = await generateWithFalOnce(prompt, seed);
      if (attempt > 1) {
        console.log(
          `[Image Gen] ✅ FAL recovered on attempt ${attempt}/${maxAttempts}`
        );
      }
      return url;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= maxAttempts) break;
      const delay = Math.min(
        FAL_RETRY_BASE_MS * Math.pow(2, attempt - 1),
        8_000
      );
      console.warn(
        `[Image Gen] ⚠️ FAL attempt ${attempt}/${maxAttempts} failed — retry in ${delay}ms`,
        msg
      );
      await sleep(delay);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "FAL failed after retries"));
}

/** OpenRouter Flux backup — same English prompt as FAL. */
export async function generateWithOpenRouterBackup(
  prompt: string,
  seed: number
): Promise<string> {
  return generateImageWithOpenRouter({ prompt, seed });
}

/**
 * @deprecated Together image generation is disabled — never call the API.
 */
export async function generateWithTogether(
  _prompt: string,
  _seed: number
): Promise<string> {
  throw new Error(
    "Together image generation disabled — use FAL primary + OpenRouter backup"
  );
}

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

export async function resolveFalEnglishPromptAsync(opts: {
  prompt?: string | null;
  userContext?: string | null;
  brandDna?: BrandDna | null;
  businessName?: string | null;
  niche?: string | null;
  purpose?: FalVisualPurpose | null;
  englishReady?: boolean;
}): Promise<string> {
  const raw = opts.prompt?.trim() || opts.userContext?.trim() || "";
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

function resolveSeed(seed?: number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.floor(Math.abs(seed)) % 2147483647;
  }
  return randomFalSeed();
}

/** Accept https URLs and OpenRouter data:image base64 (not placeholder SVG). */
function isValidImageResult(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/unsplash/i.test(url)) return false;
  if (url.startsWith("data:image/svg")) return false;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^data:image\/[a-zA-Z0-9+.-]+;base64,/i.test(url)) return true;
  return false;
}

/**
 * FAL primary (3× backoff) → OpenRouter exclusive backup.
 * Never Together. Never Unsplash / static success.
 */
export async function generateImage(
  opts: GenerateImageOpts
): Promise<GeneratedImage> {
  const englishPrompt = await resolveFalEnglishPromptAsync({
    ...opts,
    englishReady: opts.englishReady,
  });

  const hasFal = Boolean(process.env.FAL_KEY?.trim());
  const hasOpenRouter = isOpenRouterImageConfigured();

  if (!hasFal && !hasOpenRouter) {
    throw toImageError(
      "KEYS_MISSING",
      "FAL_KEY and OPENROUTER_API_KEY missing",
      "יצירת תמונה לא מוגדרת כרגע — נסי שוב מאוחר יותר."
    );
  }

  const seed = resolveSeed(opts.seed);
  const started = Date.now();
  const niche = opts.niche || opts.brandDna?.business_type || null;

  console.log("[Image Gen] dual-engine start", {
    primary: AI_CONFIG.FAL_MODEL,
    backup: hasOpenRouter
      ? AI_CONFIG.OPENROUTER_IMAGE_MODEL
      : "(OpenRouter key/model missing)",
    falTimeoutMs: FAL_SUBSCRIBE_TIMEOUT_MS,
    falMaxAttempts: FAL_MAX_ATTEMPTS,
    togetherImages: "disabled",
    textEngine: AI_CONFIG.TEXT_ENGINE,
    forceFailPrimary: Boolean(opts.forceFailPrimary),
    seed,
    niche,
    category: opts.category ?? null,
    sample: englishPrompt.slice(0, 120),
  });

  // ── 1) FAL.ai primary ──────────────────────────────────────────────────
  if (hasFal) {
    try {
      console.log("[Image Gen] ⚡ Trying FAL.ai (with retries)…");
      const url = await withTimeout(
        generateWithFal(englishPrompt, seed, {
          forceFailFirst: Boolean(opts.forceFailPrimary),
        }),
        FAL_SUBSCRIBE_TIMEOUT_MS * FAL_MAX_ATTEMPTS + 8_000,
        "FAL image-engine"
      );
      if (isValidImageResult(url)) {
        console.log("[Image Gen] ✅ Success via FAL.ai", {
          latencyMs: Date.now() - started,
        });
        return {
          url,
          seed,
          prompt: englishPrompt,
          provider: "fal" as ImageProviderId,
        };
      }
      console.warn("[Image Gen] ⚠️ FAL empty/invalid URL — OpenRouter failover");
    } catch (falErr) {
      console.warn(
        "[Image Gen] ⚠️ FAL failed after retries → OpenRouter failover",
        falErr instanceof Error ? falErr.message : falErr
      );
    }
  }

  // ── 2) OpenRouter exclusive backup ─────────────────────────────────────
  if (hasOpenRouter) {
    try {
      console.log(
        `[Image Gen] 🔄 OpenRouter backup (${AI_CONFIG.OPENROUTER_IMAGE_MODEL})…`
      );
      const url = await withTimeout(
        generateWithOpenRouterBackup(englishPrompt, seed),
        AI_CONFIG.OPENROUTER_IMAGE_TIMEOUT_MS,
        "OpenRouter image-backup"
      );
      if (isValidImageResult(url)) {
        console.log("[Image Gen] ✅ Success via OpenRouter backup", {
          latencyMs: Date.now() - started,
          model: AI_CONFIG.OPENROUTER_IMAGE_MODEL,
        });
        return {
          url,
          seed,
          prompt: englishPrompt,
          provider: "openrouter" as ImageProviderId,
        };
      }
      console.warn("[Image Gen] ⚠️ OpenRouter empty/invalid image result");
    } catch (orErr) {
      console.error(
        "[Image Gen] ❌ OpenRouter backup failed",
        orErr instanceof Error ? orErr.message : orErr
      );
    }
  }

  console.error("[Image Gen] ❌ Dual engine exhausted", {
    latencyMs: Date.now() - started,
    falModel: FAL_MODEL,
    openRouterModel: AI_CONFIG.OPENROUTER_IMAGE_MODEL,
  });

  throw toImageError(
    "IMAGE_ALL_FAILED",
    hasOpenRouter
      ? "FAL (with retries) and OpenRouter backup both failed"
      : "FAL failed after retries; OPENROUTER_API_KEY missing for backup",
    "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב."
  );
}

export { FAL_MODEL, FAL_SUBSCRIBE_TIMEOUT_MS };
export { buildFalVisualPrompt };
export { translateToFalEnglishPrompt } from "./translate-visual-prompt";
export {
  applyVisualPromptGuardrail,
  CATEGORY_BLUEPRINTS,
} from "./fal-visual-prompt";
