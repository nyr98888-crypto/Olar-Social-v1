/**
 * Visual Art Director + image circuit-breaker:
 * 1) LLM Art Director (Hebrew/any → English FLUX prompt)
 * 2) Safety regex guardrail
 * 3) FAL flux/schnell (7s) → Together FLUX.1-schnell (8s) → Unsplash category
 * Soft success — never crash UI; never send Hebrew to Flux providers.
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import {
  generateImage,
  IMAGE_HARD_TIMEOUT_MS,
  IMAGE_PLACEHOLDER_DATA_URI,
} from "@/lib/ai/image-service";
import { translateToFalEnglishPrompt } from "@/lib/ai/translate-visual-prompt";
import type { FalVisualPurpose } from "@/lib/ai/fal-visual-prompt";
import { FALLBACK_SOFT_READY_HE } from "@/lib/ai/fallback-content";
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
import { getCategoryFallback } from "@/lib/olar/category-fallbacks";
import {
  extractDishFromText,
  resolveDishBiasedPrompt,
} from "@/lib/ai/dish-prompt";
import {
  extractTradeFromText,
  resolveTradeBiasedPrompt,
} from "@/lib/ai/trade-prompt";
import { resolveCreativeStudioLock } from "@/lib/ai/hebrew-visual-context";
import {
  buildAnchorFluxPrompts,
  resolveEnglishImageAnchors,
  trimImageAnchorWords,
} from "@/lib/ai/image-anchor-prompt";
import { withRegenAngleHint } from "@/lib/olar/image-cache-bust";
import { withTimeout } from "@/lib/ai/with-timeout";
import { randomFalSeed } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function okPayload(data: Record<string, unknown>, fallback = false) {
  return {
    ok: true as const,
    fallback,
    isFallback: fallback,
    soft_message: FALLBACK_SOFT_READY_HE,
    ...data,
  };
}

function unsplashFallbackPayload(
  category: BusinessCategoryId | null,
  englishPrompt: string,
  source: string,
  userText?: string | null,
  seed?: number
) {
  const pickSeed =
    typeof seed === "number" && Number.isFinite(seed)
      ? seed
      : Math.floor(Math.random() * 2147483647);
  const url = getCategoryFallback(category, userText, pickSeed);
  console.log("[Image Gen] 🛡️ Serving curated category/dish fallback", {
    category,
    dish: extractDishFromText(userText || "")?.id ?? null,
    seed: pickSeed,
  });
  const stamped = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}&s=${pickSeed}`;
  return okPayload(
    {
      image: {
        url: stamped,
        seed: pickSeed,
        prompt: englishPrompt,
        provider: "static-fallback",
      },
      imageUrl: stamped,
      provider: "static-fallback",
      english_prompt: englishPrompt,
      prompt_source: source,
      category,
      fallback_source: "unsplash",
    },
    true
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
    const clientSeed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(Math.abs(body.seed)) % 2147483647
        : forceRegen
          ? randomFalSeed()
          : undefined;

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
      englishPrompt = buildAnchorFluxPrompts(englishAnchors || imageAnchorWords, {
        userText: description,
        niche,
        category,
        businessName: body.businessName,
      }).promptA;
      source = "image-anchors";
      console.log("[api/generate-image] Image anchors active", {
        sample: englishPrompt.slice(0, 120),
      });
    } else {
      // Hard locks BEFORE Art Director — dish / creative-studio / body-shop
      // Creative studio MUST beat automotive "workshop" mistranslation of סדנה
      const dishForced = resolveDishBiasedPrompt({
        description,
        niche,
        category,
      });
      const creativeForced = resolveCreativeStudioLock({
        description,
        niche,
        category,
        businessName: body.businessName,
      });
      const tradeForced = creativeForced
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
        console.log("[api/generate-image] Dish lock active", {
          dish: dishHit?.id,
          sample: englishPrompt.slice(0, 120),
        });
      } else if (creativeForced) {
        englishPrompt = creativeForced;
        source = "creative-studio-lock";
        console.log("[api/generate-image] Creative studio lock active", {
          sample: englishPrompt.slice(0, 120),
        });
      } else if (tradeForced) {
        englishPrompt = tradeForced;
        source = `trade-lock:${tradeHit?.id || "trade"}`;
        console.log("[api/generate-image] Trade lock active", {
          trade: tradeHit?.id,
          sample: englishPrompt.slice(0, 120),
        });
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

    console.log("[api/generate-image] Art Director ready", {
      source,
      category,
      lockedCategory: category,
      domainId: domainHit?.domain.id ?? null,
      dish: dishHit?.id ?? null,
      trade: tradeHit?.id ?? null,
      seed: clientSeed ?? null,
      bustCache: body.bustCache ?? null,
      purpose,
      hasFalKey: Boolean(process.env.FAL_KEY?.trim()),
      hasTogetherKey: Boolean(process.env.TOGETHER_API_KEY?.trim()),
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
          fallbackPlaceholder: false,
          englishReady: true,
          seed: clientSeed,
        }),
        IMAGE_HARD_TIMEOUT_MS,
        "image circuit-breaker route"
      );

      const isPlaceholder =
        !image.url ||
        image.url.startsWith("data:image/svg") ||
        image.url === IMAGE_PLACEHOLDER_DATA_URI ||
        image.provider === "static-fallback";

      if (isPlaceholder) {
        return NextResponse.json(
          unsplashFallbackPayload(
            category,
            englishPrompt,
            source,
            description,
            clientSeed
          )
        );
      }

      const provider = image.provider || "fal";
      const rawUrl = image.url;
      const imageUrl = forceRegen
        ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${Date.now()}&seed=${image.seed ?? clientSeed ?? 0}`
        : rawUrl;
      return NextResponse.json(
        okPayload(
          {
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
          },
          false
        )
      );
    } catch (err) {
      console.error(
        "[api/generate-image] providers soft fail → Unsplash",
        err instanceof Error ? err.message : err
      );
      return NextResponse.json(
        unsplashFallbackPayload(
          category,
          englishPrompt,
          source,
          description,
          clientSeed
        )
      );
    }
  } catch (err) {
    console.error(
      "[api/generate-image] route error → Unsplash",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      unsplashFallbackPayload(category, englishPrompt, source, null, undefined)
    );
  }
}
