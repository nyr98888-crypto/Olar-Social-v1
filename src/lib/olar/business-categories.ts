/**
 * Canonical business categories for chip selection + AI locking.
 * Category is a hard constraint for magic copy and image generation.
 */

export type BusinessCategoryId =
  | "architecture"
  | "beauty"
  | "food"
  | "hair_salon"
  | "legal_accounting"
  | "fitness"
  | "renovation"
  | "automotive"
  | "retail"
  | "bakery"
  | "real_estate"
  | "wellness";

/** Profile NicheId union from business-profile.ts (kept local to avoid circular imports). */
export type LegacyNicheId =
  | "garage"
  | "cosmetics"
  | "interior"
  | "salon"
  | "painting"
  | "accountant"
  | "locksmith"
  | "cafe"
  | "general";

export type BusinessCategoryDef = {
  id: BusinessCategoryId;
  labelHe: string;
};

/** Hebrew labels matching existing ui-copy niche*Label strings. */
export const BUSINESS_CATEGORIES: readonly BusinessCategoryDef[] = [
  { id: "architecture", labelHe: "🏛️ אדריכלות ועיצוב פנים" },
  { id: "beauty", labelHe: "💆‍♀️ קליניקה ואסתטיקה" },
  { id: "food", labelHe: "🍕 מסעדות ואוכל" },
  { id: "hair_salon", labelHe: "💇‍♀️ מספרות ועיצוב שיער" },
  { id: "legal_accounting", labelHe: "⚖️ עורכי דין וראיית חשבון" },
  { id: "fitness", labelHe: "🏋️ כושר ואימונים" },
  { id: "renovation", labelHe: "🔨 שיפוצים ועבודות בית" },
  { id: "automotive", labelHe: "🚗 מוסכים ורכב" },
  { id: "retail", labelHe: "🛍️ חנויות ומסחר" },
  { id: "bakery", labelHe: "🧁 קונדיטוריה ומאפים" },
  { id: "real_estate", labelHe: "🏡 נדל״ן ותיווך" },
  { id: "wellness", labelHe: "🌿 טיפול ורפואה משלימה" },
] as const;

const LABEL_BY_ID: Record<BusinessCategoryId, string> = Object.fromEntries(
  BUSINESS_CATEGORIES.map((c) => [c.id, c.labelHe])
) as Record<BusinessCategoryId, string>;

const CANONICAL = new Set<string>(BUSINESS_CATEGORIES.map((c) => c.id));

/** Legacy chip ids → canonical category. */
const LEGACY_CHIP_TO_CATEGORY: Record<string, BusinessCategoryId> = {
  interior: "architecture",
  clinic: "beauty",
  restaurant: "food",
  salon: "hair_salon",
  legal: "legal_accounting",
  garage: "automotive",
  shop: "retail",
  // already-canonical or same-name legacy chips
  fitness: "fitness",
  renovation: "renovation",
  bakery: "bakery",
  real_estate: "real_estate",
  wellness: "wellness",
  // profile NicheId → category
  cosmetics: "beauty",
  cafe: "food",
  accountant: "legal_accounting",
  painting: "renovation",
  architecture: "architecture",
  beauty: "beauty",
  food: "food",
  hair_salon: "hair_salon",
  legal_accounting: "legal_accounting",
  automotive: "automotive",
  retail: "retail",
};

const CATEGORY_TO_LEGACY_NICHE: Record<BusinessCategoryId, LegacyNicheId> = {
  architecture: "interior",
  beauty: "cosmetics",
  food: "cafe",
  hair_salon: "salon",
  legal_accounting: "accountant",
  fitness: "general",
  renovation: "painting",
  automotive: "garage",
  retail: "general",
  bakery: "cafe",
  real_estate: "general",
  wellness: "cosmetics",
};

export function categoryLabel(id: BusinessCategoryId): string {
  return LABEL_BY_ID[id] ?? id;
}

export function legacyNicheFromCategory(id: BusinessCategoryId): LegacyNicheId {
  return CATEGORY_TO_LEGACY_NICHE[id] ?? "general";
}

export function normalizeCategory(
  raw?: string | null
): BusinessCategoryId | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (CANONICAL.has(key)) return key as BusinessCategoryId;
  return LEGACY_CHIP_TO_CATEGORY[key] ?? null;
}

const LOCK_BLOCKS: Record<BusinessCategoryId, string> = {
  food: `CATEGORY LOCK — FOOD / RESTAURANT (STRICT):
The locked business category is FOOD (restaurant, cafe, catering, meals).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in food hospitality: dishes, dining, kitchen, menu, delivery, reservations.
FORBIDDEN: generic "local service", consulting, beauty, auto, legal, fitness, real estate, or any non-food trade.
Never invent an unrelated niche. Ground every sentence in food & dining.`,

  bakery: `CATEGORY LOCK — BAKERY / PASTRY (STRICT):
The locked business category is BAKERY (pastry shop, cakes, breads, desserts).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in bakery/pastry: baked goods, cakes, sweets, oven craft, custom orders.
FORBIDDEN: generic service copy, unrelated restaurants as primary identity, beauty, auto, legal, fitness, real estate.
Never invent an unrelated niche. Ground every sentence in bakery & pastry.`,

  architecture: `CATEGORY LOCK — ARCHITECTURE / INTERIOR DESIGN (STRICT):
The locked business category is ARCHITECTURE & INTERIOR DESIGN.
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in architecture/interiors: spaces, materials, floor plans, living rooms, design consultations.
FORBIDDEN: generic "local service", food, beauty, auto repair, legal, fitness, real estate brokerage as primary.
Never invent an unrelated niche. Ground every sentence in design & built space.`,

  automotive: `CATEGORY LOCK — AUTOMOTIVE / GARAGE (STRICT):
The locked business category is AUTOMOTIVE (garage, car service, vehicle care).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in automotive: cars, workshop, brakes, tires, maintenance, lifts.
FORBIDDEN: generic service, food, beauty, legal, fitness, real estate, bakery.
Never invent an unrelated niche. Ground every sentence in vehicle service.`,

  beauty: `CATEGORY LOCK — BEAUTY / AESTHETICS CLINIC (STRICT):
The locked business category is BEAUTY & AESTHETICS (clinic, skincare, treatments).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in beauty/clinic: facial treatments, skin glow, appointments, spa aesthetics.
FORBIDDEN: generic service, food, auto, legal, fitness, real estate, hair-only as primary unless also beauty.
Never invent an unrelated niche. Ground every sentence in beauty & aesthetics.`,

  hair_salon: `CATEGORY LOCK — HAIR SALON (STRICT):
The locked business category is HAIR SALON (cut, color, styling).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in hair: salon chairs, styling, color, cuts, booking.
FORBIDDEN: generic service, food, auto, legal, fitness, real estate, medical clinic as primary.
Never invent an unrelated niche. Ground every sentence in hair salon craft.`,

  legal_accounting: `CATEGORY LOCK — LEGAL / ACCOUNTING (STRICT):
The locked business category is LEGAL & ACCOUNTING (law firm, CPA, tax).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay professional office: legal advice, accounting, tax, consultations — NEVER food, beauty, cars, gyms.
FORBIDDEN: inventing unrelated trades. Ground every sentence in professional advisory services.`,

  fitness: `CATEGORY LOCK — FITNESS / TRAINING (STRICT):
The locked business category is FITNESS (gym, personal training, pilates).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in fitness: workouts, studio, strength, classes, trial sessions.
FORBIDDEN: generic service, food, beauty clinic, auto, legal, real estate.
Never invent an unrelated niche. Ground every sentence in fitness & training.`,

  renovation: `CATEGORY LOCK — HOME RENOVATION (STRICT):
The locked business category is RENOVATION (painting, plaster, home works).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in renovation: paint, walls, DIY-pro home works, quotes.
FORBIDDEN: generic service, food, beauty, auto, legal, fitness, architecture-only as primary.
Never invent an unrelated niche. Ground every sentence in home renovation.`,

  retail: `CATEGORY LOCK — RETAIL / SHOP (STRICT):
The locked business category is RETAIL (boutique, store, merchandise).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in retail: products, collections, store experience, shopping.
FORBIDDEN: generic service agency copy, food kitchen as primary, auto garage, legal, fitness.
Never invent an unrelated niche. Ground every sentence in retail commerce.`,

  real_estate: `CATEGORY LOCK — REAL ESTATE (STRICT):
The locked business category is REAL ESTATE (brokerage, sales, rentals).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in real estate: homes, listings, viewings, buyers/renters.
FORBIDDEN: generic service, food, beauty, auto, legal as primary trade, fitness.
Never invent an unrelated niche. Ground every sentence in property & brokerage.`,

  wellness: `CATEGORY LOCK — WELLNESS / COMPLEMENTARY CARE (STRICT):
The locked business category is WELLNESS (complementary medicine, massage, acupuncture, calm care).
Even if the user text is short, vague, or ambiguous, ALL copy, CTAs, hashtags, and image briefs MUST stay in wellness: treatments, calm clinic, body care, holistic appointments.
FORBIDDEN: generic service, food, auto, legal, fitness gym as primary, bakery.
Never invent an unrelated niche. Ground every sentence in wellness & care.`,
};

/**
 * Non-negotiable English system block. Prepend to magic / structured prompts.
 * Category stays locked even when user text is short or ambiguous.
 */
export function buildCategoryLockSystemBlock(
  category: BusinessCategoryId
): string {
  const body = LOCK_BLOCKS[category];
  return `## HARD CATEGORY LOCK (NON-NEGOTIABLE)
Selected category id: ${category}
${body}

RULE: If user input conflicts with this category, still produce copy FOR this category using only grounded facts from the input that fit; do not switch niches.`;
}
