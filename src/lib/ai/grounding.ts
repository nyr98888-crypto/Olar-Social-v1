import type {
  AgentOutput,
  BrandDna,
  BrandGuidelines,
} from "../../../schemas/agent";
import { isBrandDnaComplete } from "../../../schemas/agent";
import { hasLockedSceneLeak, type ChatTurn } from "./types";
import { findForbiddenHits } from "./validator";
import {
  validateAndSanitizeAgentOutput,
  type PostInputContext,
} from "./pipeline-validator";
import { extractPriceMatches } from "./guardrails";

/**
 * Light post-validate helpers for the publication pipeline.
 * Price / phone stripping is owned by pipeline-validator + guardrails;
 * this module keeps intent contracts + niche lock + claim awareness.
 */

export function buildGroundingCorpus(args: {
  userMessage: string;
  brand: BrandGuidelines | null;
  brandDna?: BrandDna | null;
  visionNotes: string | null;
  history: ChatTurn[];
}): string {
  const parts = [
    args.userMessage,
    args.brand ? JSON.stringify(args.brand) : "",
    args.brandDna ? JSON.stringify(args.brandDna) : "",
    args.visionNotes ?? "",
    ...args.history.map((t) => t.content),
  ];
  return parts.join("\n").toLowerCase();
}

/** Extract concrete claim tokens (prices, discounts, phones) from post text. */
export function extractSpecificClaims(text: string): string[] {
  const claims: string[] = [];

  claims.push(...extractPriceMatches(text));

  const discounts = text.match(/\d+\s*%|\d+\s*אחוז/gi) ?? [];
  claims.push(...discounts);

  const phones =
    text.match(/(?:\+972|0)[\d\-.\s]{7,14}\d/g) ?? [];
  claims.push(...phones);

  return claims.map((c) => c.trim().toLowerCase()).filter(Boolean);
}

function claimIsGrounded(claim: string, grounding: string): boolean {
  const compactClaim = claim.replace(/\s+/g, "");
  const compactGround = grounding.replace(/\s+/g, "");
  if (compactGround.includes(compactClaim)) return true;

  const digits = claim.replace(/[^\d]/g, "");
  if (digits.length >= 2 && grounding.includes(digits)) return true;

  return false;
}

export function socialPostHasUngroundedClaims(
  post: NonNullable<AgentOutput["social_post"]>,
  grounding: string
): boolean {
  const postText = `${post.headline}\n${post.body}\n${post.hashtags.join(" ")}`;
  const claims = extractSpecificClaims(postText);
  if (claims.length === 0) return false;
  return claims.some((c) => !claimIsGrounded(c, grounding));
}

/**
 * Enforce text-only / missing-info contracts and sanitize ungrounded prices
 * via pipeline-validator (strip/replace — do not null the whole post).
 */
export function enforcePublicationGrounding(
  output: AgentOutput,
  args: {
    userMessage: string;
    brand: BrandGuidelines | null;
    brandDna?: BrandDna | null;
    visionNotes: string | null;
    history: ChatTurn[];
    phone?: string;
    whatsapp?: string;
    businessName?: string;
  }
): AgentOutput {
  if (output.intent === "chit_chat" || output.intent === "missing_info") {
    output.social_post = null;
    output.image_task.generate_image = false;
    return output;
  }

  if (output.image_task.generate_image && !isBrandDnaComplete(args.brandDna)) {
    output.image_task.generate_image = false;
    delete output.image_task.prompt;
    if (!output.chat_reply?.includes("סוג העסק")) {
      output.chat_reply = `${output.chat_reply?.trim() ?? ""}\n\nלפני ויז'ואל — מה סוג העסק? (למשל מוסך, קוסמטיקאית, רואה חשבון)`.trim();
    }
    if (!output.social_post) {
      output.intent = "missing_info";
    }
  }

  // Sanitize invented prices/phones in-place (supersedes nulling the post)
  if (output.social_post) {
    const ctx: PostInputContext = {
      rawPrompt: [
        args.userMessage,
        args.brand ? JSON.stringify(args.brand) : "",
        args.visionNotes ?? "",
        ...args.history.map((t) => t.content),
      ].join("\n"),
      businessName: args.businessName ?? args.brand?.brand_name,
      phone: args.phone,
      whatsapp: args.whatsapp,
      niche: args.brandDna?.business_type,
    };
    const result = validateAndSanitizeAgentOutput(output, ctx);
    if (!result.ok) {
      // Leave social_post for text-service / golden layer; log only
      console.error("[grounding] sanitize incomplete", result.reasons);
    }
  }

  if (output.image_task.generate_image && output.image_task.prompt) {
    const prompt = output.image_task.prompt;
    const nicheHits = findForbiddenHits(
      prompt,
      args.brandDna?.forbidden_elements
    );
    if (hasLockedSceneLeak(prompt) || nicheHits.length > 0) {
      if (hasLockedSceneLeak(prompt) && nicheHits.length === 0) {
        output.image_task.generate_image = false;
        delete output.image_task.prompt;
      }
    }
  }

  return output;
}
