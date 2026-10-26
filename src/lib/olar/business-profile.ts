/** Auto-generated — business profile + niche mock (UTF-8 via emitter) */
"use client";

import { useEffect, useState } from "react";
import { MY_PAGE } from "./mock-data";
import {
  deriveServicesFromInput,
  stripServicePrices,
} from "./derive-services";

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
};

type NicheId = "garage" | "cosmetics" | "cafe" | "general";

const NICHES: Record<
  NicheId,
  {
    tagline: string;
    description: string;
    services: ProfileService[];
    postHeadline: string;
    postBody: string;
    postCta: string;
  }
> = {
  "garage": {
    "tagline": "תיקוני רכב באהבה — בלי הפתעות",
    "description": "מוסך מקומי עם שירות מהיר, מחירים הוגנים, וזמינות בוואטסאפ.",
    "services": [
      {
        "id": "s1",
        "title": "בדיקת חורף",
        "desc": "מצבר, מגבים ושמן — עד 45 דקות",
        "price": 0
      },
      {
        "id": "s2",
        "title": "החלפת שמן",
        "desc": "שמן + מסנן + בדיקה כללית",
        "price": 0
      },
      {
        "id": "s3",
        "title": "אבחון בלמים",
        "desc": "בלמים + דיסקים — תאום מהיר",
        "price": 0
      }
    ],
    "postHeadline": "החורף כבר פה — הרכב מוכן?",
    "postBody": "בדיקת מצבר, מגבים ושמן לפני הגשם.\nהשאירו הודעה בוואטסאפ ונשמח לתאם לכם שעה נוחה — בלי לחץ.",
    "postCta": "לתיאום מהיר בוואטסאפ"
  },
  "cosmetics": {
    "tagline": "יופי שמרגישים — יחס אישי בכל טיפול",
    "description": "מכון יופי מקומי עם טיפולים מקצועיים, אווירה נעימה, וקביעת תור בוואטסאפ.",
    "services": [
      {
        "id": "s1",
        "title": "טיפול פנים",
        "desc": "ניקוי עמוק + מסכה — כ־60 דקות",
        "price": 0
      },
      {
        "id": "s2",
        "title": "גבות וריסים",
        "desc": "עיצוב מדויק לפי מבנה הפנים",
        "price": 0
      },
      {
        "id": "s3",
        "title": "מבצע חבילה",
        "desc": "פנים + גבות במחיר משתלם",
        "price": 0
      }
    ],
    "postHeadline": "העור שלכן מחכה לרענון קטן",
    "postBody": "השבוע פתחנו מקומות אחרונים לטיפול פנים מרענן.\nכתבו בוואטסאפ — נמצא לכן שעה נוחה בלי לחץ.",
    "postCta": "לקביעת תור בוואטסאפ"
  },
  "cafe": {
    "tagline": "קפה טרי, פינה חמה, וחיוך בכל כוס",
    "description": "בית קפה שכונתי עם קפה איכותי, מאפים טריים, ואווירה ביתית.",
    "services": [
      {
        "id": "s1",
        "title": "קפה + מאפה",
        "desc": "שילוב הבוקר שלנו",
        "price": 0
      },
      {
        "id": "s2",
        "title": "ארוחת בוקר",
        "desc": "צלחת מלאה לשניים",
        "price": 0
      },
      {
        "id": "s3",
        "title": "עוגת הבית",
        "desc": "פרוסה טרייה כל יום",
        "price": 0
      }
    ],
    "postHeadline": "בוקר טוב מתחיל אצלנו",
    "postBody": "קפה טרי, מאפה חם, ומקום לשבת רגע לפני היום.\nשלחו הודעה בוואטסאפ להזמנה או שאלה — נשמח.",
    "postCta": "להזמנה בוואטסאפ"
  },
  "general": {
    "tagline": "שירות מקומי שאפשר לסמוך עליו",
    "description": "עסק מקומי עם יחס אישי, מחירים הוגנים, וזמינות בוואטסאפ.",
    "services": [
      {
        "id": "s1",
        "title": "ייעוץ ראשוני",
        "desc": "שיחה קצרה להבנת הצורך",
        "price": 0
      },
      {
        "id": "s2",
        "title": "שירות בסיסי",
        "desc": "הפתרון הנפוץ ביותר אצלנו",
        "price": 0
      },
      {
        "id": "s3",
        "title": "חבילת פרימיום",
        "desc": "ליווי מלא עד התוצאה",
        "price": 0
      }
    ],
    "postHeadline": "השבוע פתחנו מקומות אחרונים",
    "postBody": "אם חיפשתם שירות אמין ליד הבית — הגעתם למקום הנכון.\nכתבו בוואטסאפ ונחזור אליכם במהירות.",
    "postCta": "לפרטים בוואטסאפ"
  }
};

const KEYWORD_MAP: { keys: string[]; niche: NicheId }[] = [
  {
    "keys": [
      "מוסך",
      "רכב",
      "צמיג",
      "שמנים",
      "garage"
    ],
    "niche": "garage"
  },
  {
    "keys": [
      "קוסמטיקה",
      "יופי",
      "פנים",
      "ציפורניים",
      "ספא",
      "beauty"
    ],
    "niche": "cosmetics"
  },
  {
    "keys": [
      "קפה",
      "בית קפה",
      "מאפה",
      "ביסטרו",
      "מסעדה",
      "cafe"
    ],
    "niche": "cafe"
  }
];

export function parseBusinessInput(raw: string): { businessName: string; city: string } {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return { businessName: "העסק שלי", city: "" };

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
  const niche = NICHES[nicheId];
  const slug = slugify(businessName, city);
  const phone = "050-0000000";
  const whatsapp = "0500000000";
  const waDigits = "972500000000";
  const cityBit = city ? ` ב${city}` : "";
  const body =
    `${niche.postBody}\n\n${niche.postCta}: https://wa.me/${waDigits}\n\n— ${businessName}${cityBit}`;
  const services = deriveServicesFromInput(raw, nicheId);

  return {
    businessName,
    city,
    niche: nicheId,
    slug,
    tagline: niche.tagline,
    description: niche.description,
    phone,
    whatsapp,
    services,
    firstPost: {
      headline: niche.postHeadline,
      body,
      cta: niche.postCta,
      hashtags: ["#עסקמקומי", "#אולרסושיאל", `#${businessName.replace(/\s+/g, "")}`],
    },
    rawInput: raw.trim(),
  };
}

export function saveProfile(profile: BusinessProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function loadProfile(): BusinessProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BusinessProfile;
  } catch {
    return null;
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
    localStorage.setItem(WORK_MODE_KEY, "quick");
  } catch {
    /* ignore */
  }
}

/** Clear onboarding + profile so the 15s landing shows again. */
export function clearOnboardingSession(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(WORK_MODE_KEY);
    localStorage.removeItem("olar-yona-idea");
    localStorage.removeItem("olar-daily-freq");
  } catch {
    /* ignore */
  }
}

export type ResolvedMyPage = {
  slug: string;
  url: string;
  live: boolean;
  businessName: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  mapsUrl: string;
  wazeUrl: string;
  rating: number;
  weekVisits: number;
  services: ProfileService[];
  gallery: typeof MY_PAGE.gallery;
  firstPost?: FirstPost;
};

export function resolveMyPage(profile?: BusinessProfile | null): ResolvedMyPage {
  const p = profile ?? loadProfile();
  if (!p) {
    return {
      slug: MY_PAGE.slug,
      url: MY_PAGE.url,
      live: MY_PAGE.live,
      businessName: MY_PAGE.businessName,
      tagline: MY_PAGE.tagline,
      description: MY_PAGE.description,
      address: MY_PAGE.address,
      phone: MY_PAGE.phone,
      whatsapp: MY_PAGE.whatsapp,
      mapsUrl: MY_PAGE.mapsUrl,
      wazeUrl: MY_PAGE.wazeUrl,
      rating: MY_PAGE.rating,
      weekVisits: 0,
      services: stripServicePrices([...MY_PAGE.services]),
      gallery: MY_PAGE.gallery,
      firstPost: {
        headline: MY_PAGE.tagline,
        body: MY_PAGE.description,
        cta: "\u05dc\u05ea\u05d9\u05d0\u05d5\u05dd \u05d5\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
        hashtags: ["#\u05e2\u05e1\u05e7\u05de\u05e7\u05d5\u05de\u05d9"],
      },
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
    address: p.city || MY_PAGE.address,
    phone: p.phone,
    whatsapp: p.whatsapp,
    mapsUrl: `https://maps.google.com/?q=${cityQ}`,
    wazeUrl: `https://waze.com/ul?q=${cityQ}`,
    rating: MY_PAGE.rating,
    weekVisits: 0,
    services,
    gallery: MY_PAGE.gallery,
    firstPost: p.firstPost,
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
