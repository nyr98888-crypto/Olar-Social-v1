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

export const BUSINESS_NAME = "אולר סושיאל";
export const OWNER_NAME = "ניר";

/** Direct links for asking reviews (demo) */
export const REVIEW_LINKS = {
  google: "https://g.page/r/DEMO-OLAR-GOOGLE/review",
  easy: "https://easy.co.il/page/demo-olar",
};

export const TICKER_ITEMS: TickerItem[] = [
  { id: "1", text: "12 אנשים כתבו בוואטסאפ השבוע", tone: "good" },
  { id: "2", text: "לא העליתם פוסט כבר 5 ימים — כדאי לפרסם משהו קטן", tone: "warn" },
  { id: "3", text: "באינסטגרם ראו אתכם יותר ב־34% מהשבוע שעבר", tone: "good" },
  { id: "4", text: "פורים מתקרב — שווה להכין משהו מראש", tone: "info" },
  { id: "5", text: "3 אנשים מחכים לתשובה יותר מיום", tone: "warn" },
  { id: "6", text: "הסטורי מאתמול: 420 צפיות", tone: "info" },
];

export const QUICK_ACTIONS = [
  { id: "post", label: "תנו לסוכן שיווק AI לכתוב פוסט", view: "yona" as const },
  { id: "story", label: "סטורי או רילס קצר", view: "yona" as const },
  { id: "leads", label: "מי פנה אליי?", view: "leads" as const },
  { id: "studio", label: "תמונה יפה לעסק", view: "studio" as const },
];

export const DASHBOARD_STATS = [
  { label: "פנו אליי השבוע", value: "12", delta: "+3", good: true },
  { label: "ימים בלי פוסט", value: "5", delta: "כדאי לפרסם", good: false },
  { label: "לחצו לוואטסאפ", value: "47", delta: "+12%", good: true },
  { label: "איפה הכי ראו אותי", value: "אינסטגרם", delta: "רוב התנועה", good: true },
];

export const CONTENT_IDEAS: ContentIdea[] = [
  {
    id: "winter-car",
    title: "מבצע הכנת רכב לחורף",
    blurb: "למוסך / רכב — מבצע פשוט עם קריאה לוואטסאפ",
    headline: "החורף כבר פה — הרכב מוכן?",
    body: "בדיקת מצבר, מגבים ושמן לפני הגשם.\nהשאירו הודעה בוואטסאפ ונשמח לתאם לכם שעה נוחה — בלי לחץ ובלי אותיות קטנות.",
    hashtags: ["#מוסך", "#הכנתחורף", "#רכב"],
  },
  {
    id: "skin-tip",
    title: "טיפ מהיר לשמירה על עור הפנים",
    blurb: "לקוסמטיקאית — טיפ קצר שמרגיש אנושי",
    headline: "טיפ קטן לעור בריא היום",
    body: "לפני האיפור: ניקוי עדין + לחות. זהו.\nרוצות שנבחר יחד מוצר שמתאים בדיוק לעור שלכן? כתבו בוואטסאפ.",
    hashtags: ["#קוסמטיקה", "#טיפיופי", "#עור"],
  },
  {
    id: "happy-client",
    title: "סיפור לקוח מרוצה",
    blurb: "לכל עסק — המלצה אמיתית שמביאה אנשים",
    headline: "לקוח יצא מרוצה — וזה מה שכתב לנו",
    body: "\"הרגשתי שטיפלו בי כמו בן אדם, לא כמו מספר.\"\nתודה על האמון. רוצים גם אתם? שלחו הודעה בוואטסאפ ונחזור אליכם מהר.",
    hashtags: ["#המלצה", "#לקוחותמרוצים", "#עסקמקומי"],
  },
];

export const LEADS: Lead[] = [
  {
    id: "l1",
    name: "נועה כהן",
    source: "אינסטגרם",
    network: "instagram",
    message: "היי, מחפשת טיפול פנים — יש תור השבוע?",
    status: "new",
    timeAgo: "לפני שעתיים",
    phone: "050-1234567",
    replies: {
      book: "היי נועה! בטח. מחר ב־16:00 או יום חמישי ב־11:00 — מה נוח לך? אשמור לך מקום.",
      price: "היי נועה 🙂 טיפול פנים בסיסי 280 ש״ח, עם מסכה משודרגת 350. רוצה שאפרט מה כלול?",
      ask: "היי נועה! כדי להתאים לך — זה לטיפול פנים רגיל, או משהו ספציפי (אקנה / זוהר לפני אירוע)?",
    },
  },
  {
    id: "l2",
    name: "יוסי לוי",
    source: "פייסבוק",
    network: "facebook",
    message: "כמה עולה טיפול לטנדר לפני החורף?",
    status: "new",
    timeAgo: "לפני 4 שעות",
    phone: "054-1112233",
    replies: {
      book: "היי יוסי, אפשר מחר בבוקר או ביום רביעי אחה״צ. איזה יום יותר נוח?",
      price: "היי יוסי, חבילת חורף לטנדר בדרך כלל 450–650 ש״ח לפי מה שצריך. רוצה הצעה מדויקת אחרי בדיקה קצרה?",
      ask: "היי יוסי! איזה שנתון הטנדר, ויש נורה/רעש/משהו ספציפי שמטריד?",
    },
  },
  {
    id: "l3",
    name: "מיכל אברהם",
    source: "וואטסאפ",
    network: "whatsapp",
    message: "רוצה תספורת + צבע — מתי פנוי?",
    status: "active",
    timeAgo: "אתמול",
    phone: "052-9876543",
    replies: {
      book: "היי מיכל! יש לי מחר ב־15:30 או ביום ראשון ב־10:00. מה עדיף?",
      price: "היי מיכל, תספורת + צבע בדרך כלל מ־320 ש״ח (תלוי באורך). רוצה שאשלח דוגמאות?",
      ask: "היי מיכל! זה צבע מלא או גוונים? ואורך השיער בערך עד איפה?",
    },
  },
  {
    id: "l4",
    name: "דני שפירא",
    source: "טיקטוק",
    network: "tiktok",
    message: "ראיתי את הסרטון — יש לכם תורים בשישי?",
    status: "active",
    timeAgo: "לפני יומיים",
    phone: "053-4445566",
    replies: {
      book: "היי דני, בשישי אנחנו עד 13:00. רוצה 11:00 או 12:00?",
      price: "היי דני 🙂 מחיר ביקור ראשון לפי מה שצריך — אשמח לתת מספר מדויק אחרי הודעה קצרה מה אתה מחפש.",
      ask: "היי דני! מה ראית בסרטון שמצא חן בעיניך — שנדע להתאים?",
    },
  },
  {
    id: "l5",
    name: "רותם גולן",
    source: "וואטסאפ",
    network: "whatsapp",
    message: "תודה! קבענו לחודש הבא",
    status: "closed",
    timeAgo: "לפני שבוע",
    phone: "050-7778899",
    replies: {
      book: "מעולה רותם, רשום אצלנו. נשלח תזכורת יום לפני.",
      price: "בשמחה — אם תרצי לעדכן משהו בחבילה לפני התור, רק תגידי.",
      ask: "רק לוודא — עדיין אותו שירות כמו שדיברנו?",
    },
  },
  {
    id: "l6",
    name: "איתי ברק",
    source: "אינסטגרם",
    network: "instagram",
    message: "הייתי אצלכם — תודה רבה!",
    status: "closed",
    timeAgo: "לפני 10 ימים",
    replies: {
      book: "כיף לשמוע איתי! רוצה שנקבע תור חוזר?",
      price: "תודה על המילים. אם חברים שואלים — נשמח עליך.",
      ask: "אפשר לבקש ממך המלצה קצרה בגוגל? זה מאוד עוזר לעסק קטן כמו שלנו.",
    },
  },
];

export const REVIEWS_SUMMARY = {
  average: 4.9,
  count: 84,
  sources: "גוגל ואיזי",
};

export const REVIEWS: ReviewItem[] = [
  {
    id: "r1",
    author: "שירה מ.",
    source: "google",
    stars: 5,
    text: "יחס מדהים, יצאתי עם תוצאה מדויקת כמו שרציתי. ממליצה בחום!",
    timeAgo: "לפני יומיים",
  },
  {
    id: "r2",
    author: "אורי כ.",
    source: "easy",
    stars: 5,
    text: "תיקנו מהר, הסבירו בבהירות, מחיר הוגן. עוד אחזור.",
    timeAgo: "לפני 5 ימים",
  },
  {
    id: "r3",
    author: "דנה ל.",
    source: "google",
    stars: 3,
    text: "השירות בסדר אבל חיכיתי יותר ממה שציפיתי. ציפיתי לעדכון בדרך.",
    timeAgo: "לפני שבוע",
  },
  {
    id: "r4",
    author: "משה ר.",
    source: "easy",
    stars: 4,
    text: "מקצועיים. רק חניה קצת מסובכת באזור.",
    timeAgo: "לפני שבועיים",
  },
];

export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "e1",
    title: "פוסט מבצע לחורף",
    date: "2026-10-27",
    type: "post",
    network: "אינסטגרם",
    publishTime: "09:30",
    body: "החורף כבר פה — בדקו מצבר ומגבים אצלנו. כתבו בוואטסאפ לתיאום.",
    suggestion: "תמונה פשוטה + משפט קצר + כפתור לוואטסאפ.",
  },
  {
    id: "e2",
    title: "סרטון קצר מאחורי הקלעים",
    date: "2026-10-28",
    type: "post",
    network: "רילס",
    publishTime: "18:00",
    body: "15 שניות מהשטח — בלי מוזיקה רועשת.",
    suggestion: "15 שניות מהעבודה בשטח — בלי מוזיקה רועשת מדי.",
  },
  {
    id: "e3",
    title: "תזכורת: שקט כבר 5 ימים",
    date: "2026-10-26",
    type: "reminder",
    suggestion: "העלו היום סטורי אחד — אפילו תמונה מהטלפון.",
  },
  {
    id: "e4",
    title: "יום העצמאות — רעיון לפוסט",
    date: "2026-04-22",
    type: "holiday",
    suggestion: "ברכה קצרה מהעסק + שעות פתיחה בחג.",
  },
  {
    id: "e5",
    title: "סטורי שאלות מהלקוחות",
    date: "2026-10-30",
    type: "post",
    network: "אינסטגרם",
    publishTime: "12:00",
    body: "שאלה אחת לקהל היום — ונענה מחר בפוסט.",
    suggestion: "שאלה אחת לקהל — ותשובה למחרת בפוסט.",
  },
  {
    id: "e6",
    title: "פורים — רעיון כיפי",
    date: "2026-03-03",
    type: "holiday",
    suggestion: "תמונה בתחפושת קלה + הנחה קטנה ליום החג.",
  },
  {
    id: "e7",
    title: "פוסט המלצות בפייסבוק",
    date: "2026-11-02",
    type: "post",
    network: "פייסבוק",
    publishTime: "10:15",
    body: "ציטוט לקוח אמיתי + קישור מהיר לוואטסאפ.",
    suggestion: "ציטוט לקוח אמיתי + קישור לוואטסאפ.",
  },
  {
    id: "e8",
    title: "חנוכה — תוכן חגיגי",
    date: "2026-12-14",
    type: "holiday",
    suggestion: "ברכה פשוטה + מבצע קטן לימי החג.",
  },
  {
    id: "e9",
    title: "סטטוס בוואטסאפ",
    date: "2026-10-29",
    type: "post",
    network: "וואטסאפ",
    publishTime: "08:00",
    body: "סטטוס עם תמונה מהיום — כתבו לי כאן.",
    suggestion: "סטטוס עם תמונה מהיום + ״כתבו לי כאן״.",
  },
];

export const CAMPAIGNS: CampaignStat[] = [
  {
    id: "c1",
    name: "מבצע חורף",
    networkId: "facebook",
    network: "פייסבוק",
    clicks: 312,
    waClicks: 48,
    inquiries: 19,
    calls: 11,
    maps: 7,
    reach: 8200,
    engagement: 4.2,
    postsUsed: 8,
    postsPotential: 16,
  },
  {
    id: "c2",
    name: "סרטון מוצר חדש",
    networkId: "instagram",
    network: "אינסטגרם",
    clicks: 540,
    waClicks: 91,
    inquiries: 34,
    calls: 9,
    maps: 14,
    reach: 15400,
    engagement: 6.8,
    postsUsed: 12,
    postsPotential: 20,
  },
  {
    id: "c3",
    name: "סטוריז השבוע",
    networkId: "instagram",
    network: "אינסטגרם",
    clicks: 188,
    waClicks: 22,
    inquiries: 8,
    calls: 3,
    maps: 2,
    reach: 4100,
    engagement: 3.1,
    postsUsed: 12,
    postsPotential: 20,
  },
  {
    id: "c4",
    name: "סרטון בטיקטוק",
    networkId: "tiktok",
    network: "טיקטוק",
    clicks: 720,
    waClicks: 35,
    inquiries: 14,
    calls: 4,
    maps: 5,
    reach: 28900,
    engagement: 8.4,
    postsUsed: 6,
    postsPotential: 16,
  },
  {
    id: "c5",
    name: "עדכונים בגוגל",
    networkId: "google",
    network: "גוגל עסקים",
    clicks: 96,
    waClicks: 41,
    inquiries: 27,
    calls: 22,
    maps: 38,
    reach: 2100,
    engagement: 5.0,
    postsUsed: 4,
    postsPotential: 12,
  },
  {
    id: "c6",
    name: "הודעות וואטסאפ",
    networkId: "whatsapp",
    network: "וואטסאפ",
    clicks: 210,
    waClicks: 210,
    inquiries: 55,
    calls: 18,
    maps: 3,
    reach: 900,
    engagement: 12,
    postsUsed: 10,
    postsPotential: 20,
  },
  {
    id: "c7",
    name: "פרופיל איזי",
    networkId: "easy",
    network: "איזי",
    clicks: 142,
    waClicks: 28,
    inquiries: 19,
    calls: 11,
    maps: 17,
    reach: 1800,
    engagement: 4.6,
    postsUsed: 3,
    postsPotential: 8,
  },
];

export const NETWORK_COMPARE: NetworkPostCompare[] = [
  {
    networkId: "facebook",
    strongest: { title: "המלצת לקוח", reach: 4200, engagement: 7.1 },
    weakest: { title: "עדכון שעות בלי תמונה", reach: 480, engagement: 0.9 },
  },
  {
    networkId: "instagram",
    strongest: { title: "סרטון מהשטח", reach: 9800, engagement: 9.2 },
    weakest: { title: "לינק יבש בסטורי", reach: 620, engagement: 1.2 },
  },
  {
    networkId: "tiktok",
    strongest: { title: "סרטון קצר 15 שניות", reach: 22000, engagement: 11.4 },
    weakest: { title: "סרטון בלי קריאה לפעולה", reach: 1100, engagement: 2.0 },
  },
  {
    networkId: "google",
    strongest: { title: "מבצע מקומי", reach: 1400, engagement: 6.0 },
    weakest: { title: "תמונה בלי טקסט", reach: 210, engagement: 0.4 },
  },
  {
    networkId: "whatsapp",
    strongest: { title: "סטטוס מבצע יומי", reach: 640, engagement: 18 },
    weakest: { title: "הודעה כללית ארוכה", reach: 120, engagement: 3 },
  },
  {
    networkId: "twitter",
    strongest: { title: "טיפ קצר", reach: 1800, engagement: 4.5 },
    weakest: { title: "לינק בלי הסבר", reach: 90, engagement: 0.3 },
  },
  {
    networkId: "telegram",
    strongest: { title: "עדכון לקבוצה", reach: 520, engagement: 8 },
    weakest: { title: "הודעה ארוכה מדי", reach: 80, engagement: 1 },
  },
  {
    networkId: "pinterest",
    strongest: { title: "לוח השראה", reach: 3100, engagement: 5.2 },
    weakest: { title: "תמונה בלי תיאור", reach: 140, engagement: 0.5 },
  },
  {
    networkId: "easy",
    strongest: { title: "כרטיס עסק מלא", reach: 1200, engagement: 6.2 },
    weakest: { title: "פרופיל בלי תמונות", reach: 180, engagement: 0.8 },
  },
];

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

export const WEEKLY_ACTIVITY = [2, 0, 1, 0, 0, 0, 0];

export const YONA_STARTER_MESSAGES = [
  {
    role: "assistant" as const,
    content:
      "היי, אני סוכן שיווק AI. אין לך רעיון לפוסט? לחצו על אחת ההצעות למטה — או פשוט כתבו לי במילים שלכם מה קורה בעסק.",
  },
];

export const DEMO_POST = {
  headline: "הגיע הזמן שיראו אתכם ברשת",
  body: "עסק שלא מפרסם — אנשים שוכחים.\nהנה משהו קצר ואמיתי מהשבוע שלנו.\n\nכתבו בוואטסאפ ונשמח לעזור.",
  hashtags: ["#עסקמקומי", "#אולרסושיאל"],
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

export const MY_PAGE = {
  slug: "moti-garage",
  url: "olar.me/moti-garage",
  live: true,
  businessName: "מוטי מוסך",
  tagline: "תיקוני רכב באהבה — בלי הפתעות",
  description: "מוסך שכונתי עם שירות מהיר, מחירים הוגנים, וזמינות בוואטסאפ.",
  address: "רחוב התעשייה 12, ראשון לציון",
  phone: "050-0000000",
  whatsapp: "0500000000",
  mapsUrl: "https://maps.google.com/?q=Rosh+HaAyin",
  wazeUrl: "https://waze.com/ul?q=Rosh%20HaAyin",
  rating: 4.9,
  weekVisits: 186,
  services: [
    {
      id: "s1",
      title: "בדיקת חורף",
      desc: "מצבר, מגבים ושמן — עד 45 דקות",
      price: 0,
    },
    {
      id: "s2",
      title: "החלפת שמן",
      desc: "שמן + מסנן + בדיקה כללית",
      price: 0,
    },
    {
      id: "s3",
      title: "אבחון קדם",
      desc: "בלמים + דיסקים — תאום מהיר",
      price: 0,
    },
  ],
  gallery: [
    {
      id: "g1",
      label: "עבודה בשטח",
      tone: "from-slate-600 to-slate-800",
      photo:
        "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=400&fit=crop",
    },
    {
      id: "g2",
      label: "רכב מוכן",
      tone: "from-amber-500 to-orange-600",
      photo:
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=400&fit=crop",
    },
    {
      id: "g3",
      label: "צוות הצלחה",
      tone: "from-sky-500 to-blue-700",
      photo:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=400&fit=crop",
    },
    {
      id: "g4",
      label: "לקוח מרוצה",
      tone: "from-emerald-500 to-teal-700",
      photo:
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=400&fit=crop",
    },
  ],
} as const;

export function reviewReplySuggestion(stars: number, author: string) {
  if (stars >= 4) {
    return `תודה רבה ${author}! שמחנו מאוד לקרוא. נשמח לראות אתכם שוב בקרוב 🙂`;
  }
  return `היי ${author}, תודה שכתבתם. מצטערים שהחוויה לא הייתה מושלמת — נשמח לשמוע פרטים בוואטסאפ ולתקן. חשוב לנו שתהיו מרוצים.`;
}
