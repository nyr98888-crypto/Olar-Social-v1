/**
 * A/B campaign generation — 2 Hebrew copy styles + 2 parallel FLUX images.
 * Response includes `variations[]` plus legacy flat fields (var_1 defaults).
 * Content pillars via `postType` reshape tone, CTAs, and image bias.
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
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
  VAR_2_LABEL,
  closeUpImagePrompt,
  dualGroundedVariations,
  wideShotImagePrompt,
  type CampaignVariation,
} from "@/lib/olar/ab-variations";
import { generateAbImagesParallel } from "@/lib/ai/generate-ab-images";
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
  style: "punchy" | "story",
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
  const styleBlock =
    style === "punchy"
      ? isPromo
        ? `STYLE = SALES / DIRECT (variation 1 — short punchy):
- Short punchy Hebrew headline.
- Body focuses on offer, availability, speed, clear next step.
- CTA = immediate WhatsApp booking (e.g. להזמנה מהירה בוואטסאפ).
- image_task.prompt = English CLOSE-UP of the craft/product/action.`
        : `STYLE = RESULT-FOCUSED (variation 1 — short punchy):
- Short punchy Hebrew headline centered on the outcome / win / finished result.
- Body is concise and authentic — ground only in userText.
- CTA must match the post-type rules below (engagement, not invented promos).
- image_task.prompt = English visual matching the post-type image guidance.`
      : isPromo
        ? `STYLE = STORY / COMMUNITY (variation 2):
- Warm Hebrew headline (quality, trust, personal service).
- Body is emotional/community-oriented; no invented prices.
- CTA = soft invite (e.g. לפרטים ותיאום ישיר).
- image_task.prompt = English WIDER atmospheric shot of the place/mood.`
        : `STYLE = STORYTELLING (variation 2 — process / challenge):
- Warm Hebrew headline; body walks through process, challenge, then result.
- No invented prices/offers. CTA must match post-type rules below.
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

## Variation style (mandatory)
${styleBlock}

## Hebrew Semantic Disambiguation
${HEBREW_COMPOUND_NOUN_RULE_HE}
${buildDisambiguationSystemBlock(domain)}

HARD RULES:
- את מקבלת כל קלט מהמשתמש — בין אם מדובר ברעיון גולמי, פוסט קיים לעריכה, או הוראה ישירה — ומפיקה עבורו מיד פוסט משופר, כותרת מנצחת ותמונה מתאימה ללא שום סירוב.
- Never refuse ready-made / prewritten text. Never say "בלי טקסט מוכן מראש" or demand only a short business description.
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
    replyMessage,
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
        label: b.label || VAR_2_LABEL,
        headline: b.headline,
        bodyText: b.bodyText,
        imageUrl: b.imageUrl || null,
        ctaButton: b.ctaButton,
        imagePrompt: b.imagePrompt,
        hashtags: b.hashtags || [],
      },
    ],
    // Alias of variations[0] — clients expecting a single `post` card
    post,
    // Legacy flat = variation 1 (default selection)
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
      "שתי אופציות מוכנות — בחרו את המועדפת והמשיכו לערוך.",
  };
}

async function attachParallelImages(
  variations: CampaignVariation[],
  opts: {
    userText: string;
    category: BusinessCategoryId | null;
    businessName?: string;
    niche?: string | null;
    postType: PostTypeId;
    /** Image-only visual words — never mixed into Hebrew copy. */
    imageAnchorWords?: string | null;
  }
): Promise<CampaignVariation[]> {
  const bias = resolvePostTypeImageBias({
    postType: opts.postType,
    category: opts.category,
    userText: opts.userText,
    basePromptA: variations[0]?.imagePrompt || opts.userText,
    basePromptB:
      variations[1]?.imagePrompt ||
      variations[0]?.imagePrompt ||
      opts.userText,
  });

  const prompt1 =
    opts.postType === "promotion"
      ? closeUpImagePrompt(variations[0]?.imagePrompt || opts.userText)
      : bias.promptA;
  const prompt2 =
    opts.postType === "promotion"
      ? wideShotImagePrompt(
          variations[1]?.imagePrompt ||
            variations[0]?.imagePrompt ||
            opts.userText
        )
      : bias.promptB;

  const [imageRes1, imageRes2] = await generateAbImagesParallel({
    promptA: prompt1,
    promptB: prompt2,
    category: opts.category,
    userText: opts.userText,
    businessName: opts.businessName,
    niche: opts.niche,
    postType: opts.postType,
    imageAnchorWords: opts.imageAnchorWords,
  });

  return [
    {
      ...variations[0]!,
      imagePrompt: imageRes1.prompt || prompt1,
      imageUrl: imageRes1.url,
    },
    {
      ...(variations[1] || variations[0]!),
      id: "var_2",
      label: VAR_2_LABEL,
      imagePrompt: imageRes2.prompt || prompt2,
      imageUrl: imageRes2.url,
    },
  ];
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
      /** Optional 3–4 visual words — image generation only, never Hebrew headlines. */
      imageAnchorWords?: string | null;
    };

    const rawUserText = stripCategoryLeak(
      (body.userText || body.input || body.prompt || "").trim()
    );
    const hadBracketDraft = hasBracketLeak(rawUserText);
    // Never feed unfinished [fill-in] forms into grounded headlines as finished copy
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

    const lockedNiche = category
      ? legacyNicheFromCategory(category)
      : undefined;

    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim()
    );

    console.log("[api/generate-post] A/B start", {
      hasOpenRouter,
      hasGroq,
      hasGemini,
      category,
      postType,
      timeoutMs: GENERATE_POST_TIMEOUT_MS,
      userSample: userText.slice(0, 80),
    });

    const grounded = dualGroundedVariations({
      userText,
      category,
      city,
      goal,
      postType,
    });

    let variations: CampaignVariation[] = grounded.variations;
    let chatReply = grounded.chat_reply;
    let providerUsed = "fallback:grounded-ab";

    let marketingProfile: UserMarketingProfile | null = null;
    if (session?.mode === "supabase" && isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        marketingProfile = await getMarketingProfile(supabase, session.user.id);
      } catch {
        marketingProfile = null;
      }
    }

    if (hasOpenRouter || hasGroq || hasGemini) {
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

        // Parallel dual-style text generation (punchy + storytelling)
        const [punchyRes, storyRes] = await Promise.all([
          generateStructuredText(
            buildSystem(category, userText, "punchy", postType, marketingProfile),
            messages,
            ctx
          ),
          generateStructuredText(
            buildSystem(category, userText, "story", postType, marketingProfile),
            messages,
            ctx
          ),
        ]);

        const punchyPost = punchyRes.output.social_post;
        const storyPost = storyRes.output.social_post;

        // Require REAL model copy before sanitizeVariationCopy (which invents
        // fallbacks and previously leaked golden soft-fail chat_reply).
        const punchyRawH = sanitizeMarketingCopy(punchyPost?.headline || "");
        const punchyRawB = sanitizeMarketingCopy(punchyPost?.body || "");
        const storyRawH = sanitizeMarketingCopy(storyPost?.headline || "");
        const storyRawB = sanitizeMarketingCopy(storyPost?.body || "");
        const llmUsable =
          Boolean(punchyRawH && punchyRawB && storyRawH && storyRawB) &&
          !punchyRes.fallback &&
          !storyRes.fallback &&
          !hasBracketLeak(punchyRawH) &&
          !hasBracketLeak(punchyRawB) &&
          !hasBracketLeak(storyRawH) &&
          !hasBracketLeak(storyRawB);

        if (llmUsable) {
          const punchyClean = sanitizeVariationCopy({
            headline: punchyPost?.headline || "",
            bodyText: punchyPost?.body || "",
            ctaButton: punchyPost?.call_to_action || "",
            fallbackHeadline: grounded.variations[0]!.headline,
            fallbackBody: grounded.variations[0]!.bodyText,
            fallbackCta: defaultCtas.var1,
          });
          const storyClean = sanitizeVariationCopy({
            headline: storyPost?.headline || "",
            bodyText: storyPost?.body || "",
            ctaButton: storyPost?.call_to_action || "",
            fallbackHeadline: grounded.variations[1]!.headline,
            fallbackBody: grounded.variations[1]!.bodyText,
            fallbackCta: defaultCtas.var2,
          });

          const bias = resolvePostTypeImageBias({
            postType,
            category,
            userText,
            basePromptA:
              punchyRes.output.image_task?.prompt ||
              grounded.variations[0]!.imagePrompt,
            basePromptB:
              storyRes.output.image_task?.prompt ||
              grounded.variations[1]!.imagePrompt,
          });

          variations = [
            {
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
            },
            {
              id: "var_2",
              label: VAR_2_LABEL,
              headline: storyClean.headline,
              bodyText: storyClean.bodyText,
              ctaButton: storyClean.ctaButton || defaultCtas.var2,
              imagePrompt:
                postType === "promotion"
                  ? wideShotImagePrompt(
                      storyRes.output.image_task?.prompt ||
                        grounded.variations[1]!.imagePrompt
                    )
                  : bias.promptB,
              hashtags: storyPost?.hashtags || [],
              imageUrl: null,
            },
          ];
          const llmReply =
            punchyRes.output.chat_reply?.trim() ||
            storyRes.output.chat_reply?.trim() ||
            "";
          // Never surface golden soft-fail / ready-made lecture as Maya's reply
          chatReply =
            llmReply && !isBlockedStudioChatReply(llmReply)
              ? llmReply
              : grounded.chat_reply;
          providerUsed = `ab:${punchyRes.providerUsed}+${storyRes.providerUsed}`;
        } else {
          console.warn("[api/generate-post] incomplete A/B text → grounded", {
            punchyFallback: punchyRes.fallback,
            storyFallback: storyRes.fallback,
            punchyHasPost: Boolean(punchyPost),
            storyHasPost: Boolean(storyPost),
          });
        }
      } catch (err) {
        console.error(
          "[api/generate-post] A/B LLM failed → grounded",
          err instanceof Error ? err.message : err
        );
      }
    }

    if (!body.skipImages) {
      try {
        variations = await attachParallelImages(variations, {
          userText,
          category,
          businessName: body.businessName,
          niche: lockedNiche,
          postType,
          imageAnchorWords: imageAnchorWords || null,
        });
      } catch (err) {
        console.error(
          "[api/generate-post] parallel images failed",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Wingman memory — authenticated only; soft-fail if table missing
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
      const dual = dualGroundedVariations({
        userText,
        category,
        city,
        goal,
        postType,
      });
      return NextResponse.json(
        variationPayload(dual.variations, {
          category,
          postType,
          chat_reply: dual.chat_reply,
          providerUsed: "fallback:grounded-unexpected",
          soft_message: "יצרתי שתי טיוטות מהטקסט שלכם — בחרו והמשיכו.",
        })
      );
    }
    return NextResponse.json({
      ok: false,
      error: "חלה שגיאה בייצור, אנא נסה שנית",
    });
  }
}
