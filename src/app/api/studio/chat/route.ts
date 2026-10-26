/**
 * Studio Maya chat — OpenRouter exclusive (gpt-4o-mini + haiku fallbacks).
 * Always returns quickly with parseable { reply, cardUpdate, … }.
 * Soft plain Hebrew reply when JSON parse fails — never hang on dual races.
 */
import { NextResponse } from "next/server";
import { AI_CONFIG } from "@/lib/ai-config";
import {
  chatWithOpenRouter,
  isOpenRouterConfigured,
  OPENROUTER_MISSING_KEY_HE,
} from "@/lib/ai/providers/openrouter";
import {
  closeUpImagePrompt,
  padVariationPair,
  singleGroundedVariation,
  VAR_1_LABEL,
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
import { generateImageWithFallback } from "@/lib/ai/generate-ab-images";
import { trimImageAnchorWords } from "@/lib/ai/image-anchor-prompt";
import { resolvePostTypeImageBias } from "@/lib/ai/resolve-post-type-image-bias";
import { isBlockedStudioChatReply } from "@/lib/ai/golden-templates";
import { getCampaignById } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

type CurrentPostPayload = {
  headline?: string;
  title?: string;
  bodyText?: string;
  body?: string;
  ctaButton?: string;
  cta?: string;
  imageUrl?: string | null;
};

type ChatHistoryTurn = {
  role?: string;
  content?: string;
};

type StudioChatBody = {
  userText?: string;
  input?: string;
  prompt?: string;
  message?: string;
  category?: string;
  city?: string;
  goal?: string | null;
  businessName?: string;
  skipImages?: boolean;
  postType?: string | null;
  imageAnchorWords?: string | null;
  currentPost?: CurrentPostPayload | null;
  currentCard?: { title?: string; bodyText?: string; body?: string } | null;
  messages?: ChatHistoryTurn[] | null;
  history?: ChatHistoryTurn[] | null;
  campaignId?: number | string | null;
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
  providerUsed: string,
  cardUpdate: { title: string | null; bodyText: string | null } | null = null
) {
  const a = cleanVar(variations[0]!);
  const b = cleanVar(variations[1] || variations[0]!);
  const rawReply = replyMessage.trim();
  const reply = sanitizeMarketingCopy(
    rawReply && !isBlockedStudioChatReply(rawReply)
      ? rawReply
      : "הכנתי לך פוסט מוכן — תראו משמאל."
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
    reply,
    replyMessage: reply,
    cardUpdate: cardUpdate ?? {
      title: a.headline || null,
      bodyText: a.bodyText || null,
    },
    updatedTitle: cardUpdate?.title ?? a.headline,
    updatedBodyText: cardUpdate?.bodyText ?? a.bodyText,
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
        label: b.label || VAR_1_LABEL,
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
    soft_message: "הפוסט עודכן — אפשר להמשיך לערוך.",
  };
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function resolveCardFields(
  body: StudioChatBody,
  currentPost: CurrentPostPayload | null
): { title: string; bodyText: string } {
  const title = (
    body.currentCard?.title ||
    currentPost?.title ||
    currentPost?.headline ||
    ""
  ).trim();
  const bodyText = (
    body.currentCard?.bodyText ||
    body.currentCard?.body ||
    currentPost?.bodyText ||
    currentPost?.body ||
    ""
  ).trim();
  return { title, bodyText };
}

function buildMayaSystemPrompt(title: string, bodyText: string): string {
  return `את מאיה, מנהלת השיווק הדיגיטלי. הפוסט הנוכחי של הלקוח: כותרת: '${title}', תוכן: '${bodyText}'. עני בעברית מקצועית וקולחת. אם מבקשים לשנות כותרת או טקסט, החזירי תשובה במבנה JSON תקין:
{
  "reply": "התשובה החברית שלך ללקוח",
  "cardUpdate": {
    "title": "כותרת חדשה או null אם לא שונתה",
    "bodyText": "טקסט חדש או null אם לא שונה"
  }
}

כללים:
- עברית חמה, קצרה, לשון נקבה ב-reply בלבד.
- תמיד החזירי JSON תקין בלבד (בלי markdown).
- אם מבקשים שינוי קל לפוסט הקיים — עדכני cardUpdate (title/bodyText). השתמשי ב-null בשדות שלא השתנו.
- אם מבקשים פוסט חדש — צרי פוסט אחד בלבד (headline + bodyText + ctaButton). בלי שתי אופציות A/B.

סכמת JSON מורחבת (אופציונלי לפוסט חדש):
{
  "reply": "תשובה קצרה למשתמש בעברית",
  "cardUpdate": {
    "title": "כותרת מעודכנת או null אם לא השתנתה",
    "bodyText": "גוף מעודכן או null אם לא השתנה"
  },
  "headline": "כותרת הפוסט",
  "bodyText": "גוף הפוסט",
  "ctaButton": "CTA קצר"
}`;
}

function extractCardUpdate(parsed: Record<string, unknown>): {
  title: string | null;
  bodyText: string | null;
} {
  const raw = parsed.cardUpdate;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const cu = raw as Record<string, unknown>;
    const title =
      cu.title === null
        ? null
        : typeof cu.title === "string"
          ? cu.title.trim() || null
          : null;
    const bodyText =
      cu.bodyText === null
        ? null
        : typeof cu.bodyText === "string"
          ? cu.bodyText.trim() || null
          : typeof cu.body === "string"
            ? cu.body.trim() || null
            : null;
    return { title, bodyText };
  }
  return {
    title:
      typeof parsed.updatedTitle === "string"
        ? parsed.updatedTitle.trim() || null
        : null,
    bodyText:
      typeof parsed.updatedBodyText === "string"
        ? parsed.updatedBodyText.trim() || null
        : null,
  };
}

function extractMayaReply(parsed: Record<string, unknown>): string {
  if (typeof parsed.reply === "string" && parsed.reply.trim()) {
    return parsed.reply.trim();
  }
  if (typeof parsed.replyMessage === "string" && parsed.replyMessage.trim()) {
    return parsed.replyMessage.trim();
  }
  if (typeof parsed.chat_reply === "string" && parsed.chat_reply.trim()) {
    return parsed.chat_reply.trim();
  }
  return "עדכנתי את הכרטיס משמאל — תראו איך זה נשמע עכשיו.";
}

async function resolveCurrentPostFromDb(
  body: StudioChatBody
): Promise<CurrentPostPayload | null> {
  const rawId = body.campaignId;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number.parseInt(rawId, 10)
        : NaN;
  if (Number.isFinite(id) && id > 0) {
    try {
      const row = await getCampaignById(id);
      if (row) {
        return {
          headline: row.title,
          title: row.title,
          bodyText: row.bodyText,
          body: row.bodyText,
          imageUrl: row.imageUrl || null,
        };
      }
    } catch (err) {
      console.warn("[api/studio/chat] campaign DB lookup failed", err);
    }
  }
  if (body.currentCard?.title || body.currentCard?.bodyText) {
    return {
      headline: body.currentCard.title || "",
      title: body.currentCard.title || "",
      bodyText: body.currentCard.bodyText || body.currentCard.body || "",
      body: body.currentCard.bodyText || body.currentCard.body || "",
    };
  }
  return body.currentPost || null;
}

function parseMayaJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stripJsonFence(content)) as Record<string, unknown>;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function variationsFromMaya(
  parsed: Record<string, unknown>,
  userText: string,
  currentPost: CurrentPostPayload | null,
  cardTitle: string,
  cardBody: string
): CampaignVariation[] | null {
  const card = extractCardUpdate(parsed);
  const fallbackHeadline = String(
    card.title ||
      parsed.updatedTitle ||
      parsed.headline ||
      currentPost?.headline ||
      currentPost?.title ||
      cardTitle ||
      ""
  ).trim();
  const fallbackBody = String(
    card.bodyText ||
      parsed.updatedBodyText ||
      parsed.bodyText ||
      parsed.body ||
      currentPost?.bodyText ||
      currentPost?.body ||
      cardBody ||
      ""
  ).trim();
  const fallbackCta = String(
    parsed.ctaButton ||
      parsed.cta ||
      currentPost?.ctaButton ||
      currentPost?.cta ||
      "לתיאום בוואטסאפ"
  ).trim();

  let rawVars = Array.isArray(parsed.variations) ? parsed.variations : null;
  if (!rawVars || rawVars.length < 1) {
    if (!fallbackHeadline || !fallbackBody) return null;
    rawVars = [
      {
        headline: fallbackHeadline,
        bodyText: fallbackBody,
        ctaButton: fallbackCta,
      },
    ];
  }

  const v = (rawVars[0] && typeof rawVars[0] === "object"
    ? rawVars[0]
    : {}) as Record<string, unknown>;
  const cleaned = sanitizeVariationCopy({
    headline: String(v.headline || fallbackHeadline || ""),
    bodyText: String(v.bodyText || v.body || fallbackBody || ""),
    ctaButton: String(v.ctaButton || v.cta || fallbackCta || ""),
    fallbackCta: fallbackCta,
  });

  if (!cleaned.headline?.trim() || !cleaned.bodyText?.trim()) {
    return null;
  }

  return padVariationPair({
    id: "var_1",
    label: VAR_1_LABEL,
    headline: cleaned.headline,
    bodyText: cleaned.bodyText,
    ctaButton: cleaned.ctaButton,
    imagePrompt: userText,
    imageUrl: null,
    hashtags: [],
  });
}

function historyFromBody(body: StudioChatBody): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  const raw = Array.isArray(body.messages)
    ? body.messages
    : Array.isArray(body.history)
      ? body.history
      : [];
  return raw
    .filter(
      (m): m is ChatHistoryTurn & { content: string } =>
        Boolean(m && typeof m.content === "string" && m.content.trim())
    )
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content.trim(),
    }))
    .slice(-6);
}

function buildSoftReplyPayload(
  body: StudioChatBody,
  reply: string,
  providerUsed: string
) {
  const category = normalizeCategory(body.category);
  const postType = normalizePostType(body.postType);
  const userText = stripCategoryLeak(
    (
      body.userText ||
      body.input ||
      body.prompt ||
      body.message ||
      ""
    ).trim()
  );
  const title =
    body.currentCard?.title ||
    body.currentPost?.title ||
    body.currentPost?.headline ||
    "";
  const bodyText =
    body.currentCard?.bodyText ||
    body.currentCard?.body ||
    body.currentPost?.bodyText ||
    body.currentPost?.body ||
    "";

  let variations: CampaignVariation[];
  if (title.trim() && bodyText.trim()) {
    variations = padVariationPair({
      id: "var_1",
      label: VAR_1_LABEL,
      headline: title.trim(),
      bodyText: bodyText.trim(),
      ctaButton:
        body.currentPost?.ctaButton ||
        body.currentPost?.cta ||
        "לתיאום בוואטסאפ",
      imagePrompt: userText || title,
      imageUrl: body.currentPost?.imageUrl || null,
      hashtags: [],
    });
  } else if (userText) {
    variations = singleGroundedVariation({
      userText,
      category,
      city: body.city,
      goal: body.goal,
      postType,
    }).variations;
  } else {
    variations = padVariationPair({
      id: "var_1",
      label: VAR_1_LABEL,
      headline: "הפוסט שלך",
      bodyText: "כתבו לי מה לעדכן בכרטיס משמאל.",
      ctaButton: "לתיאום בוואטסאפ",
      imagePrompt: "local business marketing post",
      imageUrl: null,
      hashtags: [],
    });
  }

  return studioPayload(
    variations,
    reply,
    postType,
    category,
    providerUsed,
    { title: null, bodyText: null }
  );
}

async function mayaOpenRouterResponse(
  body: StudioChatBody
): Promise<
  | ReturnType<typeof studioPayload>
  | { softFail: true; error: string }
  | null
> {
  const userText = stripCategoryLeak(
    (
      body.userText ||
      body.input ||
      body.prompt ||
      body.message ||
      ""
    ).trim()
  );
  if (!userText) return null;

  if (!isOpenRouterConfigured()) {
    console.warn("[api/studio/chat] OPENROUTER_API_KEY missing");
    return { softFail: true, error: OPENROUTER_MISSING_KEY_HE };
  }

  const category = normalizeCategory(body.category);
  const postType = normalizePostType(body.postType);
  const currentPost = await resolveCurrentPostFromDb(body);
  const { title, bodyText } = resolveCardFields(body, currentPost);
  const history = historyFromBody(body);

  try {
    const orMessages = [
      {
        role: "system" as const,
        content: buildMayaSystemPrompt(title, bodyText),
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: [
          body.businessName ? `שם העסק: ${body.businessName}` : "",
          category ? `קטגוריה: ${category}` : "",
          `בקשת המשתמש: ${userText}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];

    const result = await chatWithOpenRouter({
      messages: orMessages,
      temperature: 0.75,
      maxTokens: 1600,
      timeoutMs: AI_CONFIG.MAYA_CHAT_TIMEOUT_MS,
      models: [AI_CONFIG.MAYA_CHAT_MODEL, ...AI_CONFIG.MAYA_CHAT_FALLBACKS],
      jsonMode: true,
    });

    const parsed = parseMayaJson(result.content);

    // Soft plain Hebrew reply when JSON fails — never hang / never "no response"
    if (!parsed) {
      console.warn(
        "[api/studio/chat] Maya JSON parse failed → soft plain reply"
      );
      const plain = result.content.trim().slice(0, 800);
      const softReply =
        plain && !plain.startsWith("{")
          ? plain
          : "קיבלתי — עדכנתי לפי הבקשה. תראו את הכרטיס משמאל.";
      return buildSoftReplyPayload(
        body,
        softReply,
        `openrouter-soft:${result.model}`
      );
    }

    const card = extractCardUpdate(parsed);
    const reply = extractMayaReply(parsed);
    let variations = variationsFromMaya(
      parsed,
      userText,
      currentPost,
      title,
      bodyText
    );

    if (!variations) {
      // Still return reply quickly with current card
      return buildSoftReplyPayload(
        body,
        reply,
        `openrouter-reply-only:${result.model}`
      );
    }

    if (body.skipImages && currentPost?.imageUrl) {
      variations = padVariationPair({
        ...variations[0]!,
        imageUrl: currentPost.imageUrl,
      });
    }

    console.log("[api/studio/chat] Maya OpenRouter OK", {
      model: result.model,
      latencyMs: result.latencyMs,
    });

    return studioPayload(
      variations,
      reply,
      postType,
      category,
      `openrouter:${result.model}`,
      card
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("OPENROUTER") || msg.includes(OPENROUTER_MISSING_KEY_HE)) {
      return { softFail: true, error: OPENROUTER_MISSING_KEY_HE };
    }
    console.warn("[api/studio/chat] Maya OpenRouter failed", msg);
    return null;
  }
}

async function groundedStudioResponse(body: StudioChatBody) {
  const userText = stripCategoryLeak(
    (body.userText || body.input || body.prompt || body.message || "").trim()
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

  const single = singleGroundedVariation({
    userText,
    category,
    city: body.city,
    goal: body.goal,
    postType,
  });

  let variations = single.variations;
  if (!body.skipImages) {
    try {
      const bias = resolvePostTypeImageBias({
        postType,
        category,
        userText,
        basePromptA: variations[0]!.imagePrompt,
        basePromptB: variations[0]!.imagePrompt,
      });
      const promptA =
        postType === "promotion"
          ? closeUpImagePrompt(variations[0]!.imagePrompt)
          : bias.promptA;
      const img = await generateImageWithFallback({
        prompt: promptA,
        seed: Math.floor(Math.random() * 10000000),
        category,
        userText,
        businessName: body.businessName,
        postType,
        anchorDriven: Boolean(imageAnchorWords),
      });
      variations = padVariationPair({
        ...variations[0]!,
        imagePrompt: img.prompt || promptA,
        imageUrl: img.url,
      });
    } catch (err) {
      console.warn(
        "[api/studio/chat] grounded image soft-fail",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json(
    studioPayload(
      variations,
      single.chat_reply,
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

  // Prefer skipImages for fast chat (client fills FAL in background)
  const skipImages = body.skipImages !== false;

  const maya = await mayaOpenRouterResponse({
    ...body,
    skipImages,
  });

  if (maya && "softFail" in maya && maya.softFail) {
    return NextResponse.json(
      { ok: false, error: maya.error },
      { status: 503 }
    );
  }

  if (maya && !("softFail" in maya)) {
    if (skipImages) {
      const kept =
        maya.variations[0]?.imageUrl || body.currentPost?.imageUrl || null;
      if (!kept) {
        for (const v of maya.variations) v.imageUrl = null;
        maya.post.imageUrl = null;
        maya.postData.imageUrl = null;
        maya.imageUrl = null;
      }
    }
    return NextResponse.json(maya);
  }

  // Fast grounded fallback — no dual races / no Together / no hanging generate-post
  return groundedStudioResponse({ ...body, skipImages: true });
}
