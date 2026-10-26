import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { generateStructuredText } from "@/lib/ai/text-service";
import {
  buildNicheFallbackOutput,
  FALLBACK_SOFT_READY_HE,
  parseBizFromRaw,
  detectFallbackNiche,
  sanitizeOrGolden,
} from "@/lib/ai/fallback-content";
import {
  buildDisambiguationSystemBlock,
  disambiguateBusinessDomain,
  HEBREW_COMPOUND_NOUN_RULE_HE,
} from "@/lib/ai/hebrew-disambiguation";
import {
  buildCategoryLockSystemBlock,
  legacyNicheFromCategory,
  normalizeCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import type { AgentOutput } from "../../../../../schemas/agent";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildMagicSystem(
  raw: string,
  category: BusinessCategoryId | null
): string {
  const nicheHint = category
    ? legacyNicheFromCategory(category)
    : raw;
  const domain =
    disambiguateBusinessDomain({
      text: raw,
      niche: typeof nicheHint === "string" ? nicheHint : raw,
    })?.domain ?? null;
  const categoryLock = category
    ? `\n\n${buildCategoryLockSystemBlock(category)}\n`
    : "";

  return `You are Yona, a Hebrew marketing agent for Israeli local businesses.
Return ONLY valid JSON matching AgentOutputSchema:
- chat_reply: short Hebrew (first person female)
- intent: "campaign_request"
- social_post: {
    headline, body, hashtags,
    call_to_action (Hebrew),
    has_explicit_price (boolean — true ONLY if user wrote a numeric price)
  }
- image_task: { generate_image: false, aspect_ratio: "1:1", prompt: English visual brief }
${categoryLock}
## Hebrew Semantic Disambiguation (PERMANENT)
${HEBREW_COMPOUND_NOUN_RULE_HE}

${buildDisambiguationSystemBlock(domain)}

Never literal-translate ambiguous Hebrew without the verified domain. Image prompt English from verified domain only; bake avoid: negatives into the English brief.

## HARD NEGATIVE RULES
- NEVER invent numeric prices (150 ₪, 350 ₪, 99 ₪, etc.) unless the user explicitly provided that price.
- If no price: has_explicit_price=false; CTA only like "לתיאום והצעת מחיר בוואטסאפ", "פרטים והזמנות בהודעה", "שאל אותנו בוואטסאפ".
- NEVER invent specific technical services the user did not state (no "החלפת שמן גיר" / "חומצה הילרונית" from vague niches).
- Ground facts ONLY in the user business description. Image prompt English only; generate_image false for onboarding magic.`;
}

/**
 * Onboarding "תראה לי את הקסם" — OpenRouter hybrid + 4s/validate/golden pipeline.
 * Always returns soft success shape (ok: true); never raw provider errors.
 */
export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!session) {
      console.warn("[api/onboarding/magic] no session — soft template");
    }

    const body = (await request.json().catch(() => ({}))) as {
      userText?: string;
      input?: string;
      prompt?: string;
      businessName?: string;
      city?: string;
      phone?: string;
      whatsapp?: string;
      category?: string;
      goal?: string | null;
    };
    const category = normalizeCategory(body.category);
    // Clean user text ONLY — never accept glued [CATEGORY:…] from clients
    const raw = stripCategoryLeak(
      body.userText?.trim() ||
        body.input?.trim() ||
        body.prompt?.trim() ||
        [body.businessName, body.city].filter(Boolean).join(" ") ||
        ""
    );

    if (!raw) {
      const output = buildNicheFallbackOutput({
        rawInput: "עסק מקומי",
        businessName: body.businessName,
        city: body.city,
        phone: body.phone,
        whatsappDigits: body.whatsapp,
        niche: category ? legacyNicheFromCategory(category) : undefined,
      });
      return softMagic(output, true, raw, "fallback:golden-template", category);
    }

    try {
      const lockedNiche = category
        ? legacyNicheFromCategory(category)
        : undefined;
      const domainHit = disambiguateBusinessDomain({
        text: raw,
        niche: lockedNiche || raw,
      });
      // Category lock lives in SYSTEM (buildMagicSystem); user message = clean userText only
      const userMsg = [
        raw,
        body.goal ? `מטרת הפרסום: ${body.goal}` : "",
        body.city ? `עיר: ${body.city}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const { output, providerUsed, fallback } = await generateStructuredText(
        buildMagicSystem(raw, category),
        [{ role: "user", content: userMsg }],
        {
          rawPrompt: raw,
          businessName: body.businessName,
          city: body.city,
          phone: body.phone,
          whatsapp: body.whatsapp,
          niche: lockedNiche || domainHit?.domain.nicheId,
        }
      );
      const clean = sanitizeOrGolden(
        output,
        {
          rawInput: raw,
          businessName: body.businessName,
          city: body.city,
          phone: body.phone,
          whatsappDigits: body.whatsapp,
          niche: lockedNiche,
        },
        null
      );
      console.log("[api/onboarding/magic] provider", providerUsed, {
        category,
      });
      return softMagic(clean, Boolean(fallback), raw, providerUsed, category);
    } catch (err) {
      console.error(
        "[api/onboarding/magic] chain failed",
        err instanceof Error ? err.message : err
      );
      const output = buildNicheFallbackOutput({
        rawInput: raw,
        businessName: body.businessName,
        city: body.city,
        phone: body.phone,
        whatsappDigits: body.whatsapp,
        niche: category ? legacyNicheFromCategory(category) : undefined,
      });
      return softMagic(output, true, raw, "fallback:golden-template", category);
    }
  } catch (err) {
    console.error(
      "[api/onboarding/magic] unexpected",
      err instanceof Error ? err.message : err
    );
    const output = buildNicheFallbackOutput({});
    return softMagic(output, true, "");
  }
}

function softMagic(
  output: AgentOutput,
  fallback: boolean,
  raw: string,
  providerUsed = "fallback:golden-template",
  category: BusinessCategoryId | null = null
) {
  const parsed = parseBizFromRaw(raw);
  const lockedNiche = category
    ? legacyNicheFromCategory(category)
    : null;
  const domainHit = disambiguateBusinessDomain({
    text: raw,
    niche: lockedNiche || raw,
  });
  const niche =
    lockedNiche ||
    domainHit?.domain.nicheId ||
    detectFallbackNiche(raw);
  const post = output.social_post;
  const headline = stripCategoryLeak(post?.headline || "").trim();
  const bodyText = stripCategoryLeak(post?.body || "").trim();
  const empty = !headline || !bodyText;
  return NextResponse.json({
    ok: !empty,
    fallback: fallback || empty,
    soft_message: empty
      ? "חלה שגיאה בייצור, אנא נסה שנית"
      : FALLBACK_SOFT_READY_HE,
    providerUsed,
    category,
    profile: {
      businessName: parsed.businessName,
      city: parsed.city,
      niche,
      tagline: headline,
      description: bodyText.split("\n")[0] || "",
      firstPost: {
        headline,
        body: bodyText,
        cta: stripCategoryLeak(post?.call_to_action || "").trim(),
        hashtags: post?.hashtags ?? [],
      },
    },
    output,
  });
}
