/**
 * Visual Art Director + direct FAL.ai fal-ai/flux/schnell.
 * No circuit breaker, no Niche Lock prompt blocks, no static placeholder success.
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import {
  generateImage,
  IMAGE_HARD_TIMEOUT_MS,
  type ImageServiceError,
} from "@/lib/ai/image-service";
import { translateToFalEnglishPrompt } from "@/lib/ai/translate-visual-prompt";
import {
  hasHebrewScript,
  type FalVisualPurpose,
} from "@/lib/ai/fal-visual-prompt";
import {
  disambiguateBusinessDomain,
  enrichBrandDnaFromDomain,
} from "@/lib/ai/hebrew-disambiguation";
import { expandBrandDnaDefaults } from "../../../../schemas/agent";
import {
  legacyNicheFromCategory,
  normalizeCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import {
  extractDishFromText,
  resolveDishBiasedPrompt,
} from "@/lib/ai/dish-prompt";
import {
  extractTradeFromText,
  resolveTradeBiasedPrompt,
} from "@/lib/ai/trade-prompt";
import {
  resolveCreativeStudioLock,
  resolveLocksmithLock,
} from "@/lib/ai/hebrew-visual-context";
import {
  buildAnchorFluxPrompts,
  resolveEnglishImageAnchors,
  trimImageAnchorWords,
} from "@/lib/ai/image-anchor-prompt";
import { withRegenAngleHint } from "@/lib/olar/image-cache-bust";
import { withTimeout } from "@/lib/ai/with-timeout";
import { randomFalSeed } from "@/lib/ai/types";

export const runtime = "nodejs";
/** Allow full FAL subscribe budget (~45s) + Art Director. */
export const maxDuration = 60;

function okPayload(data: Record<string, unknown>) {
  return {
    ok: true as const,
    fallback: false,
    isFallback: false,
    ...data,
  };
}

function errorStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: number }).status;
    if (typeof s === "number" && s >= 400 && s < 600) return s;
  }
  const code = (err as ImageServiceError | undefined)?.code;
  if (code === "FAL_MISSING_KEY" || code === "KEYS_MISSING") return 503;
  if (code === "FAL_TIMEOUT") return 504;
  if (code === "IMAGE_ALL_FAILED" || code === "FAL_FAILED" || code === "FAL_EMPTY")
    return 502;
  if (err instanceof Error && /timed out/i.test(err.message)) return 504;
  return 502;
}

function errorJson(err: unknown, englishPrompt?: string, source?: string) {
  const message =
    err instanceof Error ? err.message : "Image generation failed";
  const userMessageHe =
    (err as ImageServiceError | undefined)?.userMessageHe ||
    "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב.";
  const code = (err as ImageServiceError | undefined)?.code || "IMAGE_FAILED";
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      userMessageHe,
      english_prompt: englishPrompt,
      prompt_source: source,
    },
    { status: errorStatus(err) }
  );
}

export async function POST(request: Request) {
  let englishPrompt =
    "Brightly lit modern local business interior, professional commercial photography, crisp focus, no text";
  let source: string = "template";
  let category: BusinessCategoryId | null = null;

  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      description?: string;
      niche?: string;
      category?: string;
      businessName?: string;
      purpose?: FalVisualPurpose;
      aspectRatio?: "1:1" | "4:5" | "16:9";
      seed?: number;
      bustCache?: number | string | boolean;
      regenerate?: boolean;
      previousPrompt?: string;
      /** Optional 3–4 visual words — image subject only. */
      imageAnchorWords?: string | null;
    };

    const description = (body.description || body.prompt || "").trim();
    const imageAnchorWords = trimImageAnchorWords(body.imageAnchorWords);
    category = normalizeCategory(body.category) || normalizeCategory(body.niche);
    const forceRegen = Boolean(
      body.bustCache || body.regenerate || body.seed != null
    );
    // Always a real seed — regenerates + first paint get fresh latents
    const clientSeed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(Math.abs(body.seed)) % 2147483647
        : randomFalSeed();

    const purpose: FalVisualPurpose =
      body.purpose ||
      (body.aspectRatio === "1:1" ? "headshot" : "post");

    const lockedNiche = category
      ? legacyNicheFromCategory(category)
      : null;

    const domainHit = disambiguateBusinessDomain({
      text: description,
      niche: lockedNiche || body.niche,
      businessType: lockedNiche || body.niche,
    });
    const niche =
      lockedNiche ||
      body.niche ||
      domainHit?.domain.nicheId ||
      domainHit?.domain.englishDomain ||
      null;
    const brandDna = expandBrandDnaDefaults(
      enrichBrandDnaFromDomain({
        business_type: niche || domainHit?.domain.englishDomain || "local business",
      }) ?? { business_type: niche || "local business" }
    );

    // Optional user anchors win as FLUX subject (image-only; never Hebrew headline)
    const dishHit = extractDishFromText(description);
    let tradeHit: ReturnType<typeof extractTradeFromText> = null;

    if (imageAnchorWords) {
      const englishAnchors = await resolveEnglishImageAnchors(imageAnchorWords, {
        niche,
        businessName: body.businessName,
        category,
      });
      const subject = englishAnchors || imageAnchorWords;
      englishPrompt = buildAnchorFluxPrompts(subject, {
        userText: description,
        niche,
        category,
        businessName: body.businessName,
      }).promptA;
      source = "image-anchors";
      console.log("[api/generate-image] Image anchors active", {
        sample: englishPrompt.slice(0, 120),
        translated: Boolean(englishAnchors && englishAnchors !== imageAnchorWords),
        hebrewRemaining: hasHebrewScript(subject),
      });
    } else {
      // Subject bias helpers (prompt shaping only — never block FAL)
      const dishForced = resolveDishBiasedPrompt({
        description,
        niche,
        category,
      });
      const locksmithForced = resolveLocksmithLock({
        description,
        niche,
        category,
        businessName: body.businessName,
      });
      const creativeForced = locksmithForced
        ? null
        : resolveCreativeStudioLock({
            description,
            niche,
            category,
            businessName: body.businessName,
          });
      const tradeForced =
        locksmithForced || creativeForced
          ? null
          : resolveTradeBiasedPrompt({
              description,
              niche,
              category,
              businessName: body.businessName,
            });
      tradeHit = tradeForced
        ? extractTradeFromText(
            [description, niche, category].filter(Boolean).join(" ")
          )
        : null;

      if (dishForced) {
        englishPrompt = dishForced;
        source = `dish-lock:${dishHit?.id || "food"}`;
      } else if (locksmithForced) {
        englishPrompt = locksmithForced;
        source = "locksmith-door-lock";
      } else if (creativeForced) {
        englishPrompt = creativeForced;
        source = "creative-studio-lock";
      } else if (tradeForced) {
        englishPrompt = tradeForced;
        source = `trade-lock:${tradeHit?.id || "trade"}`;
      } else {
        const translated = await translateToFalEnglishPrompt({
          description:
            description ||
            domainHit?.domain.positiveVisual ||
            "local small business commercial photography bright workshop",
          niche,
          businessName: body.businessName,
          purpose,
          category,
          allowedVisualStyle:
            brandDna?.allowed_visual_style || domainHit?.domain.positiveVisual,
        });
        englishPrompt = translated.prompt;
        source = translated.source;
      }
    }

    // Regenerate: nudge camera angle so Flux cannot return the same latent
    if (forceRegen) {
      englishPrompt = withRegenAngleHint(englishPrompt);
      source = `${source}+regen-angle`;
    }

    console.log("[api/generate-image] Art Director ready → direct FAL", {
      source,
      category,
      seed: clientSeed,
      purpose,
      hasFalKey: Boolean(process.env.FAL_KEY?.trim()),
      sample: englishPrompt.slice(0, 160),
    });

    try {
      const image = await withTimeout(
        generateImage({
          prompt: englishPrompt,
          aspectRatio:
            body.aspectRatio ?? (purpose === "headshot" ? "1:1" : "16:9"),
          niche,
          category,
          businessName: body.businessName,
          brandDna,
          purpose: purpose === "headshot" ? "headshot" : "post",
          userContext: description || null,
          previousPrompt: body.previousPrompt || null,
          englishReady: !hasHebrewScript(englishPrompt),
          seed: clientSeed,
        }),
        IMAGE_HARD_TIMEOUT_MS,
        "direct FAL route"
      );

      if (
        !image.url ||
        image.url.startsWith("data:image/svg") ||
        image.provider === "static-fallback"
      ) {
        console.error("[api/generate-image] invalid/placeholder image rejected");
        return errorJson(
          new Error("Image provider returned placeholder or empty URL"),
          englishPrompt,
          source
        );
      }

      const provider = image.provider || "fal";
      const rawUrl = image.url;
      const imageUrl = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${Date.now()}&seed=${image.seed ?? clientSeed}`;
      return NextResponse.json(
        okPayload({
          image: {
            url: imageUrl,
            seed: image.seed ?? clientSeed ?? 0,
            prompt: image.prompt,
            provider,
          },
          imageUrl,
          provider,
          english_prompt: englishPrompt,
          prompt_source: source,
          category,
        })
      );
    } catch (err) {
      console.error(
        "[api/generate-image] FAL failed",
        err instanceof Error ? err.message : err
      );
      return errorJson(err, englishPrompt, source);
    }
  } catch (err) {
    console.error(
      "[api/generate-image] route error",
      err instanceof Error ? err.message : err
    );
    return errorJson(err, englishPrompt, source);
  }
}
