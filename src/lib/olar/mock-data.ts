import type {
  CalendarEvent,
  CampaignStat,
  ContentIdea,
  IntegrationId,
  Lead,
  NetworkPostCompare,
  ReviewItem,
  TickerItem,
} from "./types";

export const BUSINESS_NAME = "One Loop Social";
export const OWNER_NAME = "ניר";

/** Direct links for asking reviews (demo) */
export const REVIEW_LINKS = {
  google: "https://g.page/r/DEMO-OLAR-GOOGLE/review",
  easy: "https://easy.co.il/page/demo-olar",
};

/** Hard-gated: never surface fake KPIs to guests. UI uses empty ticker. */
export const TICKER_ITEMS: TickerItem[] = [];

export const QUICK_ACTIONS = [
  { id: "post", label: "תנו לסוכן שיווק AI לכתוב פוסט", view: "yona" as const },
  { id: "story", label: "סטורי או רילס קצר", view: "yona" as const },
  { id: "leads", label: "מי פנה אליי?", view: "leads" as const },
  { id: "studio", label: "תמונה יפה לעסק", view: "studio" as const },
];

/** Guest / empty DB — zeros only. Never leak demo 12 / 47 / 5. */
export const DASHBOARD_STATS = [
  { label: "פנו אליי השבוע", value: "0", delta: "", good: true },
  { label: "ימים בלי פוסט", value: "0", delta: "", good: false },
  { label: "לחצו לוואטסאפ", value: "0", delta: "", good: true },
  { label: "איפה הכי ראו אותי", value: "—", delta: "", good: true },
];

/** No seeded idea cards — UI never hydrates guests with canned posts. */
export const CONTENT_IDEAS: ContentIdea[] = [];

/** No mock leads — guests see empty state only. */
export const LEADS: Lead[] = [];

export const REVIEWS_SUMMARY = {
  average: 0,
  count: 0,
  sources: "",
};

export const REVIEWS: ReviewItem[] = [];

/** Guest calendar starts empty — no seeded mock events. */
export const CALENDAR_EVENTS: CalendarEvent[] = [];

/** No demo campaign KPIs. */
export const CAMPAIGNS: CampaignStat[] = [];

export const NETWORK_COMPARE: NetworkPostCompare[] = [];

/** Primary analytics tabs: Google, WhatsApp, Facebook, Instagram, Easy */
export const ANALYTICS_NETWORKS: IntegrationId[] = [
  "google",
  "whatsapp",
  "facebook",
  "instagram",
  "pinterest",
  "easy",
];

export const WEEK_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export const WEEKLY_ACTIVITY = [0, 0, 0, 0, 0, 0, 0];

export const YONA_STARTER_MESSAGES = [
  {
    role: "assistant" as const,
    content:
      "היי, אני סוכן שיווק AI. אין לך רעיון לפוסט? לחצו על אחת ההצעות למטה — או פשוט כתבו לי במילים שלכם מה קורה בעסק.",
  },
];

/** Empty shell — never surface as a live guest preview. */
export const DEMO_POST = {
  headline: "",
  body: "",
  hashtags: [] as string[],
};

export const PLATFORM_COPY: Record<
  string,
  {
    label: string;
    maxChars: number;
    hook: string;
    hashtags: string[];
    contact: string;
  }
> = {
  facebook: {
    label: "פייסבוק",
    maxChars: 420,
    hook: "שאלה פשוטה לקהל",
    hashtags: ["#עסקמקומי", "#קהילה"],
    contact: "שלחו הודעה לעמוד או התקשרו",
  },
  instagram: {
    label: "אינסטגרם",
    maxChars: 280,
    hook: "משפט ראשון שתופס",
    hashtags: ["#אינסטגרםעסקי", "#עסקמקומי"],
    contact: "לינק בביו · וואטסאפ בכפתור",
  },
  twitter: {
    label: "X",
    maxChars: 240,
    hook: "משפט חד וקצר",
    hashtags: ["#עסקמקומי"],
    contact: "אפשר לשלוח הודעה פרטית",
  },
  reels: {
    label: "רילס",
    maxChars: 160,
    hook: "3 שניות ראשונות עם תנועה",
    hashtags: ["#רילס", "#וידאוקצר"],
    contact: "החלקה לוואטסאפ",
  },
  google: {
    label: "גוגל עסקים",
    maxChars: 300,
    hook: "מבצע מקומי קצר",
    hashtags: ["#עסקמקומי"],
    contact: "התקשרו או שלחו הודעה",
  }

};

export const NETWORKS = [
  { id: "facebook" as const, label: "פייסבוק" },
  { id: "instagram" as const, label: "אינסטגרם" },
  { id: "google" as const, label: "גוגל עסקים" },
  { id: "twitter" as const, label: "X" },
  { id: "reels" as const, label: "רילס" },
];

export const AUTOMATION_MODES = [
  {
    id: "semi" as const,
    label: "אני מאשר/ת לפני פרסום",
    desc: "סוכן שיווק AI מציע — אתם לוחצים אישור",
  },
  {
    id: "hybrid" as const,
    label: "יחד עורכים",
    desc: "מתקנים ביחד ואז מעלים",
  },
  {
    id: "full" as const,
    label: "סוכן שיווק AI מפרסם לבד לפי לוח",
    desc: "לפי מה שקבעתם ביומן",
  },
];

export const INTEGRATION_LIST: IntegrationId[] = [
  "google",
  "whatsapp",
  "facebook",
  "instagram",
  "easy",
  "tiktok",
  "twitter",
  "telegram",
  "pinterest",
];

export const CONNECTED_DEFAULT: Record<
  IntegrationId,
  {
    connected: boolean;
    handle: string;
    phone: string;
    kind: "business" | "personal" | null;
    pageUrl: string;
  }
> = {
  google: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  whatsapp: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  facebook: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  instagram: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  easy: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  tiktok: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  twitter: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  telegram: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  pinterest: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
};

export function buildAskReviewMessage(businessName: string) {
  return (
    `היי! מקווים שנהניתם אצל ${businessName} 🙂\n` +
    `אם בא לכם — דקה אחת של המלצה עוזרת לנו מאוד:\n` +
    `גוגל: ${REVIEW_LINKS.google}\n` +
    `איזי: ${REVIEW_LINKS.easy}\n` +
    `תודה מראש!`
  );
}

/** Empty shell — never hydrate guests with demo garage / fake visits. */
export const MY_PAGE = {
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
  rating: 0,
  weekVisits: 0,
  services: [] as const,
  gallery: [] as const,
} as const;

export function reviewReplySuggestion(stars: number, author: string) {
  if (stars >= 4) {
    return `תודה רבה ${author}! שמחנו מאוד לקרוא. נשמח לראות אתכם שוב בקרוב 🙂`;
  }
  return `היי ${author}, תודה שכתבתם. מצטערים שהחוויה לא הייתה מושלמת — נשמח לשמוע פרטים בוואטסאפ ולתקן. חשוב לנו שתהיו מרוצים.`;
}
