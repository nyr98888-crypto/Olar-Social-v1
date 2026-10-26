/**
 * Canonical category grid for landing / onboarding chips.
 * Labels are Hebrew UI; ids are stable keys for AI locks + storage.
 */

export type CategoryId =
  | "architecture"
  | "beauty"
  | "nails_beauty"
  | "food"
  | "hair_salon"
  | "legal_accounting"
  | "fitness"
  | "renovation"
  | "automotive"
  | "retail"
  | "bakery"
  | "real_estate"
  | "wellness"
  | "events_photo"
  | "pets"
  | "cleaning_moving"
  | "courses_workshops"
  | "fashion_jewelry"
  | "custom";

export type CategoryDef = {
  id: CategoryId;
  labelHe: string;
};

export const CATEGORIES: readonly CategoryDef[] = [
  { id: "architecture", labelHe: "🏛️ אדריכלות ועיצוב פנים" },
  { id: "beauty", labelHe: "💆‍♀️ קליניקה ואסתטיקה" },
  { id: "nails_beauty", labelHe: "ציפורניים, מניקור וביוטי 💅" },
  { id: "food", labelHe: "🍕 מסעדות ואוכל" },
  { id: "hair_salon", labelHe: "עיצוב שיער, טיפוח וסטיילינג 💇" },
  { id: "legal_accounting", labelHe: "⚖️ עורכי דין וראיית חשבון" },
  { id: "fitness", labelHe: "🏋️ כושר ואימונים" },
  { id: "renovation", labelHe: "🔨 שיפוצים ועבודות בית" },
  { id: "automotive", labelHe: "🚗 מוסכים ורכב" },
  { id: "retail", labelHe: "🛍️ חנויות ומסחר" },
  { id: "bakery", labelHe: "🧁 קונדיטוריה ומאפים" },
  { id: "real_estate", labelHe: "🏡 נדל״ן ותיווך" },
  { id: "wellness", labelHe: "🌿 טיפול ורפואה משלימה" },
  { id: "events_photo", labelHe: "אירועים, צילום ו-DJ 📸" },
  { id: "pets", labelHe: "בעלי חיים ואילוף 🐕" },
  { id: "cleaning_moving", labelHe: "הובלות, ניקיון ותחזוקה 🚚" },
  { id: "courses_workshops", labelHe: "סדנאות, חוגים והוראה 🎓" },
  { id: "fashion_jewelry", labelHe: "בוטיק אופנה ותכשיטים 👗" },
  { id: "custom", labelHe: "אחר / הקלדה חופשית ✍️" },
] as const;
