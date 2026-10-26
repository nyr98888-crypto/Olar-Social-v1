/**
 * Hard visual locks for trade / beauty niches.
 * Wins over Art Director when keywords match — prevents soap/engine/spa hallucinations.
 * FLUX has no negative_prompt API — bake avoid-list into the prompt string.
 *
 * Creative-studio lock (סדנת יצירה) ALWAYS wins over automotive "workshop" false positives.
 */
import { resolveCreativeStudioLock } from "@/lib/ai/hebrew-visual-context";

export type TradeHint = {
  id: string;
  keys: string[];
  englishPrompt: string;
};

export const TRADE_MAP: TradeHint[] = [
  {
    id: "locksmith_door",
    keys: [
      "מנעולן",
      "מנעולנות",
      "צילינדר",
      "צילינדרים",
      "פריצה",
      "פריצות",
      "פתיחת דלת",
      "פתיחת דלתות",
      "מנעול דלת",
      "מנעולים",
      "החלפת מנעול",
      "locksmith",
      "door lock",
      "cylinder lock",
      "deadbolt",
    ],
    englishPrompt:
      "Professional certified locksmith at a residential wooden front door, installing or opening a door cylinder lock with professional locksmith tools, bright daylight, trustworthy commercial trades photography, 8k photorealistic. avoid: cars, car engine, automotive garage, spray booth, mechanic, auto repair, burglar, thief, masked criminal, crime scene, violence, broken glass, dark alley",
  },
  {
    id: "gel_nails",
    keys: [
      "ציפורניים",
      "ציפורן",
      "לק ג'ל",
      "לק ג׳ל",
      "לק גל",
      "מניקור",
      "פדיקור",
      "nail art",
      "gel manicure",
      "gel nails",
      "manicure",
      "nails",
    ],
    englishPrompt:
      "Commercial editorial photography of a woman receiving a luxury gel manicure in a modern high-end nail salon. Both hands resting naturally on a clean white marble counter, delicate elegant nail polish art, manicurist table setting with professional soft studio ring light, shallow depth of field, 8k resolution, photorealistic. avoid: severed hand, disembodied limb, missing body, floating fingers, extra digits, soap bottle, bathroom towels, cartoon, low quality",
  },
  {
    id: "body_paint_booth",
    keys: [
      "פחחות",
      "פחח",
      "צבע רכב",
      "צביעת רכב",
      "תא צבע",
      "מוסך",
      "פחחות וצבע",
      "טיפול רכב",
      "paint booth",
      "body shop",
      "auto body",
      "spray paint",
      "garage",
      // NOTE: do NOT add bare "סדנה" / "workshop" — those map to craft studio via hebrew-visual-context
      "paint",
    ],
    englishPrompt:
      "Professional automotive paint workshop, technician in protective uniform spraying metallic coat on car body, bright spray booth lighting, glossy reflection on car panel, 8k commercial photography. avoid: dark alley, generic engine block, broken parts, low resolution",
  },
];

export function extractTradeFromText(text: string): TradeHint | null {
  const lower = (text || "").toLowerCase();
  if (!lower.trim()) return null;
  // Prefer nails over garage when both could match loosely
  for (const trade of TRADE_MAP) {
    if (trade.keys.some((k) => lower.includes(k.toLowerCase()))) return trade;
  }
  return null;
}

export function resolveTradeBiasedPrompt(opts: {
  description: string;
  niche?: string | null;
  category?: string | null;
  businessName?: string | null;
}): string | null {
  // Creative arts studio MUST beat automotive / industrial "workshop" mistranslation
  const creative = resolveCreativeStudioLock({
    description: opts.description,
    niche: opts.niche,
    category: opts.category,
    businessName: opts.businessName,
  });
  if (creative) return creative;

  const blob = [opts.description, opts.niche, opts.category, opts.businessName]
    .filter(Boolean)
    .join(" ");
  const hit = extractTradeFromText(blob);
  return hit ? hit.englishPrompt : null;
}
