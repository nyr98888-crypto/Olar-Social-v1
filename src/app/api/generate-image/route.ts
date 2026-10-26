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
import { withTimeout } from "@/lib/ai/with-timeout";

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
  userText?: string | null
) {
  const url = getCategoryFallback(category, userText);
  console.log("[Image Gen] 🛡️ Serving curated category/dish fallback", {
    category,
    dish: extractDishFromText(userText || "")?.id ?? null,
  });
  return okPayload(
    {
      image: {
        url,
        seed: 0,
        prompt: englishPrompt,
        provider: "static-fallback",
      },
      imageUrl: url,
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
    };

    const description = (body.description || body.prompt || "").trim();
    category = normalizeCategory(body.category) || normalizeCategory(body.niche);
    const clientSeed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(Math.abs(body.seed)) % 10_000_000
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

    // Hard dish lock BEFORE Art Director — never let salad/generic food win for ג'חנון
    const dishForced = resolveDishBiasedPrompt({
      description,
      niche,
      category,
    });
    const dishHit = extractDishFromText(description);

    if (dishForced) {
      englishPrompt = dishForced;
      source = `dish-lock:${dishHit?.id || "food"}`;
      console.log("[api/generate-image] Dish lock active", {
        dish: dishHit?.id,
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

    console.log("[api/generate-image] Art Director ready", {
      source,
      category,
      lockedCategory: category,
      domainId: domainHit?.domain.id ?? null,
      dish: dishHit?.id ?? null,
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
            description
          )
        );
      }

      const provider = image.provider || "fal";
      return NextResponse.json(
        okPayload(
          {
            image: {
              url: image.url,
              seed: image.seed,
              prompt: image.prompt,
              provider,
            },
            imageUrl: image.url,
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
        unsplashFallbackPayload(category, englishPrompt, source, description)
      );
    }
  } catch (err) {
    console.error(
      "[api/generate-image] route error → Unsplash",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      unsplashFallbackPayload(category, englishPrompt, source)
    );
  }
}
