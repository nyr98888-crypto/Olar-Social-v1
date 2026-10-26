/**
 * Fast grounded post draft when LLM times out / fails.
 * Uses ONLY userText + category — never clinic/garage canned marketing.
 */
import {
  extractDishFromText,
  resolveDishBiasedPrompt,
} from "@/lib/ai/dish-prompt";
import type { BusinessCategoryId } from "@/lib/olar/business-categories";
import { categoryLabel } from "@/lib/olar/business-categories";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

export type GroundedPostDraft = {
  headline: string;
  bodyText: string;
  ctaButton: string;
  imagePrompt: string;
  hashtags: string[];
  category: BusinessCategoryId | null;
};

function firstMeaningfulLine(text: string): string {
  return (
    text
      .split(/\n|[.!?।]/)
      .map((s) => s.trim())
      .find((s) => s.length >= 3) || text.slice(0, 80).trim()
  );
}

function extractLikelyName(text: string): string | null {
  // "ג'חנון של דניאל" / "הג'חנון של דניאל"
  const m = text.match(/(?:של|מאת)\s+([^\n,.]{2,40})/);
  if (m?.[1]) return m[1].trim();
  const named = text.match(
    /(?:^|\n)\s*(?:שם(?:\s+העסק)?|עסק)\s*[:：]\s*([^\n]{2,40})/i
  );
  if (named?.[1]) return named[1].trim();
  return null;
}

export function buildGroundedPostFallback(opts: {
  userText: string;
  category?: BusinessCategoryId | null;
  city?: string | null;
  goal?: string | null;
}): GroundedPostDraft {
  const userText = stripCategoryLeak(opts.userText || "").trim();
  const category = opts.category ?? null;
  const city = (opts.city || "").trim();
  const dish = extractDishFromText(userText);
  const name = extractLikelyName(userText);
  const snippet = firstMeaningfulLine(userText);

  let headline = "";
  let bodyText = "";
  let ctaButton = "לפרטים והזמנות בוואטסאפ";

  if (dish?.id === "jachnun" || /ג['׳']?חנון|jachnun/i.test(userText)) {
    headline = name
      ? `ג'חנון עבודת יד לוהט — ${name}`
      : "ג'חנון עבודת יד לוהט לשבת בבוקר";
    bodyText = [
      snippet.length > 20 ? snippet : userText.slice(0, 220),
      city ? `מגישים ב${city} והסביבה.` : null,
      "טרי, נמס בפה — כתבו בוואטסאפ להזמנה.",
    ]
      .filter(Boolean)
      .join("\n");
    ctaButton = "להזמנה בוואטסאפ לשבת";
  } else if (dish) {
    headline = name ? `${dish.id} של ${name}` : snippet.slice(0, 60);
    bodyText = `${userText.slice(0, 320)}\n\nכתבו בוואטסאפ — נשמח לתאם.`;
    ctaButton = "להזמנה בוואטסאפ";
  } else if (category === "food" || category === "bakery") {
    const label = categoryLabel(category);
    headline = name
      ? `${name} — טעמים שמחכים לכם`
      : snippet.slice(0, 70) || `משהו טעים מ־${label}`;
    bodyText = `${userText.slice(0, 360)}\n\nכתבו בוואטסאפ להזמנה או שאלה.`;
    ctaButton = "להזמנה בוואטסאפ";
  } else {
    headline = snippet.slice(0, 70) || (name ? name : "העסק שלכם בפוסט אחד");
    bodyText = userText.slice(0, 420);
    if (opts.goal === "new_clients") {
      ctaButton = "כתבו בוואטסאפ — נשמח להכיר";
    } else if (opts.goal === "fill_schedule") {
      ctaButton = "יש מקום פנוי? כתבו בוואטסאפ";
    } else {
      ctaButton = "לתיאום בוואטסאפ";
    }
  }

  const imagePrompt =
    resolveDishBiasedPrompt({
      description: userText,
      category,
    }) ||
    (category === "food" || category === "bakery"
      ? "Appetizing Israeli food photography, fresh plated dish, warm morning light, restaurant quality, 8k, no text"
      : "Bright professional commercial photography for a local Israeli small business, natural daylight, crisp focus, no text overlay");

  const hashtags = [
    "#עסקמקומי",
    "#OneLoopSocial",
    category === "food" || category === "bakery" ? "#אוכלישראלי" : null,
    city ? `#${city.replace(/\s+/g, "")}` : null,
  ].filter(Boolean) as string[];

  return {
    headline: stripCategoryLeak(headline).trim(),
    bodyText: stripCategoryLeak(bodyText).trim(),
    ctaButton: stripCategoryLeak(ctaButton).trim(),
    imagePrompt,
    hashtags,
    category,
  };
}
