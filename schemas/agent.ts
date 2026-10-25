import { z } from "zod";

export const AgentOutputSchema = z.object({
  chat_reply: z
    .string()
    .describe("תשובת שיחה טבעית, שירותית וזורמת בעברית מיונה"),
  // Spec core: chit_chat | campaign_request | refinement (+ missing_info)
  intent: z.enum([
    "chit_chat",
    "campaign_request",
    "refinement",
    "missing_info",
  ]),
  social_post: z
    .object({
      headline: z.string().describe("כותרת שיווקית לפוסט"),
      body: z.string().describe("גוף הפוסט כולל הנעה לפעולה"),
      hashtags: z.array(z.string()).describe("האשטגים רלוונטיים"),
    })
    .nullable(),
  image_task: z.object({
    generate_image: z.boolean(),
    prompt: z
      .string()
      .optional()
      .describe("פרומפט מפורט באנגלית בלבד המיועד ל-FAL Flux"),
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
