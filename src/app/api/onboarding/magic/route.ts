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
import type { AgentOutput } from "../../../../../schemas/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAGIC_SYSTEM = `You are Yona, a Hebrew marketing agent for Israeli local businesses.
Return ONLY valid JSON matching AgentOutputSchema:
- chat_reply: short Hebrew (first person female)
- intent: "campaign_request"
- social_post: {
    headline, body, hashtags,
    call_to_action (Hebrew),
    has_explicit_price (boolean — true ONLY if user wrote a numeric price)
  }
- image_task: { generate_image: false, aspect_ratio: "1:1", prompt: English visual brief }

## HARD NEGATIVE RULES
- NEVER invent numeric prices (150 ₪, 350 ₪, 99 ₪, etc.) unless the user explicitly provided that price.
- If no price: has_explicit_price=false; CTA only like "לתיאום והצעת מחיר בוואטסאפ", "פרטים והזמנות בהודעה", "שאל אותנו בוואטסאפ".
- NEVER invent specific technical services the user did not state (no "החלפת שמן גיר" / "חומצה הילרונית" from vague niches).
- Ground facts ONLY in the user business description. Image prompt English only; generate_image false for onboarding magic.`;

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
      input?: string;
      businessName?: string;
      city?: string;
      phone?: string;
      whatsapp?: string;
    };
    const raw =
      body.input?.trim() ||
      [body.businessName, body.city].filter(Boolean).join(" ") ||
      "";

    if (!raw) {
      const output = buildNicheFallbackOutput({
        rawInput: "עסק מקומי",
        businessName: body.businessName,
        city: body.city,
        phone: body.phone,
        whatsappDigits: body.whatsapp,
      });
      return softMagic(output, true, raw);
    }

    try {
      const { output, providerUsed, fallback } = await generateStructuredText(
        MAGIC_SYSTEM,
        [
          {
            role: "user",
            content: `Business / onboarding input (Hebrew OK):\n${raw}\n\nCreate a first social post + short chat_reply welcoming them.`,
          },
        ],
        {
          rawPrompt: raw,
          businessName: body.businessName,
          city: body.city,
          phone: body.phone,
          whatsapp: body.whatsapp,
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
        },
        null
      );
      console.log("[api/onboarding/magic] provider", providerUsed);
      return softMagic(clean, Boolean(fallback), raw, providerUsed);
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
      });
      return softMagic(output, true, raw);
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
  providerUsed = "fallback:golden-template"
) {
  const parsed = parseBizFromRaw(raw);
  const niche = detectFallbackNiche(raw);
  const post = output.social_post;
  return NextResponse.json({
    ok: true,
    fallback,
    soft_message: FALLBACK_SOFT_READY_HE,
    providerUsed,
    profile: {
      businessName: parsed.businessName,
      city: parsed.city,
      niche,
      tagline:
        post?.headline ||
        "שירות מקומי שאפשר לסמוך עליו",
      description:
        post?.body?.split("\n")[0] ||
        "עסק מקומי עם יחס אישי וזמינות בוואטסאפ.",
      firstPost: {
        headline: post?.headline || "השבוע פתחנו מקומות אחרונים",
        body:
          post?.body ||
          "כתבו בוואטסאפ ונחזור אליכם במהירות.",
        cta:
          post?.call_to_action ||
          "לתיאום והצעת מחיר בוואטסאפ",
        hashtags: post?.hashtags ?? ["#עסקמקומי"],
      },
    },
    output,
  });
}
