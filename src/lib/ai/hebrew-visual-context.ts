/**
 * Hebrew visual context locks for FLUX prompts.
 * Creative-studio phrases must NEVER become industrial workshop / handyman scenes.
 * Female owner names → female subject when craft studio is detected.
 */

const CREATIVE_STUDIO_KEYS = [
  "סדנת יצירה",
  "סדנאות יצירה",
  "סדנת אומנות",
  "סדנאות אומנות",
  "סטודיו יצירה",
  "סטודיו אומנות",
  "קרמיקה",
  "פיסול",
  "חוג ציור",
  "סדנת ציור",
  "creative workshop",
  "arts and crafts",
  "art studio",
  "craft studio",
] as const;

/** Standalone craft cues — only when paired with studio/workshop Hebrew or craft context. */
const CRAFT_CONTEXT_KEYS = ["ציור", "אומנות", "יצירה", "pottery", "ceramics"];

const FEMALE_HEBREW_NAMES = [
  "מיכל",
  "אורטל",
  "שרה",
  "יעל",
  "דנה",
  "מאיה",
  "נועה",
  "רונית",
  "לירון",
  "נוגה",
  "תמר",
  "הילה",
  "שירה",
  "רותם",
  "עדי",
  "מור",
  "יעל",
  "אביגיל",
  "נויה",
  "ליאת",
  "קרן",
  "סיגל",
  "איילת",
  "ורד",
  "רחל",
  "לאה",
  "חנה",
  "מרים",
  "אסתר",
  "גלי",
  "שני",
  "הדר",
] as const;

const CREATIVE_AVOID =
  "handyman, construction worker, power drill, tools, mechanic, garage, carpentry, flannel shirt, hardhat, industrial workshop, male worker, auto repair, spray booth";

const FEMALE_CRAFT_PROMPT =
  "A smiling Israeli woman artist in a sunlit creative arts and crafts studio, surrounded by colorful handmade crafts, pottery, paintbrushes and canvas, warm bright natural light, inspiring creative atmosphere, 8k commercial photography, photorealistic";

const NEUTRAL_CRAFT_PROMPT =
  "Sunlit creative arts and crafts studio in Israel, colorful handmade crafts, pottery wheels, paintbrushes and canvas on wooden tables, warm bright natural light, inspiring creative atmosphere, 8k commercial photography, photorealistic";

export function isCreativeStudioContext(
  ...sources: Array<string | null | undefined>
): boolean {
  const blob = sources.filter(Boolean).join(" ");
  if (!blob.trim()) return false;
  const lower = blob.toLowerCase();

  if (CREATIVE_STUDIO_KEYS.some((k) => lower.includes(k.toLowerCase()))) {
    return true;
  }

  // Bare "סדנה" alone is ambiguous — only craft when paired with art/creation cues
  const hasSadna = /סדנ(?:ה|ת|אות)/.test(blob);
  const hasCraftCue = CRAFT_CONTEXT_KEYS.some((k) =>
    lower.includes(k.toLowerCase())
  );
  if (hasSadna && hasCraftCue) return true;

  // Category id
  if (/courses_workshops|creative|craft/.test(lower)) {
    if (hasSadna || hasCraftCue || /יצירה|אומנות|חוג/.test(blob)) return true;
  }

  return false;
}

/**
 * Detect a likely female owner/business name near של / עם / business phrasing.
 */
export function detectFemaleOwnerName(
  ...sources: Array<string | null | undefined>
): string | null {
  const blob = sources.filter(Boolean).join(" ");
  if (!blob.trim()) return null;

  for (const name of FEMALE_HEBREW_NAMES) {
    // "של מיכל", "עם מיכל", "מיכל,", start of name as business owner
    const re = new RegExp(
      `(?:^|[\\s,.'״"\\-])(?:של|עם|מאת)?\\s*${name}(?=$|[\\s,.'״"\\-])`,
      "u"
    );
    if (re.test(blob) || blob.includes(name)) {
      // Prefer explicit ownership / proximity
      if (
        blob.includes(`של ${name}`) ||
        blob.includes(`עם ${name}`) ||
        blob.includes(`${name},`) ||
        blob.includes(`סדנאות יצירה של ${name}`) ||
        blob.includes(`סדנת יצירה של ${name}`) ||
        blob.startsWith(name) ||
        new RegExp(`${name}\\s`).test(blob)
      ) {
        return name;
      }
    }
  }
  return null;
}

export function buildCreativeStudioPrompt(opts: {
  femaleOwner?: boolean;
  ownerName?: string | null;
}): string {
  const base = opts.femaleOwner ? FEMALE_CRAFT_PROMPT : NEUTRAL_CRAFT_PROMPT;
  return `${base}. avoid: ${CREATIVE_AVOID}`;
}

/**
 * Hard lock for arts & crafts / סדנת יצירה — wins over automotive "workshop" mistranslation.
 * Returns null when context is not creative studio.
 */
export function resolveCreativeStudioLock(opts: {
  description?: string | null;
  niche?: string | null;
  category?: string | null;
  businessName?: string | null;
}): string | null {
  const sources = [
    opts.description,
    opts.niche,
    opts.category,
    opts.businessName,
  ];
  if (!isCreativeStudioContext(...sources)) return null;

  const femaleName = detectFemaleOwnerName(...sources);
  return buildCreativeStudioPrompt({
    femaleOwner: Boolean(femaleName),
    ownerName: femaleName,
  });
}
