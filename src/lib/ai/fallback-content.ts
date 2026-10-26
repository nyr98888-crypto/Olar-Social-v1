/**
 * Soft niche fallback — delegates to golden templates (production guardrails).
 * Kept for backward-compatible imports from soft-response / onboarding.
 */
import type { AgentOutput, BrandGuidelines } from "../../../schemas/agent";
import {
  buildGoldenAgentOutput,
  detectGoldenNiche,
  type GoldenNiche,
} from "./golden-templates";
import {
  gateAgentOutputWithGolden,
  type PostInputContext,
} from "./pipeline-validator";

export type FallbackBizContext = {
  businessName?: string;
  city?: string;
  niche?: string;
  rawInput?: string;
  whatsappDigits?: string;
  phone?: string;
};

export function detectFallbackNiche(
  raw: string
): GoldenNiche {
  return detectGoldenNiche(raw);
}

export function parseBizFromRaw(raw: string): {
  businessName: string;
  city: string;
} {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { businessName: "העסק שלי", city: "" };
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
    ctx.rawInput ||
    [ctx.businessName, ctx.city, ctx.niche, brand?.brand_name, brand?.notes]
      .filter(Boolean)
      .join(" ") ||
    "";
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

/**
 * Soft success AgentOutput — golden template, never invents prices.
 * Optionally run through pipeline gate if a draft output is supplied.
 */
export function buildNicheFallbackOutput(
  ctx: FallbackBizContext = {},
  brand?: BrandGuidelines | null
): AgentOutput {
  return buildGoldenAgentOutput(toPostContext(ctx, brand));
}

/** Sanitize an AI draft; replace with golden if invalid. */
export function sanitizeOrGolden(
  output: AgentOutput,
  ctx: FallbackBizContext = {},
  brand?: BrandGuidelines | null
): AgentOutput {
  const postCtx = toPostContext(ctx, brand);
  return gateAgentOutputWithGolden(output, postCtx, buildGoldenAgentOutput)
    .output;
}

/** Soft toast copy (also mirrored in ui-copy). */
export const FALLBACK_SOFT_READY_HE =
  "הפוסט מוכן! ניתן לערוך וללטש אותו כרצונך.";
