/**
 * Structured first-post generation — clean LLM payload isolation.
 * Request: { userText, category?, city?, goal? }
 * Response: { ok, headline, bodyText, ctaButton, imagePrompt, category }
 * On LLM timeout/fail: grounded fallback from userText (never empty error to UI).
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
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
import { buildGroundedPostFallback } from "@/lib/olar/grounded-post-fallback";
import {
  disambiguateBusinessDomain,
  HEBREW_COMPOUND_NOUN_RULE_HE,
  buildDisambiguationSystemBlock,
} from "@/lib/ai/hebrew-disambiguation";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystem(category: BusinessCategoryId | null, raw: string): string {
  const lockedNiche = category ? legacyNicheFromCategory(category) : undefined;
  const domain =
    disambiguateBusinessDomain({
      text: raw,
      niche: lockedNiche || raw,
    })?.domain ?? null;
  const categoryLock = category
    ? `\n\n${buildCategoryLockSystemBlock(category)}\n`
    : "";

  return `You are Yona, a Hebrew marketing agent for Israeli local businesses.
Return ONLY valid JSON matching AgentOutputSchema:
- chat_reply: short Hebrew (first person female)
- intent: "campaign_request"
- social_post: { headline, body, hashtags, call_to_action, has_explicit_price }
- image_task: { generate_image: false, aspect_ratio: "1:1", prompt: Detailed English visual brief for FLUX }
${categoryLock}
## Hebrew Semantic Disambiguation
${HEBREW_COMPOUND_NOUN_RULE_HE}
${buildDisambiguationSystemBlock(domain)}

HARD RULES:
- Ground EVERY fact ONLY in the userText. Never invent prices, services, or dishes the user did not mention.
- If user mentions a specific dish (e.g. ג'חנון), the English image prompt MUST feature that dish.
- NEVER invent numeric prices unless user wrote them.
- chat_reply and social_post in Hebrew; image_task.prompt in English only.
- If userText is too vague, still write a short grounded draft from their words only — do NOT use generic clinic/garage filler.`;
}

function okFromDraft(
  draft: ReturnType<typeof buildGroundedPostFallback>,
  meta: { providerUsed: string; soft?: string; chat_reply?: string }
) {
  return NextResponse.json({
    ok: true,
    headline: draft.headline,
    bodyText: draft.bodyText,
    ctaButton: draft.ctaButton,
    imagePrompt: draft.imagePrompt,
    hashtags: draft.hashtags,
    category: draft.category,
    chat_reply:
      meta.chat_reply ||
      `הנה הפוסט והתמונה שהכנתי עבור ${draft.headline}!`,
    providerUsed: meta.providerUsed,
    soft_message:
      meta.soft || "הפוסט מוכן — אפשר לערוך ולשפר כרצונכם.",
  });
}

export async function POST(request: Request) {
  let userText = "";
  let category: BusinessCategoryId | null = null;
  let city = "";
  let goal: string | null = null;

  try {
    const session = await getAppSession();
    if (!session) {
      // Soft guest session should exist via middleware — still allow grounded draft
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
    };

    userText = stripCategoryLeak(
      (body.userText || body.input || body.prompt || "").trim()
    );
    category = normalizeCategory(body.category);
    city = (body.city || "").trim();
    goal = body.goal?.trim() || null;

    if (!userText) {
      return NextResponse.json({
        ok: false,
        error: "חסר טקסט מהמשתמש — כתבו תיאור קצר של העסק.",
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
    console.log("[api/generate-post] keys", {
      hasOpenRouter,
      hasGroq,
      hasGemini,
      category,
      timeoutMs: GENERATE_POST_TIMEOUT_MS,
      userSample: userText.slice(0, 80),
    });

    if (!hasOpenRouter && !hasGroq && !hasGemini) {
      console.warn(
        "[api/generate-post] no LLM keys — grounded fallback immediately"
      );
      return okFromDraft(
        buildGroundedPostFallback({ userText, category, city, goal }),
        {
          providerUsed: "fallback:grounded-user-text",
          soft: "יצרתי טיוטה מהטקסט שלכם (מצב גיבוי) — אפשר לערוך.",
        }
      );
    }

    try {
      const { output, fallback, providerUsed } = await generateStructuredText(
        buildSystem(category, userText),
        [{ role: "user", content: userText }],
        {
          rawPrompt: userText,
          businessName: body.businessName,
          city: city || undefined,
          niche: lockedNiche,
          timeoutMs: GENERATE_POST_TIMEOUT_MS,
        }
      );

      const post = output.social_post;
      const headline = stripCategoryLeak(post?.headline || "").trim();
      const bodyText = stripCategoryLeak(post?.body || "").trim();
      const ctaButton = stripCategoryLeak(post?.call_to_action || "").trim();
      const imagePrompt = (output.image_task?.prompt || "").trim();

      if (!headline || !bodyText) {
        console.warn(
          "[api/generate-post] empty LLM fields → grounded user draft",
          { providerUsed, fallback }
        );
        const draft = buildGroundedPostFallback({
          userText,
          category,
          city,
          goal,
        });
        if (
          imagePrompt &&
          /jachnun|food|pastry|dish|bakery|cuisine/i.test(imagePrompt)
        ) {
          draft.imagePrompt = imagePrompt;
        }
        return okFromDraft(draft, {
          providerUsed: `fallback:grounded-after:${providerUsed}`,
          soft: "יצרתי טיוטה מהטקסט שלכם — אפשר לערוך ולשפר.",
        });
      }

      return NextResponse.json({
        ok: true,
        headline,
        bodyText,
        ctaButton: ctaButton || "לתיאום והצעת מחיר בוואטסאפ",
        imagePrompt:
          imagePrompt ||
          buildGroundedPostFallback({ userText, category, city, goal })
            .imagePrompt,
        hashtags: post?.hashtags || [],
        chat_reply: output.chat_reply,
        category,
        providerUsed,
        soft_message: "הפוסט מוכן — אפשר לערוך ולשפר כרצונכם.",
      });
    } catch (err) {
      console.error(
        "[api/generate-post] LLM failed → grounded fallback",
        err instanceof Error ? err.message : err
      );
      return okFromDraft(
        buildGroundedPostFallback({ userText, category, city, goal }),
        {
          providerUsed: "fallback:grounded-on-error",
          soft: "יצרתי טיוטה מהטקסט שלכם (גיבוי) — אפשר לערוך.",
        }
      );
    }
  } catch (err) {
    console.error(
      "[api/generate-post] unexpected",
      err instanceof Error ? err.message : err
    );
    if (userText) {
      return okFromDraft(
        buildGroundedPostFallback({ userText, category, city, goal }),
        {
          providerUsed: "fallback:grounded-unexpected",
          soft: "יצרתי טיוטה מהטקסט שלכם — אפשר לערוך.",
        }
      );
    }
    return NextResponse.json({
      ok: false,
      error: "חלה שגיאה בייצור, אנא נסה שנית",
    });
  }
}
