/**
 * FLUX image-prompt bias by content pillar (postType) + category.
 * Keyword dish/trade locks in generate-ab-images win over this bias when present.
 */
import type { BusinessCategoryId } from "@/lib/olar/business-categories";
import {
  normalizePostType,
  type PostTypeId,
} from "@/lib/olar/post-types";
import { closeUpImagePrompt, wideShotImagePrompt } from "@/lib/olar/ab-variations";

const MILESTONE_AUTOMOTIVE =
  "A pristine, freshly detailed and painted luxury sports car standing proudly in a clean modern workshop with dramatic cinematic lighting, showroom shine, 8k commercial photography";

const MILESTONE_PROFESSIONAL =
  "A modern professional workspace with architectural plans and laptop, celebratory atmosphere, bright daylight, 8k";

const CLIENT_SATISFACTION_AUTO =
  "Warm professional moment, a happy customer receiving car keys from a smiling mechanic in a clean auto service center, natural realistic lighting, authentic Israeli atmosphere, photorealistic 8k";

const CLIENT_SATISFACTION_GENERAL =
  "Warm professional moment of a happy customer thanking a local Israeli small-business owner, natural realistic lighting, authentic atmosphere, photorealistic 8k";

const BEFORE_AFTER_FINISH =
  "Finished craft result close-up after transformation work, pristine detail, professional commercial lighting, shallow depth of field, photorealistic 8k";

function isAutomotiveCategory(
  category?: BusinessCategoryId | string | null
): boolean {
  const c = (category || "").toLowerCase();
  return (
    c === "automotive" ||
    c === "garage" ||
    c.includes("auto") ||
    c.includes("garage")
  );
}

function isProfessionalOrGeneral(
  category?: BusinessCategoryId | string | null
): boolean {
  const c = (category || "").toLowerCase();
  if (!c) return true;
  return (
    c === "architecture" ||
    c === "legal_accounting" ||
    c === "real_estate" ||
    c === "courses_workshops" ||
    c === "custom" ||
    c === "interior" ||
    c === "accountant" ||
    c === "general" ||
    c === "professional"
  );
}

export type PostTypeImageBiasResult = {
  /** Preferred English subject when no dish/trade keyword lock */
  biasPrompt: string | null;
  /** var_1 / close-up oriented prompt */
  promptA: string;
  /** var_2 / wide or alternate prompt */
  promptB: string;
  /** When true, skip close-up/wide wrappers (bias already complete) */
  replaceBase: boolean;
};

/**
 * Resolve dual image prompts for A/B generation based on postType + category.
 * Callers should still prefer dish/trade keyword locks over `biasPrompt`.
 */
export function resolvePostTypeImageBias(opts: {
  postType?: PostTypeId | string | null;
  category?: BusinessCategoryId | string | null;
  userText?: string | null;
  /** Existing LLM / draft prompts for each variation */
  basePromptA?: string | null;
  basePromptB?: string | null;
}): PostTypeImageBiasResult {
  const postType = normalizePostType(opts.postType);
  const baseA = (opts.basePromptA || opts.userText || "").trim();
  const baseB = (opts.basePromptB || baseA).trim();
  const auto = isAutomotiveCategory(opts.category);

  if (postType === "milestone") {
    const bias = auto
      ? MILESTONE_AUTOMOTIVE
      : isProfessionalOrGeneral(opts.category) || !opts.category
        ? MILESTONE_PROFESSIONAL
        : MILESTONE_PROFESSIONAL;
    return {
      biasPrompt: bias,
      promptA: bias,
      promptB: `${bias}. Slightly wider celebratory framing, same subject`,
      replaceBase: true,
    };
  }

  if (postType === "client_satisfaction") {
    const bias = auto
      ? CLIENT_SATISFACTION_AUTO
      : CLIENT_SATISFACTION_GENERAL;
    return {
      biasPrompt: bias,
      promptA: bias,
      promptB: `${bias}. Soft storytelling angle, warm ambient light`,
      replaceBase: true,
    };
  }

  if (postType === "before_after") {
    const finish =
      baseA.length > 40
        ? `${BEFORE_AFTER_FINISH}. Subject context: ${baseA.slice(0, 280)}`
        : BEFORE_AFTER_FINISH;
    return {
      biasPrompt: BEFORE_AFTER_FINISH,
      promptA: finish.slice(0, 900),
      promptB: closeUpImagePrompt(
        baseB || "Finished transformation craft result, detailed close-up"
      ),
      replaceBase: true,
    };
  }

  // promotion — classic close-up vs wide A/B
  return {
    biasPrompt: null,
    promptA: closeUpImagePrompt(baseA || "Local Israeli small business craft"),
    promptB: wideShotImagePrompt(baseB || baseA || "Local Israeli workspace"),
    replaceBase: false,
  };
}
