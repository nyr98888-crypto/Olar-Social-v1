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

/** WhatsApp digital business card — grounded in Business DNA / profile only. */
export const WhatsAppCardSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Business name from profile/DNA only — never invent"),
  logo_hint: z
    .string()
    .optional()
    .describe("Short Hebrew hint for logo/brand mark from profile only"),
  services: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("Up to 3 services from profile/user only"),
  phone: z
    .string()
    .optional()
    .describe("Phone from profile only — never invent"),
});

export type WhatsAppCard = z.infer<typeof WhatsAppCardSchema>;

/** Single-platform adapted post (text + optional hashtags + CTA + channel extras). */
export const PlatformPostSchema = z.object({
  text: z.string().describe("Platform-adapted post text in Hebrew"),
  hashtags: z
    .array(z.string())
    .optional()
    .describe("Hashtags — Instagram: prefer ~5 local tags from niche/city"),
  cta: z
    .string()
    .optional()
    .describe("Platform-specific CTA in Hebrew"),
  /** WhatsApp digital card fields (name, logo hint, ≤3 services, phone). */
  card: WhatsAppCardSchema.optional().describe(
    "WhatsApp digital business card — profile/DNA facts only"
  ),
  /** Instagram 1:1 visual concept note (Hebrew for UI; FAL prompt stays English in image_task). */
  visual_concept: z
    .string()
    .optional()
    .describe("Short Hebrew note for 1:1 Instagram visual concept"),
  /** Google Business / Facebook location line from profile only. */
  city_or_neighborhood: z
    .string()
    .optional()
    .describe("City or neighborhood from profile — never invent"),
  /** Google Business offer line — only if user/profile supplied one. */
  offer: z
    .string()
    .optional()
    .describe("Offer text only when explicitly provided — never invent"),
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

/** Optional Business DNA / profile facts for deriving platform variants. */
export type PlatformGrounding = {
  businessName?: string;
  logoHint?: string;
  services?: string[];
  phone?: string;
  address?: string;
  city?: string;
  bioUrl?: string;
};

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
    platforms: output.social_post?.platforms ?? null,
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

/**
 * Derive platform-adapted posts from classic social_post fields (+ optional DNA grounding).
 * Never invents services/phone/address — only uses grounding when provided.
 * Preserves any AI-supplied platforms fields via merge when callers pass post.platforms first.
 */
export function derivePlatformsFromPost(
  post: SocialPostFields,
  grounding?: PlatformGrounding | null
): PlatformPosts {
  const existing = post.platforms ?? undefined;
  const cta = post.call_to_action || "";
  const fullText = `${post.headline}\n\n${post.body}`;
  const services = (grounding?.services || []).filter(Boolean).slice(0, 3);
  const name = grounding?.businessName?.trim() || "";
  const phone = grounding?.phone?.trim() || "";
  const city =
    grounding?.city?.trim() ||
    grounding?.address?.trim() ||
    "";
  const bioCta = grounding?.bioUrl?.trim()
    ? `לפרטים נוספים בביו: ${grounding.bioUrl}`
    : "לפרטים נוספים — לינק בביו";

  const inviteLines = [post.headline.trim(), (post.body.split("\n")[0] || post.body).trim()]
    .filter(Boolean)
    .slice(0, 2);
  const waInvite = inviteLines.join("\n") || post.headline;

  const localTags = (post.hashtags || []).slice(0, 5);

  const fbServices =
    services.length > 0
      ? `\n\nשירותים: ${services.join(" · ")}`
      : "";
  const fbAddress = grounding?.address?.trim()
    ? `\nכתובת: ${grounding.address.trim()}`
    : city
      ? `\nאזור: ${city}`
      : "";
  const fbContact = phone ? `\nטלפון: ${phone}` : "";

  const gbpBits = [
    city ? `${city}` : "",
    post.headline,
    post.body.split("\n").slice(0, 2).join(" ").trim(),
  ].filter(Boolean);
  const gbpText = gbpBits.join(" — ").slice(0, 320);
  const gbpCta = phone
    ? `התקשרו עכשיו: ${phone}`
    : cta || "צרו קשר עכשיו";

  const derived: PlatformPosts = {
    whatsapp: {
      text: waInvite,
      cta: "שלח כרטיס זה בוואטסאפ",
      card: {
        name: name || undefined,
        logo_hint: grounding?.logoHint?.trim() || (name ? `לוגו ${name}` : undefined),
        services: services.length ? services : undefined,
        phone: phone || undefined,
      },
    },
    instagram: {
      text: `${post.headline}\n${post.body}`.slice(0, 280),
      hashtags: localTags.length ? localTags : post.hashtags,
      cta: bioCta,
      visual_concept: "קונספט ויזואלי 1:1 — מותאם למותג",
    },
    facebook: {
      text: `${fullText}${fbServices}${fbAddress}${fbContact}`.trim(),
      cta: cta || (phone ? `לתיאום: ${phone}` : undefined),
      city_or_neighborhood: city || undefined,
    },
    google_business: {
      text: gbpText,
      cta: gbpCta,
      city_or_neighborhood: city || undefined,
      offer: undefined, // never invent offers
    },
  };

  // Merge: AI-supplied platform fields win over derived defaults (text always required)
  const mergePlat = (
    base: PlatformPost,
    over?: PlatformPost | null
  ): PlatformPost => ({
    ...base,
    ...over,
    text: (over?.text?.trim() || base.text).trim(),
    card: over?.card || base.card ? { ...base.card, ...over?.card } : undefined,
  });

  return {
    whatsapp: mergePlat(derived.whatsapp!, existing?.whatsapp),
    instagram: mergePlat(derived.instagram!, existing?.instagram),
    facebook: mergePlat(derived.facebook!, existing?.facebook),
    google_business: mergePlat(
      derived.google_business!,
      existing?.google_business
    ),
  };
}

/** Build wa.me/?text= share URL for WhatsApp card (no phone required — opens picker). */
export function buildWhatsAppCardShareUrl(shareText: string): string {
  return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
}

/** Format WhatsApp digital card + invite into shareable Hebrew text. */
export function formatWhatsAppCardShareText(
  plat: PlatformPost,
  fallbackName?: string
): string {
  const card = plat.card;
  const lines: string[] = [];
  if (plat.text?.trim()) lines.push(plat.text.trim());
  const name = card?.name?.trim() || fallbackName?.trim();
  if (name) lines.push(`\n📇 ${name}`);
  if (card?.logo_hint?.trim()) lines.push(`🎨 ${card.logo_hint.trim()}`);
  if (card?.services?.length) {
    lines.push(`שירותים: ${card.services.filter(Boolean).slice(0, 3).join(" · ")}`);
  }
  if (card?.phone?.trim()) lines.push(`📞 ${card.phone.trim()}`);
  lines.push(plat.cta?.trim() || "שלח כרטיס זה בוואטסאפ");
  return lines.filter(Boolean).join("\n");
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
