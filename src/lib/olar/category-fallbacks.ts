/**
 * High-quality Unsplash fallbacks per business category / dish / trade.
 * NEVER use salad / soap / towel stock.
 * Prefer workshop / nails / food-appropriate imagery.
 * Dish + trade detection wins over generic category.
 */
import {
  normalizeCategory,
  type BusinessCategoryId,
} from "./business-categories";
import { extractDishFromText } from "@/lib/ai/dish-prompt";
import { extractTradeFromText } from "@/lib/ai/trade-prompt";

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

/** Dish-specific Unsplash (hot pastries / plated hot dishes — no salad bowls). */
const DISH_FALLBACKS: Record<string, string[]> = {
  jachnun: [
    U("photo-1555507036-ab1f4038808a"),
    U("photo-1509440159596-0249088772ff"),
  ],
  malawach: [U("photo-1509440159596-0249088772ff")],
  sabich: [U("photo-1529006557810-274b9b2fc783")],
  shawarma: [U("photo-1529006557810-274b9b2fc783")],
  hummus: [U("photo-1541519767536-1d1d5b2d1f3f")],
  falafel: [U("photo-1601050690597-df0568f70950")],
  shakshuka: [U("photo-1590412200988-a436970781fa")],
  burekas: [U("photo-1509440159596-0249088772ff")],
  pizza: [U("photo-1513104890138-7c749659a591")],
  croissant: [U("photo-1555507036-ab1f4038808a")],
  cake: [U("photo-1578985545062-69928b1d9587")],
};

/** Body shop / paint booth — bright workshop (not night sports car). */
const AUTOMOTIVE_FALLBACKS = [
  U("photo-1486262715619-67b85e0b08d3"),
  U("photo-1625047509248-ec889cbff17f"),
  U("photo-1619642751034-765dfdf7c58e"),
  U("photo-1492140104119-ae3c6d71a7a0"),
  U("photo-1632823471565-1ecdfdd0e27f"),
];

/** Gel nails / manicure — clean salon desk, not bathroom soap. */
const NAILS_FALLBACKS = [
  U("photo-1604654894610-df63bc86fba6"),
  U("photo-1519014816548-bf5fe059798b"),
  U("photo-1632345031435-8727f6897d53"),
];

const FALLBACKS: Record<BusinessCategoryId, string[]> = {
  food: [U("photo-1414235077428-338989a2e8c0")],
  bakery: [U("photo-1509440159596-0249088772ff")],
  architecture: [U("photo-1618221195710-dd6b41faaea6")],
  beauty: [U("photo-1570172619644-dfd03ed5d881")],
  nails_beauty: NAILS_FALLBACKS,
  hair_salon: [U("photo-1560066984-138dadb4c035")],
  fitness: [U("photo-1534438327276-14e5300c3a48")],
  automotive: AUTOMOTIVE_FALLBACKS,
  renovation: [U("photo-1503387762-592deb58ef4e")],
  legal_accounting: [U("photo-1497366216548-37526070297c")],
  real_estate: [U("photo-1564013799919-ab600027ffc6")],
  retail: [U("photo-1441986300917-64674bd600d8")],
  wellness: [U("photo-1544161515-4ab6ce6db874")],
  events_photo: [
    U("photo-1511285560929-80b456fea0bc"),
    U("photo-1492684223066-81342ee5ff30"),
  ],
  pets: [
    U("photo-1587300003388-59208cc962cb"),
    U("photo-1548199973-03cce0bbc87b"),
  ],
  cleaning_moving: [
    U("photo-1600880292203-757bb62b4baf"),
    U("photo-1600518467981-ce11b2b4b0b0"),
  ],
  courses_workshops: [
    U("photo-1524178232363-1fb2b075b655"),
    U("photo-1522202176988-66273c2fd55f"),
  ],
  fashion_jewelry: [
    U("photo-1515562141207-7a88fb7ce338"),
    U("photo-1490481651871-ab68de25d43d"),
  ],
  custom: [U("photo-1497366811353-6870744d04b2")],
};

const NEUTRAL_FALLBACKS = [
  U("photo-1497366811353-6870744d04b2"),
  U("photo-1497366754035-f200968a6e72"),
];

function pickFrom(list: string[], seed?: number | null): string {
  if (!list.length) return NEUTRAL_FALLBACKS[0]!;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return list[Math.abs(Math.floor(seed)) % list.length]!;
  }
  return list[Math.floor(Math.random() * list.length)]!;
}

export function getCategoryFallback(
  category?: string | null,
  userText?: string | null,
  seed?: number | null
): string {
  const dish = extractDishFromText(userText || "");
  if (dish && DISH_FALLBACKS[dish.id]?.length) {
    return pickFrom(DISH_FALLBACKS[dish.id]!, seed);
  }
  const trade = extractTradeFromText(
    [userText, category].filter(Boolean).join(" ")
  );
  if (trade?.id === "gel_nails") {
    return pickFrom(NAILS_FALLBACKS, seed);
  }
  if (trade?.id === "body_paint_booth") {
    return pickFrom(AUTOMOTIVE_FALLBACKS, seed);
  }
  const id = normalizeCategory(category);
  if (id && FALLBACKS[id]?.length) return pickFrom(FALLBACKS[id]!, seed);
  return pickFrom(NEUTRAL_FALLBACKS, seed);
}
