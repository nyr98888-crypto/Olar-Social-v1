/** Auto-generated — business profile + niche mock (UTF-8 via emitter) */
"use client";

import { useEffect, useState } from "react";
import {
  deriveServicesFromInput,
  stripServicePrices,
} from "./derive-services";
import {
  clearAllClientDrafts,
  storageGet,
  storageSet,
} from "./client-storage";

export const ONBOARDING_KEY = "olar-onboarding-done";
export const PROFILE_KEY = "olar-business-profile";
export const WORK_MODE_KEY = "olar-work-mode";

export type ProfileService = {
  id: string;
  title: string;
  desc: string;
  price: number;
};

export type FirstPost = {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
};

export type BusinessProfile = {
  businessName: string;
  city: string;
  niche: string;
  slug: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  services: ProfileService[];
  firstPost: FirstPost;
  rawInput: string;
  /* ── Business DNA extensions (all optional for backward compat) ── */
  email?: string;
  website?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  logoUrl?: string;
  avatarUrl?: string;
  address?: string;
};

type NicheId =
  | "garage"
  | "cosmetics"
  | "interior"
  | "salon"
  | "painting"
  | "accountant"
  | "locksmith"
  | "cafe"
  | "general";

/**
 * Matching order matters: interior compound phrases (containing "פנים")
 * are checked BEFORE cosmetics to avoid misclassifying
 * "אדריכלות פנים" / "עיצוב פנים" as facial/beauty.
 * Cosmetics matches only explicit beauty-clinic words — bare "פנים" is removed.
 */
const KEYWORD_MAP: { keys: string[]; niche: NicheId }[] = [
  {
    keys: [
      "אדריכלות פנים",
      "עיצוב פנים",
      "מעצב פנים",
      "מעצבת פנים",
      "עיצוב חללים",
      "אדריכל פנים",
      "interior design",
      "interior architecture",
    ],
    niche: "interior",
  },
  {
    keys: [
      "מוסך",
      "רכב",
      "צמיג",
      "שמנים",
      "garage",
    ],
    niche: "garage",
  },
  {
    keys: [
      "עיצוב שיער",
      "תספורת",
      "מספרה",
      "מספרת",
      "hair salon",
      "barber",
    ],
    niche: "salon",
  },
  {
    keys: [
      "עבודות צבע",
      "צביעת דירות",
      "צביעת קירות",
      "צבעי בתים",
      "טייח",
      "שיפוץ דירה",
      "house painter",
      "plastering",
    ],
    niche: "painting",
  },
  {
    keys: [
      "רואה חשבון",
      "רואת חשבון",
      "ייעוץ מס",
      "יועץ מס",
      "הנהלת חשבונות",
      "accountant",
    ],
    niche: "accountant",
  },
  {
    keys: ["מנעולן", "מנעולנות", "פתיחת דלתות", "locksmith"],
    niche: "locksmith",
  },
  {
    keys: [
      "קוסמטיקה",
      "מכון יופי",
      "קליניקה אסתטית",
      "בוטוקס",
      "הסרת שיער",
      "ציפורניים",
      "ספא",
      "עור",
      "beauty",
      "יופי",
    ],
    niche: "cosmetics",
  },
  {
    keys: [
      "קפה",
      "בית קפה",
      "מאפה",
      "ביסטרו",
      "מסעדה",
      "cafe",
    ],
    niche: "cafe",
  },
];

export function parseBusinessInput(raw: string): { businessName: string; city: string } {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return { businessName: "", city: "" };

  const parts = cleaned.split(" ");
  if (parts.length >= 2) {
    const city = parts[parts.length - 1] ?? "";
    const businessName = parts.slice(0, -1).join(" ");
    return { businessName, city };
  }
  return { businessName: cleaned, city: "" };
}

function detectNiche(raw: string): NicheId {
  const lower = raw.toLowerCase();
  for (const row of KEYWORD_MAP) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) return row.niche;
  }
  return "general";
}

function slugify(businessName: string, city: string): string {
  const base = `${businessName}-${city || "il"}`
    .toLowerCase()
    .replace(/[^\u0590-\u05FFa-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  // Prefer latin-ish slug for olar.me URLs when Hebrew-only
  if (!/[a-z0-9]/i.test(base)) {
    const hash = Math.abs(
      Array.from(businessName).reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    return `biz-${hash.toString(36)}`;
  }
  return base || "my-business";
}

export function buildProfileFromInput(raw: string): BusinessProfile {
  const { businessName, city } = parseBusinessInput(raw);
  const nicheId = detectNiche(raw);
  const slug = slugify(businessName || "biz", city);
  // Never inject canned niche marketing into firstPost — wait for AI / generate-post.
  const services = deriveServicesFromInput(raw, nicheId);

  return {
    businessName: businessName || "",
    city,
    niche: nicheId,
    slug,
    tagline: "",
    description: raw.trim().slice(0, 280),
    phone: "",
    whatsapp: "",
    services,
    firstPost: {
      headline: "",
      body: "",
      cta: "",
      hashtags: [],
    },
    rawInput: raw.trim(),
  };
}

export function saveProfile(profile: BusinessProfile): void {
  storageSet("business-profile", JSON.stringify(profile));
}

export function loadProfile(): BusinessProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = storageGet("business-profile");
    if (!raw) return null;
    return JSON.parse(raw) as BusinessProfile;
  } catch {
    return null;
  }
}

export function markOnboardingDone(): void {
  storageSet("onboarding-done", "1");
  storageSet("work-mode", "quick");
}

/** Clear onboarding + profile so the landing shows again. */
export function clearOnboardingSession(): void {
  clearAllClientDrafts({ clearOAuthBridge: true });
}

export type ResolvedMyPage = {
  slug: string;
  url: string;
  live: boolean;
  businessName: string;
  tagline: string;
  description: string;
  address: string;
  /** City from Business DNA when known — preferred over address for grounding. */
  city?: string;
  phone: string;
  whatsapp: string;
  mapsUrl: string;
  wazeUrl: string;
  services: ProfileService[];
  firstPost?: FirstPost;
  /* Business DNA extras */
  email?: string;
  website?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  logoUrl?: string;
  avatarUrl?: string;
};

export function resolveMyPage(profile?: BusinessProfile | null): ResolvedMyPage {
  const p = profile ?? loadProfile();
  if (!p) {
    // No profile at all — return empty shell (guest / empty DB)
    return {
      slug: "",
      url: "",
      live: false,
      businessName: "",
      tagline: "",
      description: "",
      address: "",
      phone: "",
      whatsapp: "",
      mapsUrl: "",
      wazeUrl: "",
      services: [],
    };
  }
  const cityQ = encodeURIComponent(p.city || p.businessName);
  const services =
    p.rawInput?.trim()
      ? deriveServicesFromInput(p.rawInput, p.niche)
      : stripServicePrices(p.services || []);
  return {
    slug: p.slug,
    url: `olar.me/${p.slug}`,
    live: true,
    businessName: p.businessName,
    tagline: p.tagline,
    description: p.description,
    address: p.address || p.city || "",
    city: p.city?.trim() || undefined,
    phone: p.phone,
    whatsapp: p.whatsapp,
    mapsUrl: `https://maps.google.com/?q=${cityQ}`,
    wazeUrl: `https://waze.com/ul?q=${cityQ}`,
    services,
    firstPost: p.firstPost,
    email: p.email,
    website: p.website,
    instagramUrl: p.instagramUrl,
    facebookUrl: p.facebookUrl,
    logoUrl: p.logoUrl,
    avatarUrl: p.avatarUrl,
  };
}

export function useResolvedMyPage() {
  const [page, setPage] = useState<ResolvedMyPage>(() => resolveMyPage(null));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPage(resolveMyPage());
    setReady(true);
  }, []);

  return { page, ready };
}
