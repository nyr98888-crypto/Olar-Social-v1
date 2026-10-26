/**
 * Single-card campaign generation — 1 Hebrew copy + 1 FLUX image.
 * Response includes `variations[]` (length-2 padded for store types) plus
 * legacy flat fields and `post` alias of variations[0].
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  checkIpRateLimit,
  clientIpFromRequest,
  GENERATE_POST_RATE_LIMIT_MESSAGE,
} from "@/lib/api/ip-rate-limit";
import {
  getMarketingProfile,
  recordPostActivity,
  type UserMarketingProfile,
} from "@/lib/olar/user-marketing-profile";
import {
  generateStructuredText,
  GENERATE_POST_TIMEOUT_MS,
} from "@/lib/ai/text-service";
import {
  buildCategoryLockSystemBlock,
  legacyNicheFromCategory,
  normalizeCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import { stripCategoryLeak } from "@/lib/olar/strip-category";
import {
  hasBracketLeak,
  sanitizeMarketingCopy,
  sanitizeVariationCopy,
  stripBracketPlaceholders,
} from "@/lib/olar/sanitize-marketing-copy";
import {
  disambiguateBusinessDomain,
  HEBREW_COMPOUND_NOUN_RULE_HE,
  buildDisambiguationSystemBlock,
} from "@/lib/ai/hebrew-disambiguation";
import {
  VAR_1_LABEL,
  closeUpImagePrompt,
  padVariationPair,
  singleGroundedVariation,
  type CampaignVariation,
} from "@/lib/olar/ab-variations";
import { generateImageWithFallback } from "@/lib/ai/generate-ab-images";
import { resolvePostTypeImageBias } from "@/lib/ai/resolve-post-type-image-bias";
import { trimImageAnchorWords } from "@/lib/ai/image-anchor-prompt";
import { buildMayaPersonaBlock } from "@/lib/ai-persona";
import { isBlockedStudioChatReply } from "@/lib/ai/golden-templates";
import {
  normalizePostType,
  postTypeDefaultCtas,
  postTypeLlmToneBlock,
  type PostTypeId,
} from "@/lib/olar/post-types";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystem(
  category: BusinessCategoryId | null,
  raw: string,
  postType: PostTypeId,
  marketingProfile: UserMarketingProfile | null = null
): string {
  const lockedNiche = category ? legacyNicheFromCategory(category) : undefined;
  const domain =
    disambiguateBusinessDomain({
      text: raw,
      niche: lockedNiche || raw,
    })?.domain ?? null;
  const categoryLock = category
    ? `\n\n${buildCategoryLockSystemBlock(category)}\n`
    : "";

  const isPromo = postType === "promotion";
  const styleBlock = isPromo
    ? `STYLE = SALES / DIRECT (single post):
- Short punchy Hebrew headline.
- Body focuses on offer, availability, speed, clear next step.
- CTA = immediate WhatsApp booking (e.g. להזמנה מהירה בוואטסאפ).
- image_task.prompt = English CLOSE-UP of the craft/product/action.`
    : `STYLE = RESULT-FOCUSED (single post):
- Short punchy Hebrew headline centered on the outcome / win / finished result.
- Body is concise and authentic — ground only in userText.
- CTA must match the post-type rules below (engagement, not invented promos).
- image_task.prompt = English visual matching the post-type image guidance.`;

  return `${buildMayaPersonaBlock({ category, marketingProfile })}

You are Yona, a Hebrew marketing agent for Israeli local businesses.
Return ONLY valid JSON matching AgentOutputSchema:
- chat_reply: short Hebrew (first person female)
- intent: "campaign_request"
- social_post: { headline, body, hashtags, call_to_action, has_explicit_price }
- image_task: { generate_image: false, aspect_ratio: "1:1", prompt: Detailed English visual brief for FLUX }
${categoryLock}
## Content pillar / post type (mandatory)
${postTypeLlmToneBlock(postType)}

## Style (mandatory — ONE post only)
${styleBlock}

## Hebrew Semantic Disambiguation
${HEBREW_COMPOUND_NOUN_RULE_HE}
${buildDisambiguationSystemBlock(domain)}

HARD RULES:
- Always return full marketing JSON: filled social_post (headline + body + CTA in Hebrew) plus short chat_reply. Polish any draft the user sent — never ask them to rewrite.
- Produce ONE post only — never two A/B options.
- Ground EVERY fact ONLY in the userText. Never invent prices, services, or dishes the user did not mention.
- If user mentions a specific dish (e.g. ג'חנון / פיצה / pizza), the English image prompt MUST feature that food close-up — appetizing, grounded, commercial food photography.
- NEVER invent numeric prices unless user wrote them.
- chat_reply and social_post in Hebrew; image_task.prompt in English only.
- NEVER echo square brackets [] or fill-in placeholders (למשל / השלימו כאן) in headline, body, or CTA. If userText looks like a draft form with [hints], replace them with polished finished Hebrew — never copy brackets into the post.
- "סדנת יצירה" / craft studio = arts & crafts creative studio (pottery, painting, handmade). NEVER industrial workshop, garage, handyman, or power tools. Female Hebrew owner names (e.g. מיכל) → female artist subject in image_task.prompt.`;
}

function cleanVariationFields(v: CampaignVariation): CampaignVariation {
  const ctas = postTypeDefaultCtas("promotion");
  const cleaned = sanitizeVariationCopy({
    headline: v.headline,
    bodyText: v.bodyText,
    ctaButton: v.ctaButton,
    fallbackCta: v.ctaButton || ctas.var1,
  });
  return {
    ...v,
    headline: cleaned.headline,
    bodyText: cleaned.bodyText,
    ctaButton: cleaned.ctaButton,
  };
}

function variationPayload(
  variations: CampaignVariation[],
  opts: {
    category: BusinessCategoryId | null;
    postType: PostTypeId;
    chat_reply?: string | null;
    providerUsed: string;
    soft_message?: string;
  }
) {
  const a = cleanVariationFields(variations[0]!);
  const b = cleanVariationFields(variations[1] || variations[0]!);
  const rawReply = opts.chat_reply?.trim() || "";
  const replyMessage = sanitizeMarketingCopy(
    rawReply && !isBlockedStudioChatReply(rawReply)
      ? rawReply
      : "הכנתי לך פוסט מוכן — אפשר להמשיך לערוך בסטודיו!"
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
    replyMessage,
    reply: replyMessage,
    postType: opts.postType,
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
    category: opts.category,
    chat_reply: replyMessage,
    providerUsed: opts.providerUsed,
    soft_message:
      opts.soft_message ||
      "הפוסט מוכן — לחצו להמשיך לעריכה בסטודיו.",
  };
}

async function attachSingleImage(
  variations: CampaignVariation[],
  opts: {
    userText: string;
    category: BusinessCategoryId | null;
    businessName?: string;
    niche?: string | null;
    postType: PostTypeId;
    imageAnchorWords?: string | null;
  }
): Promise<CampaignVariation[]> {
  const bias = resolvePostTypeImageBias({
    postType: opts.postType,
    category: opts.category,
    userText: opts.userText,
    basePromptA: variations[0]?.imagePrompt || opts.userText,
    basePromptB: variations[0]?.imagePrompt || opts.userText,
  });

  const prompt1 =
    opts.postType === "promotion"
      ? closeUpImagePrompt(variations[0]?.imagePrompt || opts.userText)
      : bias.promptA;

  const seed = Math.floor(Math.random() * 10000000);
  const imageRes = await generateImageWithFallback({
    prompt: prompt1,
    seed,
    category: opts.category,
    userText: opts.userText,
    businessName: opts.businessName,
    niche: opts.niche,
    postType: opts.postType,
    anchorDriven: Boolean(opts.imageAnchorWords?.trim()),
  });

  const withImage: CampaignVariation = {
    ...variations[0]!,
    imagePrompt: imageRes.prompt || prompt1,
    imageUrl: imageRes.url,
  };
  return padVariationPair(withImage);
}

export async function POST(request: Request) {
  let userText = "";
  let category: BusinessCategoryId | null = null;
  let city = "";
  let goal: string | null = null;
  let postType: PostTypeId = "promotion";

  try {
    const session = await getAppSession();
    if (!session) {
      console.warn("[api/generate-post] no session — grounded fallback path");
    }

    const body = (await request.json().catch(() => ({}))) as {
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

    const rawUserText = stripCategoryLeak(
      (body.userText || body.input || body.prompt || "").trim()
    );
    const hadBracketDraft = hasBracketLeak(rawUserText);
    userText = hadBracketDraft
      ? stripBracketPlaceholders(rawUserText)
      : rawUserText;
    category = normalizeCategory(body.category);
    city = (body.city || "").trim();
    goal = body.goal?.trim() || null;
    postType = normalizePostType(body.postType);
    const imageAnchorWords = trimImageAnchorWords(body.imageAnchorWords);
    const defaultCtas = postTypeDefaultCtas(postType);

    if (!userText) {
      return NextResponse.json({
        ok: false,
        error: "חסר טקסט מהמשתמש.",
      });
    }

    const rateKey =
      session?.user?.id && session.mode === "supabase"
        ? `user:${session.user.id}`
        : `ip:${clientIpFromRequest(request)}`;
    if (!checkIpRateLimit(rateKey)) {
      return NextResponse.json(
        { ok: false, error: GENERATE_POST_RATE_LIMIT_MESSAGE },
        { status: 429 }
      );
    }

    const lockedNiche = category
      ? legacyNicheFromCategory(category)
      : undefined;

    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());

    console.log("[api/generate-post] single-card start", {
      hasOpenRouter,
      textEngine: "openrouter-only",
      category,
      postType,
      timeoutMs: GENERATE_POST_TIMEOUT_MS,
      userSample: userText.slice(0, 80),
    });

    const grounded = singleGroundedVariation({
      userText,
      category,
      city,
      goal,
      postType,
    });

    let variations: CampaignVariation[] = grounded.variations;
    let chatReply = grounded.chat_reply;
    let providerUsed = "fallback:grounded-single";

    let marketingProfile: UserMarketingProfile | null = null;
    if (session?.mode === "supabase" && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        marketingProfile = await getMarketingProfile(supabase, session.user.id);
      } catch {
        marketingProfile = null;
      }
    }

    if (hasOpenRouter) {
      try {
        const userContent = hadBracketDraft
          ? `DRAFT FORM (replace placeholders with polished finished Hebrew — NEVER echo square brackets []):\n${userText}`
          : userText;
        const messages = [{ role: "user" as const, content: userContent }];
        const ctx = {
          rawPrompt: userText,
          businessName: body.businessName,
          city: city || undefined,
          niche: lockedNiche,
          timeoutMs: GENERATE_POST_TIMEOUT_MS,
        };

        const punchyRes = await generateStructuredText(
          buildSystem(category, userText, postType, marketingProfile),
          messages,
          ctx
        );

        const punchyPost = punchyRes.output.social_post;
        const punchyRawH = sanitizeMarketingCopy(punchyPost?.headline || "");
        const punchyRawB = sanitizeMarketingCopy(punchyPost?.body || "");
        const llmUsable =
          Boolean(punchyRawH && punchyRawB) &&
          !punchyRes.fallback &&
          !hasBracketLeak(punchyRawH) &&
          !hasBracketLeak(punchyRawB);

        if (llmUsable) {
          const punchyClean = sanitizeVariationCopy({
            headline: punchyPost?.headline || "",
            bodyText: punchyPost?.body || "",
            ctaButton: punchyPost?.call_to_action || "",
            fallbackHeadline: grounded.variations[0]!.headline,
            fallbackBody: grounded.variations[0]!.bodyText,
            fallbackCta: defaultCtas.var1,
          });

          const bias = resolvePostTypeImageBias({
            postType,
            category,
            userText,
            basePromptA:
              punchyRes.output.image_task?.prompt ||
              grounded.variations[0]!.imagePrompt,
            basePromptB:
              punchyRes.output.image_task?.prompt ||
              grounded.variations[0]!.imagePrompt,
          });

          const primary: CampaignVariation = {
            id: "var_1",
            label: VAR_1_LABEL,
            headline: punchyClean.headline,
            bodyText: punchyClean.bodyText,
            ctaButton: punchyClean.ctaButton || defaultCtas.var1,
            imagePrompt:
              postType === "promotion"
                ? closeUpImagePrompt(
                    punchyRes.output.image_task?.prompt ||
                      grounded.variations[0]!.imagePrompt
                  )
                : bias.promptA,
            hashtags: punchyPost?.hashtags || [],
            imageUrl: null,
          };
          variations = padVariationPair(primary);
          const llmReply = punchyRes.output.chat_reply?.trim() || "";
          chatReply =
            llmReply && !isBlockedStudioChatReply(llmReply)
              ? llmReply
              : grounded.chat_reply;
          providerUsed = `single:${punchyRes.providerUsed}`;
        } else {
          console.warn("[api/generate-post] incomplete text → grounded", {
            punchyFallback: punchyRes.fallback,
            punchyHasPost: Boolean(punchyPost),
          });
        }
      } catch (err) {
        console.error(
          "[api/generate-post] LLM failed → grounded",
          err instanceof Error ? err.message : err
        );
      }
    }

    if (!body.skipImages) {
      try {
        variations = await attachSingleImage(variations, {
          userText,
          category,
          businessName: body.businessName,
          niche: lockedNiche,
          postType,
          imageAnchorWords: imageAnchorWords || null,
        });
      } catch (err) {
        console.error(
          "[api/generate-post] single image failed",
          err instanceof Error ? err.message : err
        );
      }
    }

    if (
      session?.mode === "supabase" &&
      isSupabaseConfigured() &&
      variations[0]?.headline
    ) {
      try {
        const supabase = await createClient();
        await recordPostActivity(supabase, session.user.id, {
          topic: userText,
          win:
            postType === "milestone" || postType === "client_satisfaction"
              ? userText
              : null,
          postType,
          businessName: body.businessName || null,
          category: category || null,
        });
      } catch (err) {
        console.warn(
          "[api/generate-post] marketing profile soft-fail",
          err instanceof Error ? err.message : err
        );
      }
    }

    return NextResponse.json(
      variationPayload(variations, {
        category,
        postType,
        chat_reply: chatReply,
        providerUsed,
      })
    );
  } catch (err) {
    console.error(
      "[api/generate-post] unexpected",
      err instanceof Error ? err.message : err
    );
    if (userText) {
      const single = singleGroundedVariation({
        userText,
        category,
        city,
        goal,
        postType,
      });
      return NextResponse.json(
        variationPayload(single.variations, {
          category,
          postType,
          chat_reply: single.chat_reply,
          providerUsed: "fallback:grounded-unexpected",
          soft_message: "יצרתי טיוטה מהטקסט שלכם — אפשר להמשיך לערוך.",
        })
      );
    }
    return NextResponse.json({
      ok: false,
      error: "חלה שגיאה בייצור, אנא נסה שנית",
    });
  }
}
