/**
 * High-quality Unsplash fallbacks per business category / dish.
 * NEVER use salad stock for hot food / pastry categories.
 */
import {
  normalizeCategory,
  type BusinessCategoryId,
} from "./business-categories";
import { extractDishFromText } from "@/lib/ai/dish-prompt";

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

/** Dish-specific Unsplash (hot pastries / plated hot dishes — no salad bowls). */
const DISH_FALLBACKS: Record<string, string> = {
  jachnun: U("photo-1555507036-ab1f4038808a"), // warm pastries / bakery rolls
  malawach: U("photo-1509440159596-0249088772ff"), // fresh breads
  sabich: U("photo-1529006557810-274b9b2fc783"), // pita / street food
  shawarma: U("photo-1529006557810-274b9b2fc783"),
  hummus: U("photo-1541519767536-1d1d5b2d1f3f"), // hummus-like bowl (not leafy salad)
  falafel: U("photo-1601050690597-df0568f70950"), // falafel
  shakshuka: U("photo-1590412200988-a436970781fa"), // skillet egg dish
  burekas: U("photo-1509440159596-0249088772ff"),
  pizza: U("photo-1513104890138-7c749659a591"),
  croissant: U("photo-1555507036-ab1f4038808a"),
  cake: U("photo-1578985545062-69928b1d9587"),
};

/** Stable Unsplash photo IDs — one strong visual per category. */
const FALLBACKS: Record<BusinessCategoryId, string> = {
  // Hot plated food / steaming dish — NOT leafy salad stock
  food: U("photo-1414235077428-338989a2e8c0"), // plated restaurant hot dish
  bakery: U("photo-1509440159596-0249088772ff"), // bakery breads / pastries
  architecture: U("photo-1618221195710-dd6b41faaea6"),
  beauty: U("photo-1540555700478-4be289fbecef"),
  hair_salon: U("photo-1560066984-138dadb4c035"),
  fitness: U("photo-1534438327276-14e5300c3a48"),
  automotive: U("photo-1492144534655-ae79c964c9d7"),
  renovation: U("photo-1503387762-592deb58ef4e"),
  legal_accounting: U("photo-1497366216548-37526070297c"),
  real_estate: U("photo-1564013799919-ab600027ffc6"),
  retail: U("photo-1441986300917-64674bd600d8"),
  wellness: U("photo-1544161515-4ab6ce6db874"),
};

const NEUTRAL_FALLBACK = U("photo-1497366811353-6870744d04b2");

export function getCategoryFallback(
  category?: string | null,
  userText?: string | null
): string {
  const dish = extractDishFromText(userText || "");
  if (dish && DISH_FALLBACKS[dish.id]) return DISH_FALLBACKS[dish.id];
  const id = normalizeCategory(category);
  if (id && FALLBACKS[id]) return FALLBACKS[id];
  return NEUTRAL_FALLBACK;
}
