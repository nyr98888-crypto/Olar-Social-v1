/**
 * Personal Marketing Partner memory — business context injected into system prompt.
 * Built from Supabase profiles.business_profile / brand_guidelines / client local profile.
 */

import type { BrandGuidelines } from "../../../schemas/agent";

export type PartnerMemory = {
  /** Owner first name / display name for warm address */
  ownerName: string | null;
  businessName: string | null;
  niche: string | null;
  /** Writing / tone preference (Hebrew) */
  writingStyle: string | null;
  tagline: string | null;
  city: string | null;
};

export type BusinessProfileLike = {
  businessName?: string;
  city?: string;
  niche?: string;
  tagline?: string;
  description?: string;
  firstPost?: {
    headline?: string;
    body?: string;
    cta?: string;
  };
};

const NICHE_HE: Record<string, string> = {
  garage: "מוסך / רכב",
  cosmetics: "יופי וקוסמטיקה",
  interior: "אדריכלות ועיצוב פנים",
  salon: "מספרה / עיצוב שיער",
  painting: "עבודות צבע ושיפוצים",
  accountant: "רואה חשבון / ייעוץ מס",
  locksmith: "מנעולן",
  cafe: "קפה / אוכל",
  general: "עסק מקומי",
};

export function nicheLabelHe(niche: string | null | undefined): string | null {
  if (!niche?.trim()) return null;
  return NICHE_HE[niche] || niche.trim();
}

export function emptyPartnerMemory(): PartnerMemory {
  return {
    ownerName: null,
    businessName: null,
    niche: null,
    writingStyle: null,
    tagline: null,
    city: null,
  };
}

/** Merge Supabase profile row + business_profile jsonb + brand guidelines. */
export function buildPartnerMemory(opts: {
  fullName?: string | null;
  businessProfile?: BusinessProfileLike | null;
  brandGuidelines?: BrandGuidelines | null;
}): PartnerMemory {
  const bp = opts.businessProfile;
  const brand = opts.brandGuidelines;
  const ownerFromName = opts.fullName?.trim().split(/\s+/)[0] || null;

  const writingStyle =
    brand?.tone?.trim() ||
    (bp?.firstPost?.body
      ? "חם, מקומי, ישיר — כמו שיחה עם לקוח בוואטסאפ"
      : null);

  return {
    ownerName: ownerFromName,
    businessName:
      bp?.businessName?.trim() || brand?.brand_name?.trim() || null,
    niche: nicheLabelHe(bp?.niche) || brand?.audience?.trim() || null,
    writingStyle,
    tagline: bp?.tagline?.trim() || brand?.notes?.trim() || null,
    city: bp?.city?.trim() || null,
  };
}

/** Map business profile → BrandGuidelines for pipeline grounding. */
export function brandGuidelinesFromBusinessProfile(
  bp: BusinessProfileLike | null | undefined,
  existing?: BrandGuidelines | null
): BrandGuidelines | null {
  if (!bp?.businessName && !existing?.brand_name) {
    return existing ?? null;
  }
  return {
    brand_name: bp?.businessName || existing?.brand_name,
    tone:
      existing?.tone ||
      "חם, מקומי, אנושי — כמו מנהלת שיווק אישית שכותבת בוואטסאפ",
    audience: existing?.audience || nicheLabelHe(bp?.niche) || undefined,
    notes:
      existing?.notes ||
      [bp?.tagline, bp?.description, bp?.city ? `עיר: ${bp.city}` : null]
        .filter(Boolean)
        .join(" · ") ||
      undefined,
    colors: existing?.colors,
    dos: existing?.dos,
    donts: existing?.donts,
  };
}

export function partnerMemoryHasContext(m: PartnerMemory | null | undefined): boolean {
  if (!m) return false;
  return Boolean(
    m.ownerName || m.businessName || m.niche || m.writingStyle || m.tagline
  );
}
