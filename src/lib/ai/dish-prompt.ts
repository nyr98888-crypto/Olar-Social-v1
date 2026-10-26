/**
 * Dish-specific English bias for food/bakery image prompts.
 * When Hebrew (or English) text names a dish, prefer that subject over generic salad/bagel stock.
 */

export type DishHint = {
  id: string;
  /** Hebrew / English tokens that trigger this dish */
  keys: string[];
  /** Full English FLUX-ready prompt fragment */
  englishPrompt: string;
};

export const DISH_MAP: DishHint[] = [
  {
    id: "jachnun",
    keys: ["ג'חנון", "ג׳חנון", "גחנון", "jachnun", "jahnun"],
    englishPrompt:
      "Professional appetizing culinary food photography of authentic traditional Yemenite Jachnun, golden-brown rolled layered pastry served on a dark rustic wooden tray. Accompanied by a small bowl of fresh grated red tomato puree, a small dish of spicy green schug condiment, and a brown slow-cooked hard-boiled egg. Warm weekend morning sunlight, shallow depth of field, authentic Israeli food styling, 8k resolution, shot on 85mm lens. avoid: croissant, powdered sugar, french pastry, bread loaf, sweet dessert, salad, european bakery",
  },
  {
    id: "malawach",
    keys: ["מלאווח", "מלווח", "malawach", "malawah"],
    englishPrompt:
      "Close up of flaky golden Yemenite malawach flatbread on a plate with grated tomato and hard-boiled egg, Israeli comfort food photography, warm daylight, appetizing, 8k",
  },
  {
    id: "sabich",
    keys: ["סביח", "sabich"],
    englishPrompt:
      "Close up of authentic Israeli sabich pita stuffed with fried eggplant, hard-boiled egg, hummus, amba and salad, street food photography, bright daylight, 8k",
  },
  {
    id: "shawarma",
    keys: ["שווארמה", "shawarma", "shawerma"],
    englishPrompt:
      "Close up of juicy shawarma in laffa with tahini and pickled vegetables, Israeli street food photography, appetizing steam, warm lighting, 8k",
  },
  {
    id: "hummus",
    keys: ["חומוס", "hummus"],
    englishPrompt:
      "Close up of creamy hummus bowl with olive oil, paprika and warm pita, Middle Eastern food photography, natural daylight, restaurant quality, 8k",
  },
  {
    id: "falafel",
    keys: ["פלאפל", "falafel"],
    englishPrompt:
      "Close up of crispy golden falafel balls in pita with tahini and Israeli salad, street food photography, bright daylight, appetizing, 8k",
  },
  {
    id: "shakshuka",
    keys: ["שקשוקה", "shakshuka"],
    englishPrompt:
      "Close up of bubbling tomato shakshuka with eggs in a cast-iron skillet, Israeli breakfast food photography, warm lighting, 8k",
  },
  {
    id: "burekas",
    keys: ["בורקס", "burekas", "bourekas"],
    englishPrompt:
      "Close up of golden flaky cheese and potato burekas on a bakery tray, Israeli pastry photography, warm bakery lighting, 8k",
  },
  {
    id: "pizza",
    keys: ["פיצה", "pizza"],
    englishPrompt:
      "Close up of wood-fired artisan pizza with melted cheese and fresh toppings, appetizing food photography, warm lighting, restaurant quality, 8k",
  },
  {
    id: "croissant",
    keys: ["קרואסון", "croissant"],
    englishPrompt:
      "Close up of buttery golden croissant on parchment, bakery pastry photography, soft morning light, appetizing, 8k",
  },
  {
    id: "cake",
    keys: ["עוגה", "עוגות", "cake", "קאפקייק"],
    englishPrompt:
      "Close up of beautifully decorated fresh cake slice on a ceramic plate, bakery dessert photography, soft daylight, appetizing, 8k",
  },
];

const FOOD_CATEGORY_HINTS = [
  "food",
  "bakery",
  "restaurant",
  "cafe",
  "מסעד",
  "מאפי",
  "קונדיטור",
  "אוכל",
  "קפה",
];

export function extractDishFromText(text: string): DishHint | null {
  const lower = (text || "").toLowerCase();
  if (!lower.trim()) return null;
  for (const dish of DISH_MAP) {
    if (dish.keys.some((k) => lower.includes(k.toLowerCase()))) return dish;
  }
  return null;
}

export function isFoodishContext(opts: {
  text?: string | null;
  niche?: string | null;
  category?: string | null;
}): boolean {
  const blob = [opts.text, opts.niche, opts.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!blob) return false;
  if (extractDishFromText(blob)) return true;
  return FOOD_CATEGORY_HINTS.some((h) => blob.includes(h.toLowerCase()));
}

/**
 * When a specific dish is mentioned (or food category + dish in text),
 * return a strong English prompt that wins over generic bakery stock.
 */
export function resolveDishBiasedPrompt(opts: {
  description: string;
  niche?: string | null;
  category?: string | null;
  existingEnglish?: string | null;
}): string | null {
  const dish = extractDishFromText(opts.description);
  if (!dish) {
    if (
      !isFoodishContext({
        text: opts.description,
        niche: opts.niche,
        category: opts.category,
      })
    ) {
      return null;
    }
    return null;
  }

  // Dish lock wins entirely — do NOT merge Art Director text (can drag in croissant/bakery).
  void opts.existingEnglish;
  return dish.englishPrompt;
}

/** Negatives baked into Flux prompts (FAL schnell has no negative_prompt param). */
export const JACHNUN_NEGATIVES =
  "croissant, powdered sugar, french pastry, bread loaf, sweet dessert, salad, european bakery";

export function isJachnunText(text: string): boolean {
  return Boolean(extractDishFromText(text)?.id === "jachnun");
}
