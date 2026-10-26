/**
 * Emit UTF-8 business-profile + Onboarding value flow.
 * Hebrew only via JSON.stringify / \u escapes — never PowerShell.
 */
import fs from "fs";

const J = (s) => JSON.stringify(s);

/* ---- niche templates (Hebrew) ---- */
const niches = {
  garage: {
    tagline: "תיקוני רכב באהבה — בלי הפתעות",
    description:
      "מוסך מקומי עם שירות מהיר, מחירים הוגנים, וזמינות בוואטסאפ.",
    services: [
      { id: "s1", title: "בדיקת חורף", desc: "מצבר, מגבים ושמן — עד 45 דקות", price: 280 },
      { id: "s2", title: "החלפת שמן", desc: "שמן + מסנן + בדיקה כללית", price: 350 },
      { id: "s3", title: "אבחון בלמים", desc: "בלמים + דיסקים — תאום מהיר", price: 450 },
    ],
    postHeadline: "החורף כבר פה — הרכב מוכן?",
    postBody:
      "בדיקת מצבר, מגבים ושמן לפני הגשם.\nהשאירו הודעה בוואטסאפ ונשמח לתאם לכם שעה נוחה — בלי לחץ.",
    postCta: "לתיאום מהיר בוואטסאפ",
  },
  cosmetics: {
    tagline: "יופי שמרגישים — יחס אישי בכל טיפול",
    description:
      "מכון יופי מקומי עם טיפולים מקצועיים, אווירה נעימה, וקביעת תור בוואטסאפ.",
    services: [
      { id: "s1", title: "טיפול פנים", desc: "ניקוי עמוק + מסכה — כ־60 דקות", price: 220 },
      { id: "s2", title: "גבות וריסים", desc: "עיצוב מדויק לפי מבנה הפנים", price: 90 },
      { id: "s3", title: "מבצע חבילה", desc: "פנים + גבות במחיר משתלם", price: 280 },
    ],
    postHeadline: "העור שלכן מחכה לרענון קטן",
    postBody:
      "השבוע פתחנו מקומות אחרונים לטיפול פנים מרענן.\nכתבו בוואטסאפ — נמצא לכן שעה נוחה בלי לחץ.",
    postCta: "לקביעת תור בוואטסאפ",
  },
  cafe: {
    tagline: "קפה טרי, פינה חמה, וחיוך בכל כוס",
    description: "בית קפה שכונתי עם קפה איכותי, מאפים טריים, ואווירה ביתית.",
    services: [
      { id: "s1", title: "קפה + מאפה", desc: "שילוב הבוקר שלנו", price: 32 },
      { id: "s2", title: "ארוחת בוקר", desc: "צלחת מלאה לשניים", price: 89 },
      { id: "s3", title: "עוגת הבית", desc: "פרוסה טרייה כל יום", price: 28 },
    ],
    postHeadline: "בוקר טוב מתחיל אצלנו",
    postBody:
      "קפה טרי, מאפה חם, ומקום לשבת רגע לפני היום.\nשלחו הודעה בוואטסאפ להזמנה או שאלה — נשמח.",
    postCta: "להזמנה בוואטסאפ",
  },
  general: {
    tagline: "שירות מקומי שאפשר לסמוך עליו",
    description: "עסק מקומי עם יחס אישי, מחירים הוגנים, וזמינות בוואטסאפ.",
    services: [
      { id: "s1", title: "ייעוץ ראשוני", desc: "שיחה קצרה להבנת הצורך", price: 0 },
      { id: "s2", title: "שירות בסיסי", desc: "הפתרון הנפוץ ביותר אצלנו", price: 199 },
      { id: "s3", title: "חבילת פרימיום", desc: "ליווי מלא עד התוצאה", price: 399 },
    ],
    postHeadline: "השבוע פתחנו מקומות אחרונים",
    postBody:
      "אם חיפשתם שירות אמין ליד הבית — הגעתם למקום הנכון.\nכתבו בוואטסאפ ונחזור אליכם במהירות.",
    postCta: "לפרטים בוואטסאפ",
  },
};

const keywordMap = [
  { keys: ["מוסך", "רכב", "צמיג", "שמנים", "garage"], niche: "garage" },
  { keys: ["קוסמטיקה", "יופי", "פנים", "ציפורניים", "ספא", "beauty"], niche: "cosmetics" },
  { keys: ["קפה", "בית קפה", "מאפה", "ביסטרו", "מסעדה", "cafe"], niche: "cafe" },
];

/* ---- business-profile.ts ---- */
const profileTs = `/** Auto-generated — business profile + niche mock (UTF-8 via emitter) */
"use client";

import { useEffect, useState } from "react";
import { MY_PAGE } from "./mock-data";

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
> = ${JSON.stringify(
  {
    garage: niches.garage,
    cosmetics: niches.cosmetics,
    cafe: niches.cafe,
    general: niches.general,
  },
  null,
  2
)};

const KEYWORD_MAP: { keys: string[]; niche: NicheId }[] = ${JSON.stringify(keywordMap, null, 2)};

export function parseBusinessInput(raw: string): { businessName: string; city: string } {
  const cleaned = raw.trim().replace(/\\s+/g, " ");
  if (!cleaned) return { businessName: ${J("העסק שלי")}, city: "" };

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
  const base = \`\${businessName}-\${city || "il"}\`
    .toLowerCase()
    .replace(/[^\\u0590-\\u05FFa-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  // Prefer latin-ish slug for olar.me URLs when Hebrew-only
  if (!/[a-z0-9]/i.test(base)) {
    const hash = Math.abs(
      Array.from(businessName).reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    return \`biz-\${hash.toString(36)}\`;
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
  const cityBit = city ? \` ב\${city}\` : "";
  const body =
    \`\${niche.postBody}\\n\\n\${niche.postCta}: https://wa.me/\${waDigits}\\n\\n— \${businessName}\${cityBit}\`;

  return {
    businessName,
    city,
    niche: nicheId,
    slug,
    tagline: niche.tagline,
    description: niche.description,
    phone,
    whatsapp,
    services: niche.services,
    firstPost: {
      headline: niche.postHeadline,
      body,
      cta: niche.postCta,
      hashtags: [${J("#עסקמקומי")}, ${J("#אולרסושיאל")}, \`#\${businessName.replace(/\\s+/g, "")}\`],
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
      weekVisits: MY_PAGE.weekVisits,
      services: [...MY_PAGE.services],
      gallery: MY_PAGE.gallery,
    };
  }
  const cityQ = encodeURIComponent(p.city || p.businessName);
  return {
    slug: p.slug,
    url: \`olar.me/\${p.slug}\`,
    live: true,
    businessName: p.businessName,
    tagline: p.tagline,
    description: p.description,
    address: p.city || MY_PAGE.address,
    phone: p.phone,
    whatsapp: p.whatsapp,
    mapsUrl: \`https://maps.google.com/?q=\${cityQ}\`,
    wazeUrl: \`https://waze.com/ul?q=\${cityQ}\`,
    rating: MY_PAGE.rating,
    weekVisits: MY_PAGE.weekVisits,
    services: p.services,
    gallery: MY_PAGE.gallery,
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
`;

fs.writeFileSync("src/lib/olar/business-profile.ts", profileTs, "utf8");

/* ---- Onboarding.tsx ---- */
const onboardingTsx = `"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ONBOARDING_KEY,
  buildProfileFromInput,
  markOnboardingDone,
  saveProfile,
  type BusinessProfile,
} from "@/lib/olar/business-profile";
import { C } from "@/lib/olar/ui-copy";
import { MessageCircle, Phone, Sparkles, X } from "lucide-react";

export function useOnboardingGate() {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY) === "1";
      setShow(!done);
    } catch {
      setShow(true);
    }
    setReady(true);
  }, []);

  function complete() {
    markOnboardingDone();
    setShow(false);
  }

  return { ready, show, complete };
}

type Phase = "land" | "working" | "payoff";

const WORK_MS = 7000;
const LINE_MS = 2300;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("land");
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  const workLines = useMemo(
    () => [C.workLine1, C.workLine2, C.workLine3],
    []
  );

  useEffect(() => {
    if (phase !== "working") return;
    const lineTimer = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % workLines.length);
    }, LINE_MS);
    const doneTimer = window.setTimeout(() => {
      setPhase("payoff");
    }, WORK_MS);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(doneTimer);
    };
  }, [phase, workLines.length]);

  function startMagic() {
    const raw = input.trim() || C.landExampleFallback;
    const next = buildProfileFromInput(raw);
    setProfile(next);
    setLineIdx(0);
    setPhase("working");
  }

  function finishToApp() {
    if (profile) saveProfile(profile);
    markOnboardingDone();
    onDone();
  }

  const page = profile;
  const waDigits = page
    ? page.whatsapp.replace(/\\D/g, "").replace(/^0/, "972")
    : "972500000000";
  const fullUrl = page ? \`https://olar.me/\${page.slug}\` : "https://olar.me";

  function sendPostToSelf() {
    if (!page) return;
    const text = encodeURIComponent(
      \`\${page.firstPost.headline}\\n\\n\${page.firstPost.body}\\n\\n\${page.firstPost.hashtags.join(" ")}\`
    );
    window.open(\`https://wa.me/?text=\${text}\`, "_blank");
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6"
      dir="rtl"
    >
      {phase === "land" && (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col justify-center">
          <div className="space-y-6 text-center sm:text-right">
            <p className="text-sm font-semibold tracking-wide text-sky-600">
              Olar Social · olar.me
            </p>
            <h1
              className="text-3xl font-black leading-tight text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.landH1}
            </h1>
            <p className="text-lg leading-relaxed text-slate-700">{C.landSub}</p>
            <label className="block text-right">
              <span className="sr-only">{C.landInputLabel}</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startMagic();
                }}
                placeholder={C.landPlaceholder}
                className="min-h-16 w-full rounded-2xl border border-slate-300 bg-white px-5 text-lg text-slate-950 shadow-sm outline-none ring-sky-600/30 placeholder:text-slate-400 focus:border-sky-600 focus:ring-4"
              />
            </label>
            <button
              type="button"
              onClick={startMagic}
              className="olar-cta inline-flex min-h-14 w-full items-center justify-center rounded-full px-8 text-lg font-bold sm:w-auto"
            >
              {C.landCta}
            </button>
          </div>
        </div>
      )}

      {phase === "working" && (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-sky-200/70" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </span>
          </div>
          <p className="text-sm font-semibold text-sky-600">{C.workBadge}</p>
          <p
            key={lineIdx}
            className="min-h-[3.5rem] animate-rise text-xl font-bold text-slate-950 sm:text-2xl"
          >
            {workLines[lineIdx]}
          </p>
          <div className="flex gap-2">
            {workLines.map((_, i) => (
              <span
                key={i}
                className={\`h-2 w-8 rounded-full transition \${
                  i === lineIdx ? "bg-sky-600" : "bg-slate-200"
                }\`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "payoff" && page && (
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
          <header className="space-y-2 text-center sm:text-right">
            <p className="text-sm font-semibold text-sky-600">{C.payoffBadge}</p>
            <h2
              className="text-3xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.payoffTitle}
            </h2>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Phone bio mock */}
            <div className="flex justify-center">
              <div className="w-full max-w-[22rem] rounded-[2rem] border-[10px] border-slate-900 bg-slate-900 p-2 shadow-2xl">
                <div className="overflow-hidden rounded-[1.4rem] bg-white">
                  <div className="bg-gradient-to-br from-sky-500 to-sky-700 px-5 pb-8 pt-6 text-white">
                    <p dir="ltr" className="text-xs opacity-80">
                      olar.me/{page.slug}
                    </p>
                    <p className="mt-3 text-2xl font-black">{page.businessName}</p>
                    {page.city ? (
                      <p className="mt-1 text-sm text-sky-50">{page.city}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-sky-100">{page.tagline}</p>
                  </div>
                  <div className="space-y-4 px-4 py-5 text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {C.servicesTitle}
                    </p>
                    <ul className="space-y-2">
                      {page.services.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm font-semibold text-sky-700">
                            {s.price > 0
                              ? \`\${C.fromPrice}\${s.price} \${C.currencyIls}\`
                              : C.freeConsult}
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            {s.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={\`https://wa.me/\${waDigits}\`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {C.bioWaBtn}
                    </a>
                    <a
                      href={\`tel:\${page.phone}\`}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-900"
                    >
                      <Phone className="h-5 w-5 text-sky-600" />
                      {C.callAction}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* First post */}
            <div className="flex flex-col justify-center">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60">
                <p className="text-sm font-semibold text-sky-600">
                  {C.firstPostReady}
                </p>
                <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 via-sky-50 to-slate-100">
                  <div className="flex h-40 items-center justify-center text-sky-700">
                    <Sparkles className="h-10 w-10" />
                  </div>
                </div>
                <h3
                  className="mt-4 text-2xl font-bold text-slate-950"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {page.firstPost.headline}
                </h3>
                <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-800">
                  {page.firstPost.body}
                </p>
                <p className="mt-3 text-sm text-sky-700">
                  {page.firstPost.hashtags.join(" ")}
                </p>
                <button
                  type="button"
                  onClick={sendPostToSelf}
                  className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-bold text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {C.sendPostSelfWa}
                </button>
              </article>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="olar-cta inline-flex min-h-14 w-full max-w-xl items-center justify-center rounded-full px-8 text-lg font-bold"
            >
              {C.savePageCta}
            </button>
            <p dir="ltr" className="text-xs text-slate-500">
              {fullUrl}
            </p>
          </div>
        </div>
      )}

      {authOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={C.authModalTitle}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3
                className="text-xl font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {C.authModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {C.authModalBody}
            </p>
            <button
              type="button"
              onClick={finishToApp}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white text-base font-bold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-[#4285F4] shadow">
                G
              </span>
              {C.authGoogleBtn}
            </button>
            <button
              type="button"
              onClick={finishToApp}
              className="mt-3 min-h-12 w-full text-base font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              {C.authGuestBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("src/components/olar/Onboarding.tsx", onboardingTsx, "utf8");

/* ---- brand patches ---- */
function patchFile(path, replacer) {
  let src = fs.readFileSync(path, "utf8");
  const next = replacer(src);
  if (next !== src) {
    fs.writeFileSync(path, next, "utf8");
    return true;
  }
  return false;
}

const brandName = "אולר סושיאל";
const brandWrong = "עולר סושיאל";
const tagWrong = "#עולרסושיאל";
const tagRight = "#אולרסושיאל";

patchFile("src/lib/olar/mock-data.ts", (src) =>
  src
    .replaceAll(brandWrong, brandName)
    .replaceAll(tagWrong, tagRight)
    .replace(
      /export const BUSINESS_NAME = "[^"]*";/,
      `export const BUSINESS_NAME = ${J(brandName)};`
    )
);

patchFile("src/app/layout.tsx", (src) => {
  const title = `${brandName} — Olar Social`;
  const desc = `${brandName} — יונה AI, סטודיו, יומן, לידים ואנליטיקה במקום אחד · olar.me`;
  return src
    .replace(/title:\s*"[^"]*"/, `title: ${J(title)}`)
    .replace(/description:\s*\n?\s*"[^"]*"/, `description: ${J(desc)}`);
});

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.name !== "olar-social") {
  pkg.name = "olar-social";
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

const heOk =
  /[\u0590-\u05FF]/.test(fs.readFileSync("src/lib/olar/business-profile.ts", "utf8")) &&
  /[\u0590-\u05FF]/.test(fs.readFileSync("src/components/olar/Onboarding.tsx", "utf8"));

console.log("value-onboarding", heOk ? "HEBREW_OK" : "FAIL");
console.log("BUSINESS_NAME", brandName);
