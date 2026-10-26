/**
 * Hebrew Semantic Disambiguation Pipeline — Negative Token Mapping.
 * Resolve compound nouns (ביטויים שלמים) BEFORE literal word sense.
 * Never literal-translate ambiguous Hebrew (פנים / ספר / צבע / רואה) without domain cross-check.
 */

export type SemanticDomainId =
  | "interior_architecture"
  | "hair_salon"
  | "wall_painting"
  | "accounting"
  | "locksmith"
  | "cosmetics"
  | "automotive"
  | "food";

export type SemanticDomain = {
  id: SemanticDomainId;
  /** Canonical English domain label for prompts / Brand DNA */
  englishDomain: string;
  /** Hebrew niche label for Partner Memory / UI */
  hebrewLabel: string;
  /** Positive English visual brief (domain-verified only) */
  positiveVisual: string;
  /** Negative tokens — Brand DNA forbidden_elements + prompt "avoid:" bake-in */
  negatives: string[];
  /**
   * Hebrew (+ Latin) compound / phrase triggers.
   * Longer compounds MUST be listed first within each domain;
   * global match also sorts by trigger length descending.
   */
  triggers: string[];
  /** Optional business-profile / golden niche id */
  nicheId: string;
};

/**
 * Authoritative Negative Token Mapping for ambiguous Hebrew niches.
 * Order of domains in this array does NOT decide match priority —
 * longest trigger wins across all domains.
 */
export const SEMANTIC_DOMAINS: SemanticDomain[] = [
  {
    id: "interior_architecture",
    englishDomain: "Interior Architecture and Living Spaces",
    hebrewLabel: "אדריכלות ועיצוב פנים",
    positiveVisual:
      "Award-winning modern interior architecture, elegant open-space living room, bespoke furniture, soft architectural ambient lighting, architectural photography of designed interiors and living spaces, hyper-realistic, 8k, professional portfolio shot",
    negatives: [
      "face",
      "portrait",
      "skincare",
      "cosmetics",
      "beauty clinic",
      "woman face",
      "cream",
      "facial treatment",
      "spa facial",
      "makeup",
    ],
    triggers: [
      "אדריכלות פנים",
      "עיצוב פנים",
      "מעצבת פנים",
      "מעצב פנים",
      "אדריכל פנים",
      "אדריכלית פנים",
      "עיצוב חללים",
      "עיצוב דירות",
      "עיצוב בתים",
      "interior design",
      "interior architecture",
    ],
    nicheId: "interior",
  },
  {
    id: "hair_salon",
    englishDomain: "Hair Styling and Modern Salon",
    hebrewLabel: "מספרה / עיצוב שיער",
    positiveVisual:
      "Modern professional hair salon, stylist cutting or styling hair, clean bright salon interior, commercial beauty-service photography, sharp focus, 4k",
    negatives: [
      "book",
      "reading",
      "library",
      "literature",
      "pages",
      "bookstore",
      "novel",
    ],
    triggers: [
      "עיצוב שיער",
      "תספורת",
      "מספרה",
      "מספרת",
      "ספרית",
      "ספר גברים",
      "hair salon",
      "hairdresser",
      "barber",
    ],
    nicheId: "salon",
  },
  {
    id: "wall_painting",
    englishDomain: "Home Renovation, Wall Painting and Plastering",
    hebrewLabel: "עבודות צבע ושיפוצים",
    positiveVisual:
      "Professional house painter renovating a bright residential interior, fresh wall paint and plastering tools, clean home renovation photography, natural daylight, commercial trades service",
    negatives: [
      "makeup",
      "cosmetics",
      "canvas painting",
      "lipstick",
      "artist easel",
      "oil painting on canvas",
      "beauty makeup",
    ],
    triggers: [
      "עבודות צבע",
      "צביעת דירות",
      "צביעת קירות",
      "צבעי בתים",
      "צבעי דירות",
      "שיפוץ דירה",
      "טייח",
      "צבעי",
      "house painter",
      "wall painting",
      "plastering",
    ],
    nicheId: "painting",
  },
  {
    id: "accounting",
    englishDomain: "Accounting, Finance, Business Office",
    hebrewLabel: "רואה חשבון / ייעוץ מס",
    positiveVisual:
      "Professional accounting and finance business office, desk with documents and laptop, clean contemporary workspace, trustworthy commercial photography, bright daylight",
    negatives: [
      "eyes",
      "eyeglasses",
      "optometrist",
      "vision test",
      "eye exam",
      "spectacles",
      "ophthalmologist",
    ],
    triggers: [
      "רואה חשבון",
      "רואת חשבון",
      "ייעוץ מס",
      "יועץ מס",
      "יועצת מס",
      "הנהלת חשבונות",
      "חשבונאות",
      "accountant",
      "tax advisor",
      "bookkeeping",
    ],
    nicheId: "accountant",
  },
  {
    id: "locksmith",
    englishDomain: "Professional Certified Locksmith Services",
    hebrewLabel: "מנעולן",
    positiveVisual:
      "Professional certified locksmith service, locksmith opening a residential door with professional tools, trustworthy trades photography, bright daylight, clean commercial ad",
    negatives: [
      "burglar",
      "thief",
      "robbery",
      "crime",
      "violence",
      "breaking and entering",
      "masked criminal",
    ],
    triggers: ["מנעולן", "מנעולנות", "פתיחת דלתות", "locksmith"],
    nicheId: "locksmith",
  },
  {
    id: "cosmetics",
    englishDomain: "Beauty Clinic and Skincare",
    hebrewLabel: "יופי וקוסמטיקה",
    positiveVisual:
      "Luxury minimalist aesthetic clinic, soft pastel, glowing skin treatment ambiance, beauty ring light, commercial editorial, ultra clean, 4k",
    negatives: [
      "car workshop",
      "mechanic",
      "garage",
      "food photography",
      "interior architecture living room",
    ],
    // Explicit beauty only — NEVER bare "פנים" (ambiguous with interior design)
    triggers: [
      "טיפול פנים",
      "טיפולי פנים",
      "קליניקה אסתטית",
      "קליניקת אסתטיקה",
      "מכון יופי",
      "הסרת שיער",
      "קוסמטיקאית",
      "קוסמטיקה",
      "בוטוקס",
      "עור הפנים",
      "טיפולי עור",
      "ציפורניים",
      "מניקור",
      "beauty clinic",
      "skincare",
      "facial treatment",
    ],
    nicheId: "cosmetics",
  },
  {
    id: "automotive",
    englishDomain: "Automotive Garage and Vehicle Service",
    hebrewLabel: "מוסך / רכב",
    positiveVisual:
      "Brightly lit modern auto workshop, spotless epoxy floor, gleaming car on hydraulic lift, mechanic at work, crisp commercial daylight, 35mm, high-end commercial ad, sharp focus, 4k",
    negatives: [
      "beauty clinic",
      "skincare",
      "restaurant kitchen",
      "hair salon",
    ],
    triggers: [
      "מוסך",
      "מכונאי",
      "צמיגים",
      "garage",
      "auto mechanic",
      "רכב",
    ],
    nicheId: "garage",
  },
  {
    id: "food",
    englishDomain: "Cafe Restaurant and Food Service",
    hebrewLabel: "קפה / מסעדה",
    positiveVisual:
      "Appetizing commercial food photography, gourmet dish or fresh coffee, morning sunlight, vibrant, f/2.8, magazine quality",
    negatives: ["auto workshop", "beauty clinic", "locksmith tools"],
    triggers: [
      "בית קפה",
      "מסעדה",
      "ביסטרו",
      "פיצריה",
      "restaurant",
      "cafe",
      "קפה",
      "מאפה",
    ],
    nicheId: "cafe",
  },
];

/** Permanent system-prompt rule (Hebrew compound nouns). */
export const HEBREW_COMPOUND_NOUN_RULE_HE =
  "בעבודה עם השפה העברית, עליך לזהות ביטויים שלמים (Compound Nouns) לפני פירוק למילים בודדות. מילים כגון 'פנים', 'ספר', 'צבע' חייבות להיקבע לפי ההקשר הכולל של העסק ולא לפי המשמעות המילולית הבסיסית ביותר.";

export type DisambiguationResult = {
  domain: SemanticDomain;
  matchedTrigger: string;
};

type TriggerIndex = { domain: SemanticDomain; trigger: string; len: number };

let _triggerIndex: TriggerIndex[] | null = null;

function getTriggerIndex(): TriggerIndex[] {
  if (_triggerIndex) return _triggerIndex;
  const rows: TriggerIndex[] = [];
  for (const domain of SEMANTIC_DOMAINS) {
    for (const trigger of domain.triggers) {
      const t = trigger.trim();
      if (!t) continue;
      rows.push({ domain, trigger: t, len: t.length });
    }
  }
  rows.sort((a, b) => b.len - a.len);
  _triggerIndex = rows;
  return rows;
}

/**
 * Cross-check Hebrew/English business text against Negative Token Mapping.
 * Longest compound match wins (e.g. "עיצוב פנים" before bare ambiguous tokens).
 */
export function resolveSemanticDomain(
  ...sources: Array<string | null | undefined>
): DisambiguationResult | null {
  const blob = sources.filter(Boolean).join(" ");
  if (!blob.trim()) return null;
  const lower = blob.toLowerCase();

  for (const row of getTriggerIndex()) {
    const needle = row.trigger.toLowerCase();
    if (lower.includes(needle)) {
      return { domain: row.domain, matchedTrigger: row.trigger };
    }
  }
  return null;
}

/** Resolve by known niche id / business_type string. */
export function resolveDomainByNicheId(
  nicheOrType?: string | null
): SemanticDomain | null {
  if (!nicheOrType?.trim()) return null;
  const n = nicheOrType.trim().toLowerCase();
  for (const d of SEMANTIC_DOMAINS) {
    if (
      d.nicheId === n ||
      d.id === n ||
      d.englishDomain.toLowerCase() === n ||
      d.hebrewLabel.includes(nicheOrType.trim())
    ) {
      return d;
    }
  }
  // Fuzzy: business_type may be free Hebrew from Brand DNA
  return resolveSemanticDomain(nicheOrType)?.domain ?? null;
}

/**
 * Preferred resolution: compound match in free text, else niche id / business_type.
 */
export function disambiguateBusinessDomain(opts: {
  text?: string | null;
  niche?: string | null;
  businessType?: string | null;
  allowedVisualStyle?: string | null;
}): DisambiguationResult | null {
  const fromText = resolveSemanticDomain(
    opts.text,
    opts.niche,
    opts.businessType,
    opts.allowedVisualStyle
  );
  if (fromText) return fromText;

  const byId =
    resolveDomainByNicheId(opts.niche) ||
    resolveDomainByNicheId(opts.businessType);
  if (byId) {
    return { domain: byId, matchedTrigger: byId.nicheId };
  }
  return null;
}

/** Format negatives for Flux prompt bake-in (API has no negative_prompt). */
export function formatAvoidClause(negatives: string[]): string {
  const uniq = [...new Set(negatives.map((n) => n.trim()).filter(Boolean))];
  if (!uniq.length) return "";
  return `avoid: ${uniq.join(", ")}`;
}

/**
 * Bake domain-positive English + strong avoid clause into a Flux prompt.
 * FLUX/schnell does NOT support negative_prompt — bake into prompt text.
 */
export function applyDomainPromptGuardrail(
  prompt: string,
  domain: SemanticDomain | null | undefined
): string {
  if (!domain) return (prompt || "").trim();
  let next = (prompt || "").trim();

  // Strip common literal mistranslations that collide with this domain
  if (domain.id === "interior_architecture") {
    next = next
      .replace(/\b(facial|face\s*treatment|skincare|beauty\s*clinic|woman'?s?\s*face)\b/gi, "")
      .replace(/\bportrait\b/gi, "interior view");
  }
  if (domain.id === "hair_salon") {
    next = next.replace(
      /\b(library|bookstore|reading\s*a\s*book|literature|open\s*book)\b/gi,
      "salon"
    );
  }
  if (domain.id === "wall_painting") {
    next = next.replace(
      /\b(makeup|lipstick|canvas\s*painting|artist'?s?\s*easel)\b/gi,
      "wall paint"
    );
  }
  if (domain.id === "accounting") {
    next = next.replace(
      /\b(optometrist|eye\s*exam|vision\s*test|eyeglasses|spectacles)\b/gi,
      "office"
    );
  }
  if (domain.id === "locksmith") {
    next = next.replace(
      /\b(burglar|thief|robbery|crime\s*scene|violence|breaking\s*and\s*entering)\b/gi,
      "professional locksmith"
    );
  }

  // Ensure domain-positive anchor is present
  const domainAnchor = domain.englishDomain.toLowerCase();
  if (!next.toLowerCase().includes(domainAnchor.slice(0, 18))) {
    next = next
      ? `${domain.positiveVisual}, ${next}`
      : domain.positiveVisual;
  }

  const avoid = formatAvoidClause(domain.negatives);
  if (avoid && !/avoid\s*:/i.test(next)) {
    next = `${next}, ${avoid}`;
  }

  return next.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
}

/** Merge domain negatives into Brand DNA forbidden_elements (deduped). */
export function mergeDomainForbidden(
  existing: string[] | null | undefined,
  domain: SemanticDomain | null | undefined
): string[] {
  const base = [...(existing ?? [])];
  if (!domain) return base;
  for (const n of domain.negatives) {
    if (!base.some((b) => b.toLowerCase() === n.toLowerCase())) {
      base.push(n);
    }
  }
  return base;
}

/** English allowed_visual_style derived from verified domain (no literal mistranslation). */
export function domainAllowedVisualStyle(domain: SemanticDomain): string {
  return `${domain.positiveVisual}. Domain lock: ${domain.englishDomain}. Stay strictly on-niche.`;
}

/**
 * Enrich Brand DNA fields from semantic domain when business_type is known/ambiguous Hebrew.
 */
export function enrichBrandDnaFromDomain(partial: {
  business_type?: string;
  allowed_visual_style?: string;
  forbidden_elements?: string[];
}): {
  business_type: string;
  allowed_visual_style?: string;
  forbidden_elements: string[];
} | null {
  const type = partial.business_type?.trim();
  if (!type) return null;

  const hit =
    disambiguateBusinessDomain({
      text: type,
      niche: type,
      businessType: type,
      allowedVisualStyle: partial.allowed_visual_style,
    }) ?? null;

  if (!hit) {
    return {
      business_type: type,
      allowed_visual_style: partial.allowed_visual_style,
      forbidden_elements: partial.forbidden_elements ?? [],
    };
  }

  const { domain } = hit;
  return {
    business_type: domain.englishDomain,
    allowed_visual_style:
      partial.allowed_visual_style?.trim() || domainAllowedVisualStyle(domain),
    forbidden_elements: mergeDomainForbidden(
      partial.forbidden_elements,
      domain
    ),
  };
}

/** Compact block for LLM system / Art Director prompts. */
export function buildDisambiguationSystemBlock(
  domain: SemanticDomain | null | undefined
): string {
  const permanent = `## Hebrew Semantic Disambiguation (PERMANENT)
${HEBREW_COMPOUND_NOUN_RULE_HE}

Negative Token Mapping (must enforce before any image/post):
- אדריכלות פנים / עיצוב פנים → Interior Architecture and Living Spaces — NEVER face/skincare/cosmetics
- מספרה / עיצוב שיער → Hair Styling and Modern Salon — NEVER book/library/literature
- עבודות צבע / צבעי → Home Renovation, Wall Painting and Plastering — NEVER makeup/canvas painting
- רואה חשבון / ייעוץ מס → Accounting, Finance, Business Office — NEVER eyes/optometrist
- מנעולן → Professional Certified Locksmith Services — NEVER burglar/thief/crime
`;

  if (!domain) return permanent;

  return `${permanent}
### Active verified domain
- English domain: ${domain.englishDomain}
- Hebrew label: ${domain.hebrewLabel}
- Positive visual: ${domain.positiveVisual}
- FORBIDDEN (ban from image_task.prompt): ${domain.negatives.join(", ")}
`;
}

/** Art Director user preamble with domain lock. */
export function artDirectorDomainPreamble(
  domain: SemanticDomain | null | undefined
): string {
  if (!domain) {
    return "Cross-check Hebrew compounds before translating. Never literal-translate ambiguous words (פנים/ספר/צבע/רואה) without business context.";
  }
  return [
    `VERIFIED DOMAIN (do not override): ${domain.englishDomain}`,
    `Build the English Flux prompt ONLY for this domain.`,
    `Positive visual direction: ${domain.positiveVisual}`,
    `Hard avoid (bake into prompt as "avoid: ..."): ${domain.negatives.join(", ")}`,
    `Never literal-translate Hebrew without this domain cross-check.`,
  ].join("\n");
}
