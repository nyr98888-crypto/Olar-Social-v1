/**
 * Campaign variations — single active card (var_1).
 * Length-2 tuples remain for store type safety; var_2 mirrors var_1 when unused.
 */
import { z } from "zod";
import { buildGroundedPostFallback } from "@/lib/olar/grounded-post-fallback";
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

export const VAR_1_LABEL = "הפוסט שלך";
export const VAR_2_LABEL = "הפוסט שלך";

/** @deprecated use VAR_1_LABEL */
export const VAR_A_LABEL = VAR_1_LABEL;
/** @deprecated use VAR_2_LABEL */
export const VAR_B_LABEL = VAR_2_LABEL;

/** Pad a single variation into a length-2 tuple for store type safety. */
export function padVariationPair(
  v: CampaignVariation
): [CampaignVariation, CampaignVariation] {
  const primary: CampaignVariation = {
    ...v,
    id: "var_1",
    label: v.label || VAR_1_LABEL,
  };
  return [
    primary,
    {
      ...primary,
      id: "var_2",
      label: VAR_2_LABEL,
    },
  ];
}

/** Option 1 framing — finished clean result focus (var_1 / seed1). */
export function closeUpImagePrompt(base: string): string {
  const cleaned = (base || "").trim();
  return `${cleaned}. Finished clean result focus, pristine completed craft or product, professional commercial lighting, shallow depth of field, 8k`.slice(
    0,
    900
  );
}

/** Option 2 framing — atmosphere / table / environment (var_2 / seed2). */
export function wideShotImagePrompt(base: string): string {
  const cleaned = (base || "").trim();
  return `${cleaned}. Atmosphere and table-focused scene, inviting environment context, soft natural daylight, lifestyle commercial photography, wider framing of the setting, 8k`.slice(
    0,
    900
  );
}

/** Single grounded card (padded to length-2 for store compatibility). */
export function singleGroundedVariation(opts: {
  userText: string;
  category?: BusinessCategoryId | null;
  city?: string | null;
  goal?: string | null;
  postType?: PostTypeId | null;
}): { chat_reply: string; variations: [CampaignVariation, CampaignVariation] } {
  const postType = normalizePostType(opts.postType);
  const draft = buildGroundedPostFallback({ ...opts, postType });
  const ctas = postTypeDefaultCtas(postType);
  const primary: CampaignVariation = {
    id: "var_1",
    label: VAR_1_LABEL,
    headline: draft.headline,
    bodyText: draft.bodyText,
    ctaButton: draft.ctaButton || ctas.var1,
    imagePrompt: closeUpImagePrompt(draft.imagePrompt),
    hashtags: draft.hashtags,
    imageUrl: null,
  };
  return {
    chat_reply: "הכנתי לך פוסט מוכן — אפשר להמשיך לערוך בסטודיו!",
    variations: padVariationPair(primary),
  };
}

/** @deprecated Prefer singleGroundedVariation — kept as alias for callers. */
export function dualGroundedVariations(opts: {
  userText: string;
  category?: BusinessCategoryId | null;
  city?: string | null;
  goal?: string | null;
  postType?: PostTypeId | null;
}): { chat_reply: string; variations: CampaignVariation[] } {
  return singleGroundedVariation(opts);
}

export function normalizeVariationId(raw: string | undefined, index: number): VariationId {
  if (raw === "var_2" || raw === "var_b" || index === 1) return "var_2";
  return "var_1";
}
