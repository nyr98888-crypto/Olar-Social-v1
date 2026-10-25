import { z } from "zod";

export const AgentOutputSchema = z.object({
  chat_reply: z
    .string()
    .describe(
      "תשובת שיחה טבעית בעברית מיונה בלבד — בלי פרומפטים ובלי המצאת עובדות"
    ),
  // Spec core: chit_chat | campaign_request | refinement (+ missing_info)
  intent: z.enum([
    "chit_chat",
    "campaign_request",
    "refinement",
    "missing_info",
  ]),
  social_post: z
    .object({
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
    })
    .nullable()
    .describe(
      "null ב-chit_chat או missing_info; מולא רק כשיש מספיק עובדות אמיתיות לקמפיין"
    ),
  image_task: z.object({
    generate_image: z
      .boolean()
      .describe(
        "true רק בבקשת קמפיין/תמונה מפורשת ועם grounding מספיק; false ב-chit_chat/missing_info"
      ),
    prompt: z
      .string()
      .optional()
      .describe(
        "English-only Flux prompt grounded in user+brand+vision; never garage/workshop/מוסך stock scenes"
      ),
    aspect_ratio: z.enum(["1:1", "4:5", "16:9"]).default("1:1"),
  }),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

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
 * When only business_type is known, derive allowed_visual_style dynamically
 * from that type (no fixed stock scenes). Caller-supplied fields always win.
 * Zero hardcoded visuals: style string is built from the user's niche label only.
 */
export function expandBrandDnaDefaults(
  partial: BrandDnaPartial | null | undefined
): BrandDna | null {
  if (!partial?.business_type?.trim()) return parseBrandDna(partial);

  const businessType = partial.business_type.trim();
  const derivedStyle = `Authentic professional commercial photography for a ${businessType} business, on-niche subjects only, clean contemporary lighting, grounded in real ${businessType} work context — never off-niche stock scenes from unrelated industries`;

  // Cross-niche bans: keep out of this business's visuals (not a scene template)
  const crossNicheBans = [
    "unrelated industry stock photo",
    "random celebrity",
    "political rally",
    "generic motivational quote poster",
  ];

  return parseBrandDna({
    business_type: businessType,
    allowed_visual_style:
      partial.allowed_visual_style?.trim() || derivedStyle,
    forbidden_elements:
      partial.forbidden_elements?.length
        ? partial.forbidden_elements
        : crossNicheBans,
  });
}
