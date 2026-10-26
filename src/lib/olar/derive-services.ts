/**
 * Derive bio services from user input — never invent numeric prices.
 */
import type { ProfileService } from "./business-profile";

type Hint = { keys: string[]; title: string; desc: string };

const HINTS: Hint[] = [
  {
    keys: ["חורף", "הכנה לחורף", "winter"],
    title: "\u05d4\u05db\u05e0\u05ea \u05e8\u05db\u05d1 \u05dc\u05d7\u05d5\u05e8\u05e3",
    desc: "\u05de\u05e6\u05d1\u05e8, \u05de\u05d2\u05d1\u05d9\u05dd \u05d5\u05e9\u05de\u05df \u2014 \u05ea\u05d9\u05d0\u05d5\u05dd \u05de\u05d4\u05d9\u05e8",
  },
  {
    keys: ["בלמ", "brake"],
    title: "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d1\u05dc\u05de\u05d9\u05dd",
    desc: "\u05d1\u05d3\u05d9\u05e7\u05d4 \u05d5\u05d9\u05d9\u05e2\u05d5\u05e5 \u05de\u05e7\u05e6\u05d5\u05e2\u05d9",
  },
  {
    keys: ["מגב", "wiper"],
    title: "\u05d1\u05d3\u05d9\u05e7\u05ea \u05de\u05d2\u05d1\u05d9\u05dd",
    desc: "\u05d4\u05d7\u05dc\u05e4\u05d4 / \u05d1\u05d3\u05d9\u05e7\u05d4 \u05dc\u05e4\u05e0\u05d9 \u05d4\u05d2\u05e9\u05dd",
  },
  {
    keys: ["שמן", "oil"],
    title: "\u05d4\u05d7\u05dc\u05e4\u05ea \u05e9\u05de\u05df",
    desc: "\u05e9\u05de\u05df + \u05de\u05e1\u05e0\u05df + \u05d1\u05d3\u05d9\u05e7\u05d4 \u05db\u05dc\u05dc\u05d9\u05ea",
  },
  {
    keys: ["פנים", "facial"],
    title: "\u05d8\u05d9\u05e4\u05d5\u05dc \u05e4\u05e0\u05d9\u05dd",
    desc: "\u05d8\u05d9\u05e4\u05d5\u05dc \u05de\u05e8\u05e2\u05e0\u05df \u05d1\u05d9\u05d7\u05e1 \u05d0\u05d9\u05e9\u05d9",
  },
  {
    keys: ["ציפורנ", "nail"],
    title: "\u05d8\u05d9\u05e4\u05d5\u05dc \u05e6\u05d9\u05e4\u05d5\u05e8\u05e0\u05d9\u05d9\u05dd",
    desc: "\u05e2\u05d9\u05e6\u05d5\u05d1 \u05d5\u05d8\u05d9\u05e4\u05d5\u05d7 \u05de\u05e7\u05e6\u05d5\u05e2\u05d9",
  },
  {
    keys: ["קפה", "coffee"],
    title: "\u05e7\u05e4\u05d4 \u05d5\u05de\u05d0\u05e4\u05d9\u05dd",
    desc: "\u05d4\u05d6\u05de\u05e0\u05d4 / \u05e9\u05d0\u05dc\u05d4 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  },
];

const DEFAULT_BY_NICHE: Record<string, ProfileService[]> = {
  garage: [
    {
      id: "s1",
      title: "\u05d4\u05db\u05e0\u05ea \u05e8\u05db\u05d1 \u05dc\u05d7\u05d5\u05e8\u05e3",
      desc: "\u05de\u05e6\u05d1\u05e8, \u05de\u05d2\u05d1\u05d9\u05dd \u05d5\u05e9\u05de\u05df",
      price: 0,
    },
    {
      id: "s2",
      title: "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d1\u05dc\u05de\u05d9\u05dd \u05d5\u05de\u05d2\u05d1\u05d9\u05dd",
      desc: "\u05d1\u05d3\u05d9\u05e7\u05d4 \u05de\u05d4\u05d9\u05e8\u05d4 \u05d5\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8",
      price: 0,
    },
  ],
  cosmetics: [
    {
      id: "s1",
      title: "\u05d8\u05d9\u05e4\u05d5\u05dc \u05e4\u05e0\u05d9\u05dd",
      desc: "\u05d9\u05d7\u05e1 \u05d0\u05d9\u05e9\u05d9 \u05d5\u05ea\u05d9\u05d0\u05d5\u05dd \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
      price: 0,
    },
    {
      id: "s2",
      title: "\u05d8\u05d9\u05e4\u05d5\u05dc\u05d9 \u05d9\u05d5\u05e4\u05d9",
      desc: "\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05d1\u05d4\u05d5\u05d3\u05e2\u05d4",
      price: 0,
    },
  ],
  cafe: [
    {
      id: "s1",
      title: "\u05e7\u05e4\u05d4 \u05d5\u05de\u05d0\u05e4\u05d9\u05dd",
      desc: "\u05d4\u05d6\u05de\u05e0\u05d4 \u05d0\u05d5 \u05e9\u05d0\u05dc\u05d4 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
      price: 0,
    },
  ],
  general: [
    {
      id: "s1",
      title: "\u05d9\u05d9\u05e2\u05d5\u05e5 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d9",
      desc: "\u05e9\u05d9\u05d7\u05d4 \u05e7\u05e6\u05e8\u05d4 \u05dc\u05d4\u05d1\u05e0\u05ea \u05d4\u05e6\u05d5\u05e8\u05da",
      price: 0,
    },
    {
      id: "s2",
      title: "\u05e9\u05d9\u05e8\u05d5\u05ea \u05de\u05e7\u05e6\u05d5\u05e2\u05d9",
      desc: "\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
      price: 0,
    },
  ],
};

/** Extract grounded price only if digits appear as currency in raw input. */
function extractGroundedPrice(raw: string): number {
  const m = raw.match(
    /(?:₪\s*(\d{1,6})|(\d{1,6})\s*(?:₪|ש["״']?\s*ח|שקלים?))/
  );
  if (!m) return 0;
  const n = Number(m[1] || m[2]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function deriveServicesFromInput(
  raw: string,
  nicheId: string
): ProfileService[] {
  const grounded = extractGroundedPrice(raw);
  const found: ProfileService[] = [];
  const lower = raw.toLowerCase();

  for (const hint of HINTS) {
    if (hint.keys.some((k) => lower.includes(k.toLowerCase()))) {
      found.push({
        id: `s${found.length + 1}`,
        title: hint.title,
        desc: hint.desc,
        price: grounded,
      });
    }
  }

  if (found.length > 0) return found.slice(0, 4);

  const defaults =
    DEFAULT_BY_NICHE[nicheId] || DEFAULT_BY_NICHE.general || [];
  return defaults.map((s) => ({ ...s, price: grounded || 0 }));
}

export function stripServicePrices(
  services: ProfileService[]
): ProfileService[] {
  return services.map((s) => ({ ...s, price: 0 }));
}

export function waMeHref(whatsapp: string): string {
  let d = whatsapp.replace(/\D/g, "");
  if (!d) return "https://wa.me/";
  if (d.startsWith("0")) d = "972" + d.slice(1);
  if (!d.startsWith("972")) d = "972" + d;
  return `https://wa.me/${d}`;
}
