/**
 * Visual Art Director pipeline:
 * 1) LLM Art Director (Hebrew/any → English FLUX prompt)
 * 2) Safety regex guardrail
 * 3) FAL flux/schnell landscape_4_3 + random seed
 * Soft success — never crash UI; never send Hebrew to FAL.
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import {
  generateImage,
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

export const runtime = "nodejs";
export const maxDuration = 60;

function okPayload(data: Record<string, unknown>, fallback = false) {
  return {
    ok: true as const,
    fallback,
    soft_message: FALLBACK_SOFT_READY_HE,
    ...data,
  };
}

export async function POST(request: Request) {
  let englishPrompt =
    "Brightly lit modern auto workshop, spotless epoxy floor, gleaming car on hydraulic lift, mechanic inspecting brakes, bright daytime commercial photography, crisp focus, no text";
  let source: string = "template";

  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      description?: string;
      niche?: string;
      businessName?: string;
      purpose?: FalVisualPurpose;
      aspectRatio?: "1:1" | "4:5" | "16:9";
    };

    const description = (body.description || body.prompt || "").trim();

    const purpose: FalVisualPurpose =
      body.purpose ||
      (body.aspectRatio === "1:1" ? "headshot" : "post");

    // Semantic domain cross-check BEFORE Art Director / FAL
    const domainHit = disambiguateBusinessDomain({
      text: description,
      niche: body.niche,
      businessType: body.niche,
    });
    const niche =
      body.niche ||
      domainHit?.domain.nicheId ||
      domainHit?.domain.englishDomain ||
      null;
    const brandDna = expandBrandDnaDefaults(
      enrichBrandDnaFromDomain({
        business_type: niche || domainHit?.domain.englishDomain || "local business",
      }) ?? { business_type: niche || "local business" }
    );

    // Step 1+2: Art Director LLM → domain guardrail (never literal Hebrew)
    const translated = await translateToFalEnglishPrompt({
      description:
        description ||
        domainHit?.domain.positiveVisual ||
        "local small business commercial photography bright workshop",
      niche,
      businessName: body.businessName,
      purpose,
      allowedVisualStyle:
        brandDna?.allowed_visual_style || domainHit?.domain.positiveVisual,
    });
    englishPrompt = translated.prompt;
    source = translated.source;

    console.log("[api/generate-image] Art Director ready", {
      source,
      category: translated.category,
      domainId: translated.domainId ?? domainHit?.domain.id ?? null,
      purpose,
      sample: englishPrompt.slice(0, 160),
    });

    try {
      // Step 3: FAL — pass englishReady so we do not re-run Art Director
      const image = await generateImage({
        prompt: englishPrompt,
        aspectRatio:
          body.aspectRatio ?? (purpose === "headshot" ? "1:1" : "16:9"),
        niche,
        businessName: body.businessName,
        brandDna,
        purpose: purpose === "headshot" ? "headshot" : "post",
        userContext: description || null,
        fallbackPlaceholder: true,
        englishReady: true,
      });

      const isPlaceholder =
        !image.url ||
        image.url.startsWith("data:image/svg") ||
        image.url === IMAGE_PLACEHOLDER_DATA_URI;

      return NextResponse.json(
        okPayload(
          {
            image: {
              url: image.url,
              seed: image.seed,
              prompt: image.prompt,
            },
            english_prompt: englishPrompt,
            prompt_source: source,
            category: translated.category,
          },
          isPlaceholder
        )
      );
    } catch (err) {
      console.error(
        "[api/generate-image] FAL soft fail",
        err instanceof Error ? err.message : err
      );
      return NextResponse.json(
        okPayload(
          {
            image: {
              url: IMAGE_PLACEHOLDER_DATA_URI,
              seed: 0,
              prompt: englishPrompt,
            },
            english_prompt: englishPrompt,
            prompt_source: source,
          },
          true
        )
      );
    }
  } catch (err) {
    console.error(
      "[api/generate-image] route error",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      okPayload(
        {
          image: {
            url: IMAGE_PLACEHOLDER_DATA_URI,
            seed: 0,
            prompt: englishPrompt,
          },
          english_prompt: englishPrompt,
          prompt_source: source,
        },
        true
      )
    );
  }
}
