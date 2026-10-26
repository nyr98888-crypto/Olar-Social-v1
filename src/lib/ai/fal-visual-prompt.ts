/**
 * Two-Step Visual Synthesizer — Category Style Blueprints + Guardrail.
 * Authoritative English-only prompts for FAL Flux. Never sends Hebrew.
 */

export type VisualCategory =
  | "AUTOMOTIVE"
  | "BEAUTY"
  | "FOOD"
  | "GENERAL_TRADE";

/** @deprecated use VisualCategory — kept for callers mapping GoldenNiche */
export type FalVisualNiche = "garage" | "cosmetics" | "restaurant" | "general";

export type FalImageSize = "landscape_4_3" | "square";

export type FalVisualPurpose = "post" | "banner" | "profile" | "headshot";

export type BuildFalVisualPromptOpts = {
  niche?: string | null;
  businessName?: string | null;
  userHint?: string | null;
  hebrewPrompt?: string | null;
  englishPrompt?: string | null;
  allowedVisualStyle?: string | null;
  purpose?: FalVisualPurpose | null;
  category?: VisualCategory | null;
};

/** Exact-spirit category blueprints (English anchors for Flux). */
export const CATEGORY_BLUEPRINTS: Record<VisualCategory, string> = {
  AUTOMOTIVE:
    "Brightly lit modern auto workshop, spotless epoxy floor, gleaming car on hydraulic lift, mechanic inspecting brakes, crisp commercial daylight, 35mm, high-end commercial ad, sharp focus, 4k",
  BEAUTY:
    "Luxury minimalist aesthetic clinic, soft pastel, macro nails/glowing skin, beauty ring light, commercial editorial, ultra clean, 4k",
  FOOD:
    "Appetizing commercial food photography, gourmet dish, morning sunlight, vibrant, f/2.8, magazine quality",
  GENERAL_TRADE:
    "Professional tradesman in modern bright home interior, quality tools, natural light, commercial service photography",
};

/** Mandatory append after safety filter (Art Director pipeline). */
export const GUARDRAIL_TAIL =
  "bright daytime commercial photography, crisp focus, no text";

const DARK_SCENE_RE =
  /\b(dark|night|dimly\s*lit|dimly-lit|dim\s+light|street\s+at\s+night|night\s+street|neon\s+alley|rainy\s+night|gloomy|moonlit|after\s*dark|noir|candlelit|murky)\b/gi;

const HEBREW_RE = /[\u0590-\u05FF]/;

const CATEGORY_KEYWORDS: { keys: string[]; category: VisualCategory }[] = [
  {
    keys: [
      "מוסך",
      "רכב",
      "צמיג",
      "בלמ",
      "מגב",
      "שמן",
      "garage",
      "auto",
      "mechanic",
      "brake",
      "wiper",
      "tire",
      "חורף",
    ],
    category: "AUTOMOTIVE",
  },
  {
    keys: [
      "יופי",
      "קוסמט",
      "פנים",
      "ציפורנ",
      "ספא",
      "beauty",
      "nail",
      "facial",
      "skincare",
      "aesthetic",
    ],
    category: "BEAUTY",
  },
  {
    keys: [
      "קפה",
      "מסעד",
      "אוכל",
      "פיצה",
      "סושי",
      "מאפה",
      "food",
      "cafe",
      "restaurant",
      "pizza",
      "coffee",
      "burger",
    ],
    category: "FOOD",
  },
];

const KEYWORD_SCENE_MAP: { keys: string[]; scene: string }[] = [
  {
    keys: ["מגבים", "wiper", "wipers"],
    scene: "mechanic checking windshield wipers on a gleaming car",
  },
  {
    keys: ["בלמים", "brakes", "brake"],
    scene: "mechanic inspecting car brakes under bright bay lights",
  },
  {
    keys: ["שמן", "oil change", "oil"],
    scene: "technician performing an oil service in a spotless bay",
  },
  {
    keys: ["חורף", "winter"],
    scene: "winter car readiness check in a brightly lit workshop",
  },
  {
    keys: ["טיפול פנים", "facial"],
    scene: "facial treatment with glowing skin under a beauty ring light",
  },
  {
    keys: ["ציפורניים", "nails", "manicure"],
    scene: "macro manicure detail in a luxury minimalist clinic",
  },
  {
    keys: ["קפה", "coffee", "espresso"],
    scene: "fresh gourmet coffee and plated dish in morning sunlight",
  },
];

export function hasHebrewScript(text: string | null | undefined): boolean {
  return Boolean(text && HEBREW_RE.test(text));
}

export function stripHebrew(text: string): string {
  return text
    .replace(/[\u0590-\u05FF]+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export function detectVisualCategory(
  ...sources: Array<string | null | undefined>
): VisualCategory {
  const blob = sources.filter(Boolean).join(" ").toLowerCase();
  for (const row of CATEGORY_KEYWORDS) {
    if (row.keys.some((k) => blob.includes(k.toLowerCase()))) {
      return row.category;
    }
  }
  return "GENERAL_TRADE";
}

/** Map legacy golden niches ↔ categories */
export function nicheToCategory(niche?: string | null): VisualCategory {
  const n = (niche || "").toLowerCase();
  if (
    n.includes("garage") ||
    n.includes("auto") ||
    n.includes("מוסך") ||
    n.includes("רכב")
  ) {
    return "AUTOMOTIVE";
  }
  if (
    n.includes("cosmetic") ||
    n.includes("beauty") ||
    n.includes("יופי") ||
    n.includes("קוסמט")
  ) {
    return "BEAUTY";
  }
  if (
    n.includes("restaurant") ||
    n.includes("cafe") ||
    n.includes("food") ||
    n.includes("קפה") ||
    n.includes("מסעד")
  ) {
    return "FOOD";
  }
  return detectVisualCategory(niche);
}

export function resolveFalNiche(
  ...sources: Array<string | null | undefined>
): FalVisualNiche {
  const cat = detectVisualCategory(...sources);
  if (cat === "AUTOMOTIVE") return "garage";
  if (cat === "BEAUTY") return "cosmetics";
  if (cat === "FOOD") return "restaurant";
  return "general";
}

function mapKeywordsToScenes(raw: string): string[] {
  if (!raw.trim()) return [];
  const lower = raw.toLowerCase();
  const scenes: string[] = [];
  for (const row of KEYWORD_SCENE_MAP) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) {
      if (!scenes.includes(row.scene)) scenes.push(row.scene);
    }
  }
  return scenes.slice(0, 3);
}

function englishOnlyHint(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  if (!hasHebrewScript(text)) return text.trim();
  return stripHebrew(text);
}

/**
 * Code double-check before FAL:
 * - strip Hebrew
 * - replace dark/night scenes with bright commercial daylight
 * - always append lighting + no-text guardrail tail
 */
export function applyVisualPromptGuardrail(
  prompt: string,
  category?: VisualCategory | null
): string {
  let next = (prompt || "").trim();
  if (hasHebrewScript(next)) next = stripHebrew(next);

  // Safety: night/dark/dimly lit → bright commercial daylight
  DARK_SCENE_RE.lastIndex = 0;
  if (DARK_SCENE_RE.test(next)) {
    DARK_SCENE_RE.lastIndex = 0;
    next = next.replace(DARK_SCENE_RE, "bright commercial daylight");
  }
  DARK_SCENE_RE.lastIndex = 0;

  if (!next) {
    next = CATEGORY_BLUEPRINTS[category || "GENERAL_TRADE"];
  }

  if (!/bright daytime commercial photography/i.test(next)) {
    next = `${next}, ${GUARDRAIL_TAIL}`;
  } else if (!/no text/i.test(next)) {
    next = `${next}, no text`;
  }

  next = next
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  if (hasHebrewScript(next)) next = stripHebrew(next);
  if (!next) next = `${CATEGORY_BLUEPRINTS.GENERAL_TRADE}, ${GUARDRAIL_TAIL}`;

  return next;
}

/**
 * Merge topic fragments with category blueprint (sync fallback when LLM unavailable).
 */
export function buildFalVisualPrompt(opts: BuildFalVisualPromptOpts): string {
  const category =
    opts.category ||
    detectVisualCategory(
      opts.niche,
      opts.allowedVisualStyle,
      opts.hebrewPrompt,
      opts.userHint,
      opts.englishPrompt
    );

  const blueprint = CATEGORY_BLUEPRINTS[category];
  const rawBlob = [
    opts.hebrewPrompt,
    opts.userHint,
    opts.englishPrompt,
    opts.niche,
  ]
    .filter(Boolean)
    .join(" ");

  const keywordScenes = mapKeywordsToScenes(rawBlob);
  const styleEn = englishOnlyHint(opts.allowedVisualStyle);
  const hintEn = englishOnlyHint(opts.userHint);
  const promptEn = englishOnlyHint(opts.englishPrompt);

  const usableLlmPrompt =
    promptEn.length >= 40 && !hasHebrewScript(opts.englishPrompt ?? "")
      ? promptEn
      : "";

  const parts: string[] = [];

  if (usableLlmPrompt) {
    parts.push(usableLlmPrompt);
    // Keep blueprint DNA when LLM omitted lighting/workshop cues
    if (!/workshop|clinic|food photography|tradesman|daylight/i.test(usableLlmPrompt)) {
      parts.push(blueprint);
    }
  } else {
    parts.push(blueprint);
  }

  for (const scene of keywordScenes) {
    const joined = parts.join(" ").toLowerCase();
    if (!joined.includes(scene.slice(0, 24).toLowerCase())) {
      parts.push(scene);
    }
  }

  if (
    styleEn &&
    !parts.join(" ").toLowerCase().includes(styleEn.slice(0, 32).toLowerCase())
  ) {
    parts.push(styleEn);
  }

  if (
    hintEn &&
    hintEn.length >= 8 &&
    !hasHebrewScript(hintEn) &&
    !parts.join(" ").toLowerCase().includes(hintEn.toLowerCase())
  ) {
    parts.push(hintEn);
  }

  const nameEn = englishOnlyHint(opts.businessName);
  if (nameEn && /^[\x00-\x7F]+$/.test(nameEn) && nameEn.length >= 2) {
    parts.push(`local business atmosphere for ${nameEn}`);
  }

  const merged = parts.join(", ");
  return applyVisualPromptGuardrail(merged, category);
}

/**
 * Posts/banners → landscape_4_3; headshot/profile → square.
 */
export function falImageSizeForAspect(
  aspectRatio?: "1:1" | "4:5" | "16:9" | null,
  purpose?: FalVisualPurpose | null
): FalImageSize {
  if (purpose === "profile" || purpose === "headshot") return "square";
  if (aspectRatio === "1:1" && purpose !== "banner" && purpose !== "post") {
    return "square";
  }
  return "landscape_4_3";
}

export function defaultFalPromptForNiche(niche?: string | null): string {
  const category = nicheToCategory(niche);
  return applyVisualPromptGuardrail(CATEGORY_BLUEPRINTS[category], category);
}

/** @deprecated alias — blueprints replaced NICHE_TEMPLATES */
export const NICHE_TEMPLATES: Record<FalVisualNiche, string> = {
  garage: CATEGORY_BLUEPRINTS.AUTOMOTIVE,
  cosmetics: CATEGORY_BLUEPRINTS.BEAUTY,
  restaurant: CATEGORY_BLUEPRINTS.FOOD,
  general: CATEGORY_BLUEPRINTS.GENERAL_TRADE,
};
