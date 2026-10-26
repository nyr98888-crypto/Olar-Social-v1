/**
 * Parallel A/B image generation — hard fail when providers fail.
 * Keyword dish/trade locks win over postType bias for subject accuracy.
 * Optional imageAnchorWords override subject when the user typed 2–4 visual words.
 */
import { generateImage, IMAGE_HARD_TIMEOUT_MS } from "@/lib/ai/image-service";
import { withTimeout } from "@/lib/ai/with-timeout";
import type { BusinessCategoryId } from "@/lib/olar/business-categories";
import { resolveDishBiasedPrompt } from "@/lib/ai/dish-prompt";
import { resolveTradeBiasedPrompt } from "@/lib/ai/trade-prompt";
import {
  resolveCreativeStudioLock,
  resolveLocksmithLock,
} from "@/lib/ai/hebrew-visual-context";
import { resolvePostTypeImageBias } from "@/lib/ai/resolve-post-type-image-bias";
import {
  buildAnchorFluxPrompts,
  resolveEnglishImageAnchors,
  trimImageAnchorWords,
} from "@/lib/ai/image-anchor-prompt";
import { hasHebrewScript } from "@/lib/ai/fal-visual-prompt";
import type { PostTypeId } from "@/lib/olar/post-types";

export async function generateImageWithFallback(opts: {
  prompt: string;
  seed: number;
  category?: BusinessCategoryId | null;
  userText?: string | null;
  businessName?: string | null;
  niche?: string | null;
  postType?: PostTypeId | null;
  /** When true, skip dish/creative/trade subject locks — prompt already has user anchors. */
  anchorDriven?: boolean;
}): Promise<{ url: string; seed: number; prompt: string; fallback: boolean }> {
  let englishPrompt: string;
  if (opts.anchorDriven) {
    englishPrompt = (opts.prompt || "").trim();
  } else {
    const dish = resolveDishBiasedPrompt({
      description: opts.userText || opts.prompt,
      category: opts.category,
      niche: opts.niche,
    });
    const locksmith = resolveLocksmithLock({
      description: opts.userText || opts.prompt,
      category: opts.category,
      niche: opts.niche,
      businessName: opts.businessName,
    });
    const creative = locksmith
      ? null
      : resolveCreativeStudioLock({
          description: opts.userText || opts.prompt,
          category: opts.category,
          niche: opts.niche,
          businessName: opts.businessName,
        });
    const trade =
      locksmith || creative
        ? null
        : resolveTradeBiasedPrompt({
            description: opts.userText || opts.prompt,
            category: opts.category,
            niche: opts.niche,
            businessName: opts.businessName,
          });
    // Keyword locks win; locksmith / creative-studio beat automotive workshop mistranslation
    englishPrompt = (dish || locksmith || creative || trade || opts.prompt).trim();
  }

  const image = await withTimeout(
    generateImage({
      prompt: englishPrompt,
      aspectRatio: "1:1",
      purpose: "post",
      category: opts.category,
      niche: opts.niche,
      businessName: opts.businessName,
      userContext: opts.userText || null,
      englishReady: true,
      seed: opts.seed,
    }),
    IMAGE_HARD_TIMEOUT_MS,
    "ab-image"
  );

  if (
    !image?.url ||
    image.url.startsWith("data:image/svg") ||
    image.provider === "static-fallback"
  ) {
    throw new Error("A/B image provider returned placeholder or empty URL");
  }

  const seed = image.seed ?? opts.seed;
  const stamped = `${image.url}${image.url.includes("?") ? "&" : "?"}t=${Date.now()}&s=${seed}`;
  return {
    url: stamped,
    seed,
    prompt: image.prompt || englishPrompt,
    fallback: false,
  };
}

export async function generateAbImagesParallel(opts: {
  promptA: string;
  promptB: string;
  category?: BusinessCategoryId | null;
  userText?: string | null;
  businessName?: string | null;
  niche?: string | null;
  postType?: PostTypeId | null;
  /** Optional 3–4 visual words — wins as FLUX subject when non-empty. */
  imageAnchorWords?: string | null;
}): Promise<
  [
    { url: string; seed: number; prompt: string; fallback: boolean },
    { url: string; seed: number; prompt: string; fallback: boolean },
  ]
> {
  const anchors = trimImageAnchorWords(opts.imageAnchorWords);
  let promptA: string;
  let promptB: string;
  let anchorDriven = false;

  if (anchors) {
    // User anchors win as subject; Hebrew → English before FLUX (skip workshop locks)
    const english = await resolveEnglishImageAnchors(anchors, {
      niche: opts.niche,
      businessName: opts.businessName,
      category: opts.category,
    });
    const subject = english || anchors;
    const built = buildAnchorFluxPrompts(subject, {
      userText: opts.userText,
      niche: opts.niche,
      category: opts.category,
      businessName: opts.businessName,
    });
    promptA = built.promptA;
    promptB = built.promptB;
    // Only treat as englishReady when subject no longer has Hebrew
    anchorDriven = !hasHebrewScript(subject);
    console.log("[ab-images] image anchors active", {
      sample: subject.slice(0, 80),
      translated: Boolean(english && english !== anchors),
      hebrewRemaining: hasHebrewScript(subject),
    });
  } else {
    const bias = resolvePostTypeImageBias({
      postType: opts.postType,
      category: opts.category,
      userText: opts.userText,
      basePromptA: opts.promptA,
      basePromptB: opts.promptB,
    });
    // Prefer dish/creative/trade keyword subject; otherwise apply postType dual prompts
    const dish = resolveDishBiasedPrompt({
      description: opts.userText || opts.promptA,
      category: opts.category,
      niche: opts.niche,
    });
    const locksmith = resolveLocksmithLock({
      description: opts.userText || opts.promptA,
      category: opts.category,
      niche: opts.niche,
      businessName: opts.businessName,
    });
    const creative = locksmith
      ? null
      : resolveCreativeStudioLock({
          description: opts.userText || opts.promptA,
          category: opts.category,
          niche: opts.niche,
          businessName: opts.businessName,
        });
    const trade =
      locksmith || creative
        ? null
        : resolveTradeBiasedPrompt({
            description: opts.userText || opts.promptA,
            category: opts.category,
            niche: opts.niche,
            businessName: opts.businessName,
          });
    const keywordLock = Boolean(dish || locksmith || creative || trade);
    // When locksmith / creative lock hits, force BOTH A/B onto the correct scene
    promptA = locksmith
      ? locksmith
      : creative
        ? creative
        : keywordLock
          ? opts.promptA
          : bias.promptA;
    promptB = locksmith
      ? `${locksmith}. Slightly wider framing of the same residential door locksmith scene`
      : creative
        ? `${creative}. Slightly wider framing of the same arts and crafts studio`
        : keywordLock
          ? opts.promptB
          : bias.promptB;
  }

  // Parallel dual dispatch: distinct seeds so A/B never share latents
  const seed1 = Math.floor(Math.random() * 2147483647);
  const seed2 = seed1 + 7777;
  const [imageRes1, imageRes2] = await Promise.all([
    generateImageWithFallback({
      prompt: promptA,
      seed: seed1,
      category: opts.category,
      userText: opts.userText,
      businessName: opts.businessName,
      niche: opts.niche,
      postType: opts.postType,
      anchorDriven,
    }),
    generateImageWithFallback({
      prompt: promptB,
      seed: seed2,
      category: opts.category,
      userText: opts.userText,
      businessName: opts.businessName,
      niche: opts.niche,
      postType: opts.postType,
      anchorDriven,
    }),
  ]);

  return [imageRes1, imageRes2];
}
