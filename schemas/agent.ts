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
