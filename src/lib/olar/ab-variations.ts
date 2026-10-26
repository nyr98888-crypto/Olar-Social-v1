/**
 * A/B campaign variations — sales vs storytelling + dual image prompts.
 */
import { z } from "zod";
import { sanitizeMarketingCopy } from "@/lib/olar/sanitize-marketing-copy";
import {
  buildGroundedPostFallback,
  type GroundedPostDraft,
} from "@/lib/olar/grounded-post-fallback";
import type { BusinessCategoryId } from "@/lib/olar/business-categories";
import {
  normalizePostType,
  postTypeDefaultCtas,
  type PostTypeId,
} from "@/lib/olar/post-types";

export const VariationIdSchema = z.enum(["var_1", "var_2"]);
export type VariationId = z.infer<typeof VariationIdSchema>;

export const CampaignVariationSchema = z.object({
  id: VariationIdSchema,
  label: z.string(),
  headline: z.string().min(1),
  bodyText: z.string().min(1),
  ctaButton: z.string().min(1),
  imagePrompt: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  hashtags: z.array(z.string()).optional(),
});

export type CampaignVariation = z.infer<typeof CampaignVariationSchema> & {
  imageUrl?: string | null;
};

export const VAR_1_LABEL = "✨ אופציה 1 (ישיר ומבצעי)";
export const VAR_2_LABEL = "🎯 אופציה 2 (חם וקהילתי)";

/** @deprecated use VAR_1_LABEL */
export const VAR_A_LABEL = VAR_1_LABEL;
/** @deprecated use VAR_2_LABEL */
export const VAR_B_LABEL = VAR_2_LABEL;

export function closeUpImagePrompt(base: string): string {
  const cleaned = (base || "").trim();
  return `${cleaned}. Close-up dynamic angle, focused on the craft or product, professional commercial lighting, shallow depth of field, 8k`.slice(
    0,
    900
  );
}

export function wideShotImagePrompt(base: string): string {
  const cleaned = (base || "").trim();
  return `${cleaned}. Wide atmospheric perspective of the workspace, salon or creative studio mood, natural daylight, inviting environment, commercial photography, 8k`.slice(
    0,
    900
  );
}

export function dualGroundedVariations(opts: {
  userText: string;
  category?: BusinessCategoryId | null;
  city?: string | null;
  goal?: string | null;
  postType?: PostTypeId | null;
}): { chat_reply: string; variations: CampaignVariation[] } {
  const postType = normalizePostType(opts.postType);
  const draft = buildGroundedPostFallback({ ...opts, postType });
  const story = storyFromDraft(draft, opts.userText, postType);
  const ctas = postTypeDefaultCtas(postType);
  return {
    chat_reply: `הכנו שתי אופציות שונות — בחרו את מה שמדבר אליכם!`,
    variations: [
      {
        id: "var_1",
        label: VAR_1_LABEL,
        headline: draft.headline,
        bodyText: draft.bodyText,
        ctaButton: draft.ctaButton || ctas.var1,
        imagePrompt: closeUpImagePrompt(draft.imagePrompt),
        hashtags: draft.hashtags,
        imageUrl: null,
      },
      {
        id: "var_2",
        label: VAR_2_LABEL,
        headline: story.headline,
        bodyText: story.bodyText,
        ctaButton: story.ctaButton || ctas.var2,
        imagePrompt: wideShotImagePrompt(draft.imagePrompt),
        hashtags: draft.hashtags,
        imageUrl: null,
      },
    ],
  };
}

function storyFromDraft(
  draft: GroundedPostDraft,
  userText: string,
  postType: PostTypeId
): Pick<CampaignVariation, "headline" | "bodyText" | "ctaButton"> {
  const base = sanitizeMarketingCopy(userText).slice(0, 280);
  const ctas = postTypeDefaultCtas(postType);
  const softClose =
    postType === "promotion"
      ? "נשמח להכיר ולהתאים לכם בדיוק את מה שצריך."
      : postType === "milestone"
        ? "גאים בתוצאה — נשמח לשמוע מה דעתכם."
        : postType === "client_satisfaction"
          ? "תודה על האמון — זה מה שנותן לנו כוח להמשיך."
          : "מהתחלה ועד התוצאה — ככה זה נראה כשעושים את זה כמו שצריך.";
  return {
    headline: draft.headline.includes("—")
      ? draft.headline
      : `${draft.headline} — עם לב`,
    bodyText: [
      postType === "before_after"
        ? "כל שינוי מתחיל ממקום אחד — ומסתיים בתוצאה שמרגישים."
        : "יש משהו מיוחד בעבודה שנעשית באהבה.",
      base || draft.bodyText,
      softClose,
    ].join("\n\n"),
    ctaButton: ctas.var2,
  };
}

export function normalizeVariationId(raw: string | undefined, index: number): VariationId {
  if (raw === "var_2" || raw === "var_b" || index === 1) return "var_2";
  return "var_1";
}
