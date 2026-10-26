/**
 * Soft fallback — empty posts on AI failure (no canned marketing copy).
 */
import type { AgentOutput, BrandGuidelines } from "../../../schemas/agent";
import {
  buildGoldenAgentOutput,
  detectGoldenNiche,
  preferDraftOrEmpty,
  type GoldenNiche,
} from "./golden-templates";
import type { PostInputContext } from "./pipeline-validator";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

export type FallbackBizContext = {
  businessName?: string;
  city?: string;
  niche?: string;
  rawInput?: string;
  whatsappDigits?: string;
  phone?: string;
};

export function detectFallbackNiche(raw: string): GoldenNiche {
  return detectGoldenNiche(raw);
}

export function parseBizFromRaw(raw: string): {
  businessName: string;
  city: string;
} {
  const cleaned = stripCategoryLeak(raw).trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { businessName: "", city: "" };
  }
  const parts = cleaned.split(" ");
  if (parts.length >= 2) {
    return {
      businessName: parts.slice(0, -1).join(" "),
      city: parts[parts.length - 1] ?? "",
    };
  }
  return { businessName: cleaned, city: "" };
}

function toPostContext(
  ctx: FallbackBizContext = {},
  brand?: BrandGuidelines | null
): PostInputContext {
  const raw =
    stripCategoryLeak(
      ctx.rawInput ||
        [ctx.businessName, ctx.city, ctx.niche, brand?.brand_name, brand?.notes]
          .filter(Boolean)
          .join(" ") ||
        ""
    ) || "";
  const parsed = parseBizFromRaw(raw);
  return {
    rawPrompt: raw,
    businessName:
      ctx.businessName?.trim() ||
      brand?.brand_name?.trim() ||
      parsed.businessName,
    city: ctx.city?.trim() || parsed.city,
    niche: ctx.niche,
    whatsapp: ctx.whatsappDigits,
    phone: ctx.phone,
  };
}

/** Soft success — empty social_post, never invents niche marketing. */
export function buildNicheFallbackOutput(
  ctx: FallbackBizContext = {},
  brand?: BrandGuidelines | null
): AgentOutput {
  return buildGoldenAgentOutput(toPostContext(ctx, brand));
}

/** Prefer AI draft; if invalid → soft empty (not golden marketing). */
export function sanitizeOrGolden(
  output: AgentOutput,
  ctx: FallbackBizContext = {},
  brand?: BrandGuidelines | null
): AgentOutput {
  return preferDraftOrEmpty(output, toPostContext(ctx, brand));
}

export const FALLBACK_SOFT_READY_HE =
  "הפוסט מוכן! ניתן לערוך וללטש אותו כרצונך.";

export const FALLBACK_SOFT_FAIL_HE =
  "חלה שגיאה בייצור, אנא נסה שנית";
