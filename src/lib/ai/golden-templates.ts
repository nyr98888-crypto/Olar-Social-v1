/**
 * Golden (proven) post templates by niche — 100% valid GeneratedPostResponse.
 * Used when AI fails, times out (>4s), or fails pipeline validation.
 * Hebrew stored as UTF-8 in-source (never via PowerShell).
 */
import type { AgentOutput, GeneratedPostResponse } from "../../../schemas/agent";
import { disambiguateBusinessDomain } from "./hebrew-disambiguation";
import type { PostInputContext } from "./pipeline-validator";
import { NEUTRAL_PRICE_CTA } from "./guardrails";

export type GoldenNiche =
  | "garage"
  | "cosmetics"
  | "interior"
  | "restaurant"
  | "general";

type GoldenTpl = {
  headline: string;
  postText: string;
  callToAction: string;
  suggestedImagePrompt: string;
  chatReply: string;
  hashtags: string[];
};

const GOLDEN: Record<GoldenNiche, GoldenTpl> = {
  garage: {
    headline: "הרכב מוכן לחורף?",
    postText:
      "בדיקה כללית, שמן ומגבים — בלי הפתעות.\nכתבו בוואטסאפ ונמצא לכם שעה נוחה.",
    callToAction: "לתיאום והצעת מחיר בוואטסאפ",
    suggestedImagePrompt:
      "Authentic professional photo of a clean local auto service bay, organized tools, soft daylight, trustworthy small-business atmosphere, no text overlay, no logos",
    chatReply:
      "הכנתי לך פוסט מוכן למוסך — אפשר לערוך וללטש כרצונך.",
    hashtags: ["#מוסך", "#רכב", "#עסקמקומי"],
  },
  cosmetics: {
    headline: "העור שלכן מחכה לרענון קטן",
    postText:
      "טיפולי יופי ביחס אישי ובאווירה נעימה.\nכתבו בוואטסאפ — נמצא לכן שעה נוחה בלי לחץ.",
    callToAction: "לקביעת תור בוואטסאפ",
    suggestedImagePrompt:
      "Authentic beauty studio interior, soft natural light, clean towels and skincare ambiance, professional calm mood, no text overlay, no logos",
    chatReply:
      "הכנתי לך פוסט מוכן לעסק היופי — אפשר לערוך וללטש כרצונך.",
    hashtags: ["#יופי", "#קוסמטיקה", "#עסקמקומי"],
  },
  restaurant: {
    headline: "בוקר טוב מתחיל אצלנו",
    postText:
      "קפה טרי, אוכל חם, ומקום לשבת רגע לפני היום.\nשלחו הודעה בוואטסאפ להזמנה או שאלה — נשמח.",
    callToAction: "פרטים והזמנות בהודעה",
    suggestedImagePrompt:
      "Authentic casual restaurant or cafe food photography, warm daylight, inviting plated dish or coffee, cozy local atmosphere, no text overlay, no logos",
    chatReply:
      "הכנתי לך פוסט מוכן למסעדה/בית קפה — אפשר לערוך וללטש כרצונך.",
    hashtags: ["#אוכל", "#קפה", "#עסקמקומי"],
  },
  interior: {
    headline: "הבית שלכם מחכה לשדרוג",
    postText:
      "כל חלל מספר סיפור — בואו נתכנן יחד את הסיפור שלכם.\nכתבו לנו בוואטסאפ לפגישת ייעוץ ראשונית.",
    callToAction: "לתיאום ייעוץ בוואטסאפ",
    suggestedImagePrompt:
      "Award-winning modern interior architecture, elegant open-space living room, bespoke furniture, soft architectural ambient lighting, architectural photography, hyper-realistic, 8k, professional portfolio shot, no text overlay, no logos",
    chatReply:
      "הכנתי לך פוסט מוכן לעסק עיצוב הפנים — אפשר לערוך וללטש כרצונך.",
    hashtags: ["#עיצובפנים", "#אדריכלות", "#עסקמקומי"],
  },
  general: {
    headline: "השבוע פתחנו מקומות אחרונים",
    postText:
      "אם חיפשתם שירות אמין ליד הבית — הגעתם למקום הנכון.\nכתבו בוואטסאפ ונחזור אליכם במהירות.",
    callToAction: "לתיאום והצעת מחיר בוואטסאפ",
    suggestedImagePrompt:
      "Authentic professional commercial photography for a local Israeli small business, clean contemporary lighting, real work context, no text overlay, no watermarks",
    chatReply:
      "הכנתי לך פוסט מוכן לעסק — אפשר לערוך וללטש כרצונך.",
    hashtags: ["#עסקמקומי", "#OneLoopSocial"],
  },
};

/**
 * Interior compound phrases FIRST — prevents "עיצוב פנים" matching cosmetics.
 * Bare "פנים" removed from cosmetics; explicit beauty words only.
 */
const KEYWORD_MAP: { keys: string[]; niche: GoldenNiche }[] = [
  {
    keys: [
      "אדריכלות פנים", "עיצוב פנים", "מעצב פנים", "מעצבת פנים",
      "עיצוב חללים", "אדריכל פנים", "interior design", "interior architecture",
    ],
    niche: "interior",
  },
  {
    keys: ["מוסך", "רכב", "garage", "צמיג", "מכונאי", "שמן מנוע"],
    niche: "garage",
  },
  {
    keys: [
      "קוסמט", "מכון יופי", "קליניקה אסתטית", "בוטוקס",
      "הסרת שיער", "ציפורניים", "ספא", "עור", "יופי", "beauty",
    ],
    niche: "cosmetics",
  },
  {
    keys: [
      "מסעדה", "קפה", "cafe", "restaurant",
      "אוכל", "מאפה", "פיצה", "סושי",
    ],
    niche: "restaurant",
  },
];

const DOMAIN_TO_GOLDEN: Record<string, GoldenNiche> = {
  interior: "interior",
  cosmetics: "cosmetics",
  garage: "garage",
  cafe: "restaurant",
  salon: "general",
  painting: "general",
  accountant: "general",
  locksmith: "general",
};

export function detectGoldenNiche(raw: string): GoldenNiche {
  const hit = disambiguateBusinessDomain({ text: raw, niche: raw });
  if (hit) {
    const mapped = DOMAIN_TO_GOLDEN[hit.domain.nicheId];
    if (mapped) return mapped;
  }
  const lower = (raw || "").toLowerCase();
  for (const row of KEYWORD_MAP) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()))) return row.niche;
  }
  return "general";
}

function waDigits(ctx: PostInputContext): string | null {
  const raw = ctx.whatsapp || ctx.phone || "";
  let d = raw.replace(/\D/g, "");
  if (!d || /0{6,}/.test(d)) return null;
  if (d.startsWith("972")) return d;
  if (d.startsWith("0") && d.length >= 9) return `972${d.slice(1)}`;
  if (d.length === 9 && d.startsWith("5")) return `972${d}`;
  return d.length >= 9 ? d : null;
}

/**
 * Build a fully valid GeneratedPostResponse from a golden niche template.
 */
export function buildGoldenPost(
  ctx: PostInputContext,
  niche?: GoldenNiche
): GeneratedPostResponse {
  const id = niche ?? detectGoldenNiche(ctx.rawPrompt || ctx.niche || "");
  const tpl = GOLDEN[id];
  const name = ctx.businessName?.trim();
  const city = ctx.city?.trim();
  const wa = waDigits(ctx);
  const cta = tpl.callToAction || NEUTRAL_PRICE_CTA;

  let postText = tpl.postText;
  if (name) {
    postText = `${postText}\n\n— ${name}${city ? ` ב${city}` : ""}`;
  }
  if (wa) {
    postText = `${postText}\n${cta}: https://wa.me/${wa}`;
  } else {
    postText = `${postText}\n${cta}`;
  }

  return {
    headline: tpl.headline,
    postText,
    suggestedImagePrompt: tpl.suggestedImagePrompt,
    callToAction: cta,
    hasExplicitPrice: false,
  };
}

/** Full AgentOutput from golden template — always campaign_request, no invented prices. */
export function buildGoldenAgentOutput(
  ctx: PostInputContext = { rawPrompt: "" },
  niche?: GoldenNiche
): AgentOutput {
  const id = niche ?? detectGoldenNiche(ctx.rawPrompt || ctx.niche || "");
  const tpl = GOLDEN[id];
  const post = buildGoldenPost(ctx, id);
  const nameTag = ctx.businessName?.trim()
    ? `#${ctx.businessName.trim().replace(/\s+/g, "")}`
    : null;

  return {
    chat_reply: tpl.chatReply,
    intent: "campaign_request",
    social_post: {
      headline: post.headline,
      body: post.postText,
      hashtags: [...tpl.hashtags, ...(nameTag ? [nameTag] : [])].slice(0, 5),
      call_to_action: post.callToAction,
      has_explicit_price: false,
    },
    image_task: {
      generate_image: false,
      prompt: post.suggestedImagePrompt,
      aspect_ratio: "1:1",
    },
  };
}
