import { z } from "zod";
import { enrichBrandDnaFromDomain } from "../src/lib/ai/hebrew-disambiguation";

/**
 * Validated campaign post shape (pipeline + UI).
 * postText = social_post.body; suggestedImagePrompt = image_task.prompt (English).
 */
export const GeneratedPostResponseSchema = z.object({
  postText: z
    .string()
    .min(1)
    .describe("Hebrew post body — grounded facts only; no invented prices"),
  headline: z.string().min(1).describe("Hebrew headline — grounded only"),
  suggestedImagePrompt: z
    .string()
    .min(1)
    .describe("English Flux prompt; no text-in-image; never Hebrew"),
  callToAction: z
    .string()
    .min(1)
    .describe(
      "Hebrew CTA — neutral WhatsApp line unless user gave an explicit price"
    ),
  hasExplicitPrice: z
    .boolean()
    .describe(
      "true ONLY when the user explicitly provided a numeric price in their input"
    ),
});

export type GeneratedPostResponse = z.infer<typeof GeneratedPostResponseSchema>;

/** Single-platform adapted post (text + optional hashtags + CTA). */
export const PlatformPostSchema = z.object({
  text: z.string().describe("Platform-adapted post text in Hebrew"),
  hashtags: z
    .array(z.string())
    .optional()
    .describe("Hashtags (mainly relevant for Instagram)"),
  cta: z
    .string()
    .optional()
    .describe("Platform-specific CTA in Hebrew"),
});

export type PlatformPost = z.infer<typeof PlatformPostSchema>;

/** Multi-platform adapted versions of a social post. */
export const PlatformPostsSchema = z.object({
  facebook: PlatformPostSchema.optional(),
  instagram: PlatformPostSchema.optional(),
  whatsapp: PlatformPostSchema.optional(),
  google_business: PlatformPostSchema.optional(),
});

export type PlatformPosts = z.infer<typeof PlatformPostsSchema>;

export const SocialPostSchema = z.object({
  headline: z
    .string()
    .describe(
      "כותרת בעברית — רק עובדות מ-user message / brand / vision / 6 תורות אחרונים"
    ),
  body: z
    .string()
    .describe(
      "גוף פוסט בעברית עם CTA — אסור להמציא מוצרים/מחירים/מבצעים/מיקומים שלא סופקו"
    ),
  hashtags: z
    .array(z.string())
    .describe("האשטגים רלוונטיים למותג/נושא שסופקו בלבד"),
  call_to_action: z
    .string()
    .optional()
    .describe("Hebrew CTA line (aligned with GeneratedPostResponse.callToAction)"),
  has_explicit_price: z
    .boolean()
    .optional()
    .describe("true only when user input contained that price"),
  platforms: PlatformPostsSchema.optional()
    .nullable()
    .describe(
      "Platform-adapted post versions — optional; frontend derives from classic fields when absent"
    ),
});

export type SocialPostFields = z.infer<typeof SocialPostSchema>;

export const AgentOutputSchema = z.object({
  chat_reply: z
    .string()
    .describe(
      "תשובת שיחה טבעית בעברית מיונה בגוף ראשון נקבה בלבד (אני מנהלת/הכנתי/יצרתי) — בלי פרומפטים ובלי המצאת עובדות"
    ),
  // Spec core: chit_chat | campaign_request | refinement (+ missing_info)
  intent: z.enum([
    "chit_chat",
    "campaign_request",
    "refinement",
    "missing_info",
  ]),
  social_post: SocialPostSchema.nullable().describe(
    "null ב-chit_chat או missing_info; מולא רק כשיש מספיק עובדות אמיתיות לקמפיין"
  ),
  image_task: z.object({
    generate_image: z
      .boolean()
      .describe(
        "MUST be true when the user approves/asks to create the post+image (e.g. קדימה/תרימי את הפוסט והתמונה) or clearly requests a campaign visual — then also provide English prompt; false only for chit_chat/missing_info"
      ),
    prompt: z
      .string()
      .optional()
      .describe(
        "Required English-only Flux prompt whenever generate_image=true; grounded in user+brand+Brand DNA+vision — never Hebrew, never garage/workshop stock scenes"
      ),
    aspect_ratio: z.enum(["1:1", "4:5", "16:9"]).default("1:1"),
  }),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/** Map AgentOutput campaign fields → GeneratedPostResponse (for pipeline). */
export function agentOutputToGeneratedPost(
  output: AgentOutput
): GeneratedPostResponse | null {
  const post = output.social_post;
  if (!post) return null;
  const prompt =
    output.image_task.prompt?.trim() ||
    "Authentic professional commercial photography for a local Israeli business, clean lighting, no text overlay";
  const parsed = GeneratedPostResponseSchema.safeParse({
    postText: post.body,
    headline: post.headline,
    suggestedImagePrompt: prompt,
    callToAction:
      post.call_to_action?.trim() ||
      "לתיאום והצעת מחיר בוואטסאפ",
    hasExplicitPrice: post.has_explicit_price ?? false,
  });
  return parsed.success ? parsed.data : null;
}

/** Apply validated GeneratedPostResponse back onto AgentOutput.social_post + image prompt. */
export function applyGeneratedPostToAgent(
  output: AgentOutput,
  post: GeneratedPostResponse,
  hashtags?: string[]
): AgentOutput {
  const tags =
    hashtags ??
    output.social_post?.hashtags ??
    ["#עסקמקומי"];
  output.social_post = {
    headline: post.headline,
    body: post.postText,
    hashtags: tags,
    call_to_action: post.callToAction,
    has_explicit_price: post.hasExplicitPrice,
  };
  if (output.image_task.generate_image) {
    output.image_task.prompt = post.suggestedImagePrompt;
  } else if (!output.image_task.prompt?.trim()) {
    output.image_task.prompt = post.suggestedImagePrompt;
  }
  return output;
}

export const BrandGuidelinesSchema = z.object({
  brand_name: z.string().optional(),
  tone: z.string().optional(),
  colors: z.array(z.string()).optional(),
  audience: z.string().optional(),
  dos: z.array(z.string()).optional(),
  donts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type BrandGuidelines = z.infer<typeof BrandGuidelinesSchema>;

/**
 * Niche Lock / Brand DNA — authoritative for visuals.
 * business_type e.g. garage | beautician | accountant
 * allowed_visual_style: mandatory English visual style string for Flux
 * forbidden_elements: banned words/scenes (case-insensitive match before FAL)
 */
export const BrandDnaSchema = z.object({
  business_type: z.string().min(1),
  allowed_visual_style: z.string().min(1),
  forbidden_elements: z.array(z.string()).default([]),
});

export type BrandDna = z.infer<typeof BrandDnaSchema>;

/** Partial/empty DNA from DB before the user has set niche lock. */
export const BrandDnaPartialSchema = z.object({
  business_type: z.string().optional(),
  allowed_visual_style: z.string().optional(),
  forbidden_elements: z.array(z.string()).optional(),
});

export type BrandDnaPartial = z.infer<typeof BrandDnaPartialSchema>;

export function parseBrandDna(raw: unknown): BrandDna | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = BrandDnaSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseBrandDnaPartial(raw: unknown): BrandDnaPartial | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = BrandDnaPartialSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;
  if (!d.business_type && !d.allowed_visual_style && !d.forbidden_elements?.length) {
    return null;
  }
  return d;
}

/** Conversation override wins field-wise; profile is base. Niche lock fields from DNA are authoritative for visuals. */
export function mergeBrandDna(
  profile: BrandDnaPartial | BrandDna | null | undefined,
  conversation: BrandDnaPartial | BrandDna | null | undefined
): BrandDna | null {
  const merged: BrandDnaPartial = {
    business_type: conversation?.business_type || profile?.business_type,
    allowed_visual_style:
      conversation?.allowed_visual_style || profile?.allowed_visual_style,
    forbidden_elements:
      conversation?.forbidden_elements?.length
        ? conversation.forbidden_elements
        : profile?.forbidden_elements,
  };
  return expandBrandDnaDefaults(merged);
}

export function isBrandDnaComplete(
  dna: BrandDnaPartial | BrandDna | null | undefined
): dna is BrandDna {
  return Boolean(
    dna?.business_type?.trim() && dna?.allowed_visual_style?.trim()
  );
}

/** Derive platform-adapted posts from classic social_post fields (backward compat). */
export function derivePlatformsFromPost(post: SocialPostFields): PlatformPosts {
  const fullText = `${post.headline}\n\n${post.body}`;
  const cta = post.call_to_action || "";
  return {
    facebook: { text: fullText, cta },
    instagram: { text: fullText, hashtags: post.hashtags, cta },
    whatsapp: { text: `${post.headline}\n${post.body}`, cta },
    google_business: { text: fullText, cta },
  };
}

/**
 * When only business_type is known, derive allowed_visual_style dynamically.
 * Hebrew ambiguous niches go through Negative Token Mapping so e.g.
 * עיצוב פנים → Interior Architecture (never facial/cosmetics).
 * Domain negatives always land in forbidden_elements (FLUX has no negative_prompt).
 */
export function expandBrandDnaDefaults(
  partial: BrandDnaPartial | null | undefined
): BrandDna | null {
  if (!partial?.business_type?.trim()) return parseBrandDna(partial);

  const businessType = partial.business_type.trim();

  const crossNicheBans = [
    "unrelated industry stock photo",
    "random celebrity",
    "political rally",
    "generic motivational quote poster",
  ];

  const enriched = enrichBrandDnaFromDomain({
    business_type: businessType,
    allowed_visual_style: partial.allowed_visual_style,
    forbidden_elements: partial.forbidden_elements,
  });

  const resolvedType = enriched?.business_type?.trim() || businessType;
  const derivedStyle =
    partial.allowed_visual_style?.trim() ||
    enriched?.allowed_visual_style?.trim() ||
    `Authentic professional commercial photography for a ${resolvedType} business, on-niche subjects only, clean contemporary lighting, grounded in real ${resolvedType} work context — never off-niche stock scenes from unrelated industries`;

  const forbidden = partial.forbidden_elements?.length
    ? partial.forbidden_elements
    : [
        ...new Set([
          ...crossNicheBans,
          ...(enriched?.forbidden_elements ?? []),
        ]),
      ];

  return parseBrandDna({
    business_type: resolvedType,
    allowed_visual_style: derivedStyle,
    forbidden_elements: forbidden,
  });
}
