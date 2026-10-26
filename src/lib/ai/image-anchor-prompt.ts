/**
 * Optional user image-anchor words (3–4 words) → FLUX subject.
 * Image-only: never mixed into Hebrew headlines / social copy.
 */
import { hasHebrewScript } from "@/lib/ai/fal-visual-prompt";
import { translateToFalEnglishPrompt } from "@/lib/ai/translate-visual-prompt";
import {
  detectFemaleOwnerName,
  isCreativeStudioContext,
  isLocksmithContext,
} from "@/lib/ai/hebrew-visual-context";

const ANCHOR_STYLE =
  "bright natural studio lighting, clean aesthetic, 8k resolution, crisp photorealistic";

/** Same avoid list as creative-studio lock — bake when domain matches, keep anchor as subject. */
const CREATIVE_AVOID =
  "handyman, construction worker, power drill, tools, mechanic, garage, carpentry, flannel shirt, hardhat, industrial workshop, male worker, auto repair, spray booth";

const LOCKSMITH_AVOID =
  "cars, car engine, automotive garage, spray booth, mechanic, auto repair, engine block, burglar, thief, crime scene, violence";

export function trimImageAnchorWords(raw?: string | null): string {
  return (raw || "").trim().slice(0, 160);
}

/**
 * Lightweight Hebrew → English for short anchor phrases.
 * Already-English anchors pass through unchanged.
 */
export async function resolveEnglishImageAnchors(
  anchors: string,
  opts: {
    niche?: string | null;
    businessName?: string | null;
    category?: string | null;
  } = {}
): Promise<string> {
  const trimmed = trimImageAnchorWords(anchors);
  if (!trimmed) return "";
  if (!hasHebrewScript(trimmed)) return trimmed;

  try {
    // Translate the anchor phrase itself — skip dish/workshop subject locks
    // so Hebrew craft/product words reach FLUX as English nouns, not handyman stock.
    const { prompt } = await translateToFalEnglishPrompt({
      description: `Short visual subject only (under 12 English words, noun phrase, no ad copy): ${trimmed}`,
      niche: opts.niche,
      businessName: opts.businessName,
      category: opts.category,
      skipSubjectLocks: true,
    });
    const cleaned = prompt
      .replace(/^["']|["']$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || hasHebrewScript(cleaned)) return trimmed;
    if (cleaned.length <= 90) return cleaned;
    return cleaned.split(/[.,]/)[0]?.trim().slice(0, 90) || cleaned.slice(0, 90);
  } catch {
    return trimmed;
  }
}

/**
 * A/B FLUX prompts: same anchor subject leading both frames.
 * Option 1 = finished clean close-up; Option 2 = atmosphere / table context.
 * Domain avoids + gender cues from main userText when craft studio / female name detected.
 */
export function buildAnchorFluxPrompts(
  englishAnchors: string,
  opts?: {
    userText?: string | null;
    niche?: string | null;
    category?: string | null;
    businessName?: string | null;
  }
): { promptA: string; promptB: string } {
  const subject = englishAnchors.trim().slice(0, 200) || "local business craft";
  let promptA = `${subject}, finished clean result focus, close-up pristine completed presentation, ${ANCHOR_STYLE}`;
  let promptB = `${subject}, atmosphere and table-focused scene, inviting environment context, wider lifestyle framing, ${ANCHOR_STYLE}`;

  const sources = [
    opts?.userText,
    opts?.niche,
    opts?.category,
    opts?.businessName,
  ];
  if (isLocksmithContext(...sources)) {
    const avoid = `. door lock / locksmith scene only. avoid: ${LOCKSMITH_AVOID}`;
    promptA += avoid;
    promptB += avoid;
  } else if (isCreativeStudioContext(...sources)) {
    const avoid = `. avoid: ${CREATIVE_AVOID}`;
    promptA += avoid;
    promptB += avoid;
    if (detectFemaleOwnerName(...sources)) {
      const gender =
        ". Feature a smiling female artist as the human subject when a person is visible";
      promptA += gender;
      promptB += gender;
    }
  }

  return {
    promptA: promptA.slice(0, 900),
    promptB: promptB.slice(0, 900),
  };
}
