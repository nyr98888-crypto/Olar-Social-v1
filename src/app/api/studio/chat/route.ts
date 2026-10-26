/**
 * Studio chat — ALWAYS returns structured A/B JSON:
 * { ok, replyMessage, variations[2], postData? }
 * Never free-text-only. Never 500 from LLM JSON parse.
 * Freeform user text is always accepted (no "ready-made text" gate).
 */
import { NextResponse } from "next/server";
import { POST as generatePost } from "@/app/api/generate-post/route";
import {
  closeUpImagePrompt,
  dualGroundedVariations,
  VAR_1_LABEL,
  VAR_2_LABEL,
  wideShotImagePrompt,
  type CampaignVariation,
} from "@/lib/olar/ab-variations";
import {
  normalizeCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import { normalizePostType } from "@/lib/olar/post-types";
import {
  sanitizeMarketingCopy,
  sanitizeVariationCopy,
} from "@/lib/olar/sanitize-marketing-copy";
import { stripCategoryLeak } from "@/lib/olar/strip-category";
import { generateAbImagesParallel } from "@/lib/ai/generate-ab-images";
import { trimImageAnchorWords } from "@/lib/ai/image-anchor-prompt";
import { resolvePostTypeImageBias } from "@/lib/ai/resolve-post-type-image-bias";
import { isBlockedStudioChatReply } from "@/lib/ai/golden-templates";

export const runtime = "nodejs";
export const maxDuration = 60;

type StudioChatBody = {
  userText?: string;
  input?: string;
  prompt?: string;
  category?: string;
  city?: string;
  goal?: string | null;
  businessName?: string;
  skipImages?: boolean;
  postType?: string | null;
  imageAnchorWords?: string | null;
};

function cleanVar(v: CampaignVariation): CampaignVariation {
  const cleaned = sanitizeVariationCopy({
    headline: v.headline,
    bodyText: v.bodyText,
    ctaButton: v.ctaButton,
    fallbackCta: v.ctaButton,
  });
  return {
    ...v,
    headline: cleaned.headline,
    bodyText: cleaned.bodyText,
    ctaButton: cleaned.ctaButton,
  };
}

function studioPayload(
  variations: CampaignVariation[],
  replyMessage: string,
  postType: string,
  category: BusinessCategoryId | null,
  providerUsed: string
) {
  const a = cleanVar(variations[0]!);
  const b = cleanVar(variations[1] || variations[0]!);
  const rawReply = replyMessage.trim();
  const reply = sanitizeMarketingCopy(
    rawReply && !isBlockedStudioChatReply(rawReply)
      ? rawReply
      : "הכנו שתי אופציות שונות — בחרו את מה שמדבר אליכם!"
  );
  const post = {
    headline: a.headline,
    bodyText: a.bodyText,
    imageUrl: a.imageUrl || null,
    imagePrompt: a.imagePrompt,
    ctaButton: a.ctaButton,
  };
  return {
    ok: true as const,
    replyMessage: reply,
    postType,
    variations: [
      {
        id: "var_1" as const,
        label: a.label || VAR_1_LABEL,
        headline: a.headline,
        bodyText: a.bodyText,
        imageUrl: a.imageUrl || null,
        ctaButton: a.ctaButton,
        imagePrompt: a.imagePrompt,
        hashtags: a.hashtags || [],
      },
      {
        id: "var_2" as const,
        label: b.label || VAR_2_LABEL,
        headline: b.headline,
        bodyText: b.bodyText,
        imageUrl: b.imageUrl || null,
        ctaButton: b.ctaButton,
        imagePrompt: b.imagePrompt,
        hashtags: b.hashtags || [],
      },
    ],
    post,
    postData: {
      headline: a.headline,
      bodyText: a.bodyText,
      body: a.bodyText,
      ctaButton: a.ctaButton,
      imageUrl: a.imageUrl || null,
      imagePrompt: a.imagePrompt,
      hashtags: a.hashtags || [],
    },
    headline: a.headline,
    bodyText: a.bodyText,
    ctaButton: a.ctaButton,
    imagePrompt: a.imagePrompt,
    imageUrl: a.imageUrl || null,
    hashtags: a.hashtags || [],
    category,
    chat_reply: reply,
    providerUsed,
    soft_message: "שתי אופציות מוכנות — בחרו את המועדפת והמשיכו לערוך.",
  };
}

function hasValidContract(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.ok === false) return false;
  if (typeof d.replyMessage !== "string" && typeof d.chat_reply !== "string") {
    return false;
  }
  if (!Array.isArray(d.variations) || d.variations.length < 2) return false;
  const a = d.variations[0] as Record<string, unknown> | undefined;
  const b = d.variations[1] as Record<string, unknown> | undefined;
  return Boolean(
    a &&
      b &&
      String(a.headline || "").trim() &&
      String(a.bodyText || "").trim() &&
      String(b.headline || "").trim() &&
      String(b.bodyText || "").trim()
  );
}

async function groundedStudioResponse(body: StudioChatBody) {
  const userText = stripCategoryLeak(
    (body.userText || body.input || body.prompt || "").trim()
  );
  const category = normalizeCategory(body.category);
  const postType = normalizePostType(body.postType);
  const imageAnchorWords = trimImageAnchorWords(body.imageAnchorWords);

  if (!userText) {
    return NextResponse.json({
      ok: false,
      error: "חסר טקסט מהמשתמש.",
    });
  }

  const dual = dualGroundedVariations({
    userText,
    category,
    city: body.city,
    goal: body.goal,
    postType,
  });

  let variations = dual.variations;
  if (!body.skipImages) {
    try {
      const bias = resolvePostTypeImageBias({
        postType,
        category,
        userText,
        basePromptA: variations[0]!.imagePrompt,
        basePromptB: variations[1]!.imagePrompt,
      });
      const promptA =
        postType === "promotion"
          ? closeUpImagePrompt(variations[0]!.imagePrompt)
          : bias.promptA;
      const promptB =
        postType === "promotion"
          ? wideShotImagePrompt(variations[1]!.imagePrompt)
          : bias.promptB;
      const [imgA, imgB] = await generateAbImagesParallel({
        promptA,
        promptB,
        category,
        userText,
        businessName: body.businessName,
        postType,
        imageAnchorWords: imageAnchorWords || null,
      });
      variations = [
        {
          ...variations[0]!,
          imagePrompt: imgA.prompt || promptA,
          imageUrl: imgA.url,
        },
        {
          ...variations[1]!,
          imagePrompt: imgB.prompt || promptB,
          imageUrl: imgB.url,
        },
      ];
    } catch (err) {
      console.warn(
        "[api/studio/chat] grounded images soft-fail",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json(
    studioPayload(
      variations,
      dual.chat_reply,
      postType,
      category,
      "fallback:studio-grounded"
    )
  );
}

export async function POST(request: Request) {
  let body: StudioChatBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as StudioChatBody;
  } catch {
    body = {};
  }

  // Reconstruct request so generate-post can re-read the same body
  const forward = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  });

  try {
    const res = await generatePost(forward);
    let data: unknown;
    try {
      const text = await res.text();
      const stripped = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      data = JSON.parse(stripped);
    } catch (parseErr) {
      console.warn(
        "[api/studio/chat] response JSON parse failed → grounded",
        parseErr instanceof Error ? parseErr.message : parseErr
      );
      return groundedStudioResponse(body);
    }

    if (hasValidContract(data)) {
      const d = data as Record<string, unknown>;
      // Normalize replyMessage if only chat_reply present
      if (typeof d.replyMessage !== "string" && typeof d.chat_reply === "string") {
        d.replyMessage = d.chat_reply;
      }
      // Never return lecture / soft-fail as chat_reply on success
      if (
        typeof d.replyMessage === "string" &&
        isBlockedStudioChatReply(d.replyMessage)
      ) {
        d.replyMessage =
          "הכנו שתי אופציות שונות — בחרו את מה שמדבר אליכם!";
        d.chat_reply = d.replyMessage;
      }
      // Ensure `post` alias of variations[0] for left-preview clients
      const vars = d.variations as Array<Record<string, unknown>>;
      const v0 = vars[0]!;
      if (!d.post || typeof d.post !== "object") {
        d.post = {
          headline: String(v0.headline || ""),
          bodyText: String(v0.bodyText || ""),
          imageUrl: (v0.imageUrl as string | null) || null,
          imagePrompt: String(v0.imagePrompt || ""),
          ctaButton: String(v0.ctaButton || ""),
        };
      }
      return NextResponse.json(d);
    }

    console.warn("[api/studio/chat] incomplete contract → grounded");
    return groundedStudioResponse(body);
  } catch (err) {
    console.error(
      "[api/studio/chat] unexpected → grounded",
      err instanceof Error ? err.message : err
    );
    return groundedStudioResponse(body);
  }
}
