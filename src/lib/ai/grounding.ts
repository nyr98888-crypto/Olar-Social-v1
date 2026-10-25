import type {
  AgentOutput,
  BrandDna,
  BrandGuidelines,
} from "../../../schemas/agent";
import { isBrandDnaComplete } from "../../../schemas/agent";
import { hasLockedSceneLeak, type ChatTurn } from "./types";
import { findForbiddenHits } from "./validator";

/**
 * Light post-validate helpers for the publication pipeline.
 * Goal: stop invented prices / phones / discounts / locked scenes / niche leaks from shipping.
 * Keep pragmatic — not a full NLP fact-checker.
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

  const prices =
    text.match(
      /(?:₪|\$|€)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:ש["״']?ח|שקלים?|nis|ils)/gi
    ) ?? [];
  claims.push(...prices);

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

  // Digit core (e.g. "50" from "50%" or "₪50") must appear in grounding
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
 * Enforce text-only / missing-info contracts and strip ungrounded campaign claims.
 * Mutates and returns the same output object.
 * Aligns with Niche Lock: incomplete Brand DNA → ask business type before visuals.
 */
export function enforcePublicationGrounding(
  output: AgentOutput,
  args: {
    userMessage: string;
    brand: BrandGuidelines | null;
    brandDna?: BrandDna | null;
    visionNotes: string | null;
    history: ChatTurn[];
  }
): AgentOutput {
  // Text-only / ask-first contracts
  if (output.intent === "chit_chat" || output.intent === "missing_info") {
    output.social_post = null;
    output.image_task.generate_image = false;
    return output;
  }

  // Niche Lock incomplete: visuals require business_type + allowed_visual_style
  if (output.image_task.generate_image && !isBrandDnaComplete(args.brandDna)) {
    output.image_task.generate_image = false;
    delete output.image_task.prompt;
    // Keep social_post if grounded; nudge for business type so Niche Lock can be set
    if (!output.chat_reply?.includes("סוג העסק")) {
      output.chat_reply = `${output.chat_reply?.trim() ?? ""}\n\nלפני ויז'ואל — מה סוג העסק? (למשל מוסך, קוסמטיקאית, רואה חשבון)`.trim();
    }
    if (!output.social_post) {
      output.intent = "missing_info";
    }
  }

  const grounding = buildGroundingCorpus(args);

  // Campaign/refinement: drop invented specifics instead of shipping them
  if (
    output.social_post &&
    socialPostHasUngroundedClaims(output.social_post, grounding)
  ) {
    output.intent = "missing_info";
    output.social_post = null;
    output.image_task.generate_image = false;
    if (!output.chat_reply?.trim()) {
      output.chat_reply =
        "רגע — חסר לי פרט קונקרטי (מחיר/מבצע/טלפון) מהצד שלך לפני שאפרסם. מה בדיוק לציין בפוסט?";
    }
    return output;
  }

  // Block locked stock scenes + Brand DNA forbidden_elements from ever reaching FAL
  if (output.image_task.generate_image && output.image_task.prompt) {
    const prompt = output.image_task.prompt;
    const nicheHits = findForbiddenHits(
      prompt,
      args.brandDna?.forbidden_elements
    );
    if (hasLockedSceneLeak(prompt) || nicheHits.length > 0) {
      // Leave generate_image true so router Prompt Guardrail can retry LLM;
      // only strip here when we are not going to retry (router owns retry).
      // Soft-flag: keep prompt for guardrail correction path.
      if (hasLockedSceneLeak(prompt) && nicheHits.length === 0) {
        // Legacy locked scenes without DNA list — block immediately
        output.image_task.generate_image = false;
        delete output.image_task.prompt;
      }
    }
  }

  return output;
}
