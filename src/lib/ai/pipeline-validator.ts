/**
 * Production post pipeline validator — runs BEFORE content reaches the UI.
 * Layers: fake prices → phones/wa.me → schema integrity.
 */
import {
  GeneratedPostResponseSchema,
  type GeneratedPostResponse,
  type AgentOutput,
  applyGeneratedPostToAgent,
  agentOutputToGeneratedPost,
} from "../../../schemas/agent";
import {
  DUMMY_PHONE_PATTERN,
  DUMMY_WAME_PATTERN,
  NEUTRAL_PRICE_CTA,
  PRICE_STRIP_REPLACEMENT,
  sanitizeInventedServices,
  sanitizePricesInText,
  userInputHasExplicitPrice,
} from "./guardrails";

export type PostInputContext = {
  /** Original user / onboarding prompt — sole source of truth for prices. */
  rawPrompt: string;
  businessName?: string;
  phone?: string;
  /** Digits or full number; used to rebuild wa.me */
  whatsapp?: string;
  niche?: string;
  city?: string;
};

export type PipelineValidationResult = {
  ok: boolean;
  data: GeneratedPostResponse | null;
  reasons: string[];
};

const DEFAULT_IMAGE_PROMPT =
  "Authentic professional commercial photography for a local Israeli small business, clean contemporary lighting, real work context, no text overlay, no watermarks";

function digitsOnly(s: string | undefined | null): string {
  return (s ?? "").replace(/\D/g, "");
}

function normalizeWaDigits(phoneOrWa: string | undefined): string | null {
  let d = digitsOnly(phoneOrWa);
  if (!d) return null;
  // Strip leading zeros then add 972 if local Israeli mobile
  if (d.startsWith("972")) return d;
  if (d.startsWith("0") && d.length >= 9) return `972${d.slice(1)}`;
  if (d.length === 9 && d.startsWith("5")) return `972${d}`;
  if (d.length >= 10) return d;
  return null;
}

function realWaLink(ctx: PostInputContext): string | null {
  const wa = normalizeWaDigits(ctx.whatsapp) || normalizeWaDigits(ctx.phone);
  if (!wa) return null;
  return `https://wa.me/${wa}`;
}

function formatDisplayPhone(ctx: PostInputContext): string | null {
  const raw = (ctx.phone || ctx.whatsapp || "").trim();
  if (!raw) return null;
  const d = digitsOnly(raw);
  // Skip if still a dummy all-zeros core
  if (/^972?5?0+$/.test(d) || /0{6,}/.test(d)) return null;
  return raw;
}

/**
 * Replace dummy phones and broken wa.me placeholders with real business contact.
 */
export function sanitizePhonesAndLinks(
  text: string,
  ctx: PostInputContext
): { text: string; fixed: boolean } {
  if (!text) return { text: "", fixed: false };
  let next = text;
  let fixed = false;
  const waLink = realWaLink(ctx);
  const display = formatDisplayPhone(ctx);

  if (DUMMY_WAME_PATTERN.test(next)) {
    DUMMY_WAME_PATTERN.lastIndex = 0;
    next = next.replace(DUMMY_WAME_PATTERN, waLink || "וואטסאפ");
    fixed = true;
  }

  if (DUMMY_PHONE_PATTERN.test(next)) {
    DUMMY_PHONE_PATTERN.lastIndex = 0;
    next = next.replace(
      DUMMY_PHONE_PATTERN,
      display || waLink || "וואטסאפ"
    );
    fixed = true;
  }

  // Orphan demo wa.me/972500000000 style left as plain text
  if (/972500000000|050-?0000000/i.test(next)) {
    next = next
      .replace(/972500000000/gi, waLink?.replace("https://wa.me/", "") || "")
      .replace(/050-?0000000/gi, display || "וואטסאפ");
    fixed = true;
  }

  return { text: next.replace(/[ \t]{2,}/g, " ").trim(), fixed };
}

function coerceGenerated(
  raw: Partial<GeneratedPostResponse> | GeneratedPostResponse | null | undefined
): Partial<GeneratedPostResponse> {
  if (!raw || typeof raw !== "object") return {};
  return {
    postText: raw.postText,
    headline: raw.headline,
    suggestedImagePrompt: raw.suggestedImagePrompt,
    callToAction: raw.callToAction,
    hasExplicitPrice: raw.hasExplicitPrice,
  };
}

/**
 * Validate + sanitize a generated post against user input context.
 * Always attempts repair; ok=false when schema still incomplete after sanitize.
 */
export function validateAndSanitizePost(
  generatedData:
    | Partial<GeneratedPostResponse>
    | GeneratedPostResponse
    | null
    | undefined,
  inputContext: PostInputContext
): PipelineValidationResult {
  const reasons: string[] = [];
  const rawPrompt = inputContext.rawPrompt ?? "";
  const coerced = coerceGenerated(generatedData);

  let postText = (coerced.postText ?? "").trim();
  let headline = (coerced.headline ?? "").trim();
  let suggestedImagePrompt = (coerced.suggestedImagePrompt ?? "").trim();
  let callToAction = (coerced.callToAction ?? "").trim();

  // 1) Fake prices
  const bodyPrices = sanitizePricesInText(postText, rawPrompt);
  const headPrices = sanitizePricesInText(headline, rawPrompt);
  const ctaPrices = sanitizePricesInText(callToAction, rawPrompt);

  if (bodyPrices.stripped.length) {
    reasons.push(`stripped_prices_body:${bodyPrices.stripped.join(",")}`);
  }
  if (headPrices.stripped.length) {
    reasons.push(`stripped_prices_headline:${headPrices.stripped.join(",")}`);
  }
  if (ctaPrices.stripped.length) {
    reasons.push(`stripped_prices_cta:${ctaPrices.stripped.join(",")}`);
  }

  postText = bodyPrices.text;
  headline = headPrices.text;
  callToAction = ctaPrices.text;

  const servicesBody = sanitizeInventedServices(postText, rawPrompt);
  const servicesHead = sanitizeInventedServices(headline, rawPrompt);
  if (servicesBody.removed.length || servicesHead.removed.length) {
    reasons.push(
      `stripped_services:${[...servicesBody.removed, ...servicesHead.removed].join(",")}`
    );
  }
  postText = servicesBody.text;
  headline = servicesHead.text;

  const explicitInInput = userInputHasExplicitPrice(rawPrompt);
  const hasExplicitPrice = explicitInInput && (
    bodyPrices.hadExplicit ||
    headPrices.hadExplicit ||
    Boolean(coerced.hasExplicitPrice && explicitInInput)
  );

  if (!explicitInInput) {
    // Force neutral CTA whenever user gave no price (even after partial strip)
    if (
      !callToAction ||
      callToAction.includes(PRICE_STRIP_REPLACEMENT) ||
      /₪|\d|ש["״']?\s*ח|nis|ils/i.test(callToAction) ||
      ctaPrices.stripped.length > 0
    ) {
      callToAction = NEUTRAL_PRICE_CTA;
      reasons.push("neutral_cta_forced");
    }
  } else if (!callToAction) {
    callToAction = NEUTRAL_PRICE_CTA;
    reasons.push("cta_filled_default");
  }

  // 2) Phones & broken links
  const phoneBody = sanitizePhonesAndLinks(postText, inputContext);
  const phoneHead = sanitizePhonesAndLinks(headline, inputContext);
  const phoneCta = sanitizePhonesAndLinks(callToAction, inputContext);
  postText = phoneBody.text;
  headline = phoneHead.text;
  callToAction = phoneCta.text;
  if (phoneBody.fixed || phoneHead.fixed || phoneCta.fixed) {
    reasons.push("fixed_demo_phones_or_links");
  }

  // Ensure a WhatsApp CTA line exists in body when we have a real wa link
  const wa = realWaLink(inputContext);
  if (wa && postText && !/wa\.me|וואטסאפ|whatsapp/i.test(postText)) {
    postText = `${postText}\n\n${callToAction}: ${wa}`;
    reasons.push("appended_wa_cta");
  }

  if (!suggestedImagePrompt) {
    suggestedImagePrompt = DEFAULT_IMAGE_PROMPT;
    reasons.push("default_image_prompt");
  }

  // Block Hebrew leaking into image prompt — soft English fallback
  if (/[\u0590-\u05FF]/.test(suggestedImagePrompt)) {
    suggestedImagePrompt = DEFAULT_IMAGE_PROMPT;
    reasons.push("stripped_hebrew_from_image_prompt");
  }

  const candidate: GeneratedPostResponse = {
    postText,
    headline,
    suggestedImagePrompt,
    callToAction: callToAction || NEUTRAL_PRICE_CTA,
    hasExplicitPrice,
  };

  // 3) Schema integrity
  const parsed = GeneratedPostResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    reasons.push(
      `schema:${parsed.error.issues.map((i) => i.path.join(".")).join(",")}`
    );
    return { ok: false, data: null, reasons };
  }

  if (!parsed.data.headline.trim() || !parsed.data.postText.trim()) {
    reasons.push("empty_headline_or_body");
    return { ok: false, data: null, reasons };
  }

  return { ok: true, data: parsed.data, reasons };
}

/**
 * Run pipeline on an AgentOutput campaign; mutates social_post when ok.
 * Returns ok:false when post missing/invalid (caller should use golden template).
 */
export function validateAndSanitizeAgentOutput(
  output: AgentOutput,
  inputContext: PostInputContext
): PipelineValidationResult {
  if (!output.social_post) {
    return { ok: false, data: null, reasons: ["no_social_post"] };
  }

  const generated =
    agentOutputToGeneratedPost(output) ??
    ({
      postText: output.social_post.body,
      headline: output.social_post.headline,
      suggestedImagePrompt:
        output.image_task.prompt?.trim() || DEFAULT_IMAGE_PROMPT,
      callToAction:
        output.social_post.call_to_action?.trim() || NEUTRAL_PRICE_CTA,
      hasExplicitPrice: output.social_post.has_explicit_price ?? false,
    } satisfies GeneratedPostResponse);

  const result = validateAndSanitizePost(generated, inputContext);
  if (result.ok && result.data) {
    applyGeneratedPostToAgent(output, result.data);
  }
  return result;
}

/**
 * Gate campaign output: sanitize in-place, or swap to golden template.
 * chit_chat / missing_info with null social_post pass through.
 * Import golden lazily-style via parameter to keep this module free of niche copy
 * when only validating — callers pass buildGoldenAgentOutput.
 */
export function gateAgentOutputWithGolden(
  output: AgentOutput,
  inputContext: PostInputContext,
  buildGolden: (ctx: PostInputContext) => AgentOutput
): { output: AgentOutput; fallback: boolean; reasons: string[] } {
  if (
    output.intent === "chit_chat" ||
    output.intent === "missing_info" ||
    !output.social_post
  ) {
    return { output, fallback: false, reasons: [] };
  }

  const validated = validateAndSanitizeAgentOutput(output, inputContext);
  if (validated.ok && validated.data) {
    applyGeneratedPostToAgent(output, validated.data);
    return { output, fallback: false, reasons: validated.reasons };
  }

  console.error("[pipeline] validation failed → golden", {
    reasons: validated.reasons,
  });
  return {
    output: buildGolden(inputContext),
    fallback: true,
    reasons: validated.reasons,
  };
}
