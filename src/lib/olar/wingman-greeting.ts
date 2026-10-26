/**
 * Proactive Maya Wingman greeting templates (Israel timezone).
 */

import type { PostTypeId } from "@/lib/olar/post-types";
import type {
  MarketingWin,
  UserMarketingProfile,
} from "@/lib/olar/user-marketing-profile";

export const WINGMAN_GREETED_KEY = "olar-wingman-greeted";
export const WINGMAN_CHIP_PREFILL_KEY = "olar-wingman-chip-prefill";

export type WingmanGreetingChip = {
  id: string;
  label: string;
  postType: PostTypeId;
};

export const WINGMAN_GREETING_CHIPS: WingmanGreetingChip[] = [
  {
    id: "win",
    label: "🏆 קרה לי משהו מעולה בעסק",
    postType: "milestone",
  },
  {
    id: "client",
    label: "🤝 יש לי לקוח מרוצה לשתף",
    postType: "client_satisfaction",
  },
  {
    id: "field",
    label: "📸 יש לי תמונה מהשטח",
    postType: "before_after",
  },
  {
    id: "leads",
    label: "🏷️ אני רוצה להביא לקוחות חדשים",
    postType: "promotion",
  },
];

export type JerusalemClock = {
  day: number; // 0=Sun … 6=Sat
  hour: number;
  isoDate: string;
};

/** Current wall clock in Asia/Jerusalem (no deps). */
export function getJerusalemClock(now = new Date()): JerusalemClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const day = weekdayMap[map.weekday || ""] ?? now.getDay();
  let hour = Number(map.hour);
  if (!Number.isFinite(hour)) hour = now.getHours();
  // Intl sometimes yields "24" for midnight
  if (hour === 24) hour = 0;

  return {
    day,
    hour,
    isoDate: `${map.year}-${map.month}-${map.day}`,
  };
}

function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = now.getTime() - then.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function firstName(owner: string | null | undefined): string {
  const raw = (owner || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0] || raw;
}

function winText(w: MarketingWin): string {
  return typeof w === "string" ? w : w.text;
}

export function buildWingmanGreeting(opts: {
  profile: UserMarketingProfile | null;
  /** Fallback owner name from profiles / session */
  ownerName?: string | null;
  /** Fallback business name from page / business_profile */
  businessName?: string | null;
  now?: Date;
}): string {
  const now = opts.now || new Date();
  const clock = getJerusalemClock(now);
  const owner =
    firstName(opts.profile?.owner_name) ||
    firstName(opts.ownerName) ||
    "";
  const business =
    (opts.profile?.business_name || opts.businessName || "").trim() ||
    "העסק";

  const idleDays = daysSince(opts.profile?.last_activity_at, now);

  // Returned after 2–3+ days
  if (idleDays != null && idleDays >= 2) {
    const name = owner || "שם";
    return `היי ${name}! שמחה לראות אותך שוב. איך עברו הימים האחרונים ב${business}? קרה משהו ששווה לשתף עליו — לקוח מרוצה, רכב שיצא מעולה, או פרויקט שנסגר?`;
  }

  // Thursday / weekend (Fri–Sat)
  if (clock.day === 4 || clock.day === 5 || clock.day === 6) {
    return `סופ״ש בפתח! איך ההכנות? רוצה שנעלה פוסט הישגים שמסכם את השבוע, או שנפתח הרשמה לתורים לשבוע הבא?`;
  }

  // Sunday morning before 12:00
  if (clock.day === 0 && clock.hour < 12) {
    const name = owner || "שם";
    return `שבוע טוב ${name}! מתחילים שבוע חדש בשיא הכוח. מה המטרה הראשית שלנו להיום — להביא פניות חדשות או לחזק את הנוכחות ברשתות?`;
  }

  // Warm short check-in
  const topic = opts.profile?.last_post_topic?.trim();
  const wins = (opts.profile?.recent_wins || [])
    .map(winText)
    .filter(Boolean)
    .slice(0, 2);
  const nameBit = owner ? `${owner}, ` : "";

  if (topic && wins.length) {
    return `היי ${nameBit}שמחה שחזרת. בפעם הקודמת דיברנו על «${topic.slice(0, 80)}» — ושמתי לב להישגים כמו «${wins[0]!.slice(0, 60)}». מה קורה היום בעסק?`;
  }
  if (topic) {
    return `היי ${nameBit}נעים לראות אותך. הנושא האחרון שלנו היה «${topic.slice(0, 90)}» — רוצה להמשיך את המומנטום או לפתוח משהו חדש?`;
  }
  if (wins.length) {
    return `היי ${nameBit}זוכרת את «${wins[0]!.slice(0, 70)}» — יאללה, מה הסיפור הבא ששווה לשתף?`;
  }

  return owner
    ? `היי ${owner}! מה קורה בעסק היום? יש לקוח מרוצה, הישג, או משהו מהשטח ששווה להפוך לפוסט?`
    : `היי! שמחה לראות אותך. מה קורה בעסק היום — הישג, לקוח מרוצה, או משהו מהשטח?`;
}
