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
import {
  polishFormSnippet,
  sanitizeMarketingCopy,
  sanitizeVariationCopy,
} from "@/lib/olar/sanitize-marketing-copy";
import {
  normalizePostType,
  postTypeDefaultCtas,
  type PostTypeId,
} from "@/lib/olar/post-types";
import { resolveCreativeStudioLock } from "@/lib/ai/hebrew-visual-context";

export type GroundedPostDraft = {
  headline: string;
  bodyText: string;
  ctaButton: string;
  imagePrompt: string;
  hashtags: string[];
  category: BusinessCategoryId | null;
};

function firstMeaningfulLine(text: string): string {
  const raw =
    text
      .split(/\n|[.!?।]/)
      .map((s) => s.trim())
      .find((s) => polishFormSnippet(s).length >= 3) || text.slice(0, 80).trim();
  // Prefer value after "Label: value" form lines
  const afterColon = raw.match(/^[^:：]{2,40}[:：]\s*(.+)$/);
  return polishFormSnippet(afterColon?.[1] || raw);
}

function extractLikelyName(text: string): string | null {
  // "ג'חנון של דניאל" / "הג'חנון של דניאל"
  const m = text.match(/(?:של|מאת)\s+([^\n,.\[]{2,40})/);
  if (m?.[1]) return polishFormSnippet(m[1]);
  const named = text.match(
    /(?:^|\n)\s*(?:שם(?:\s+העסק)?|עסק)\s*[:：]\s*([^\n]{2,40})/i
  );
  if (named?.[1]) return polishFormSnippet(named[1]);
  return null;
}

export function buildGroundedPostFallback(opts: {
  userText: string;
  category?: BusinessCategoryId | null;
  city?: string | null;
  goal?: string | null;
  postType?: PostTypeId | null;
}): GroundedPostDraft {
  const userText = sanitizeMarketingCopy(opts.userText || "").trim();
  const category = opts.category ?? null;
  const city = (opts.city || "").trim();
  const postType = normalizePostType(opts.postType);
  const ctas = postTypeDefaultCtas(postType);
  const dish = extractDishFromText(userText);
  const name = extractLikelyName(userText);
  const snippet = firstMeaningfulLine(userText);
  const allowPromoCta = postType === "promotion";

  let headline = "";
  let bodyText = "";
  let ctaButton = ctas.var1;

  if (dish?.id === "jachnun" || /ג['׳']?חנון|jachnun/i.test(userText)) {
    headline = name
      ? `ג'חנון עבודת יד לוהט — ${name}`
      : "ג'חנון עבודת יד לוהט לשבת בבוקר";
    bodyText = [
      snippet.length > 20 ? snippet : userText.slice(0, 220),
      city ? `מגישים ב${city} והסביבה.` : null,
      allowPromoCta
        ? "טרי, נמס בפה — כתבו בוואטסאפ להזמנה."
        : "טרי, נמס בפה — ככה זה נראה כשעושים עם לב.",
    ]
      .filter(Boolean)
      .join("\n");
    ctaButton = allowPromoCta ? "להזמנה בוואטסאפ לשבת" : ctas.var1;
  } else if (dish) {
    headline = name ? `${dish.id} של ${name}` : snippet.slice(0, 60);
    bodyText = allowPromoCta
      ? `${userText.slice(0, 320)}\n\nכתבו בוואטסאפ — נשמח לתאם.`
      : `${userText.slice(0, 320)}\n\nשמחים לחלוק את הרגע הזה איתכם.`;
    ctaButton = allowPromoCta ? "להזמנה בוואטסאפ" : ctas.var1;
  } else if (category === "food" || category === "bakery") {
    const label = categoryLabel(category);
    headline = name
      ? `${name} — טעמים שמחכים לכם`
      : snippet.slice(0, 70) || `משהו טעים מ־${label}`;
    bodyText = allowPromoCta
      ? `${userText.slice(0, 360)}\n\nכתבו בוואטסאפ להזמנה או שאלה.`
      : `${userText.slice(0, 360)}\n\nגאים במה שיצא היום מהמטבח.`;
    ctaButton = allowPromoCta ? "להזמנה בוואטסאפ" : ctas.var1;
  } else {
    headline = snippet.slice(0, 70) || (name ? name : "העסק שלכם בפוסט אחד");
    bodyText = userText.slice(0, 420);
    if (allowPromoCta) {
      if (opts.goal === "new_clients") {
        ctaButton = "כתבו בוואטסאפ — נשמח להכיר";
      } else if (opts.goal === "fill_schedule") {
        ctaButton = "יש מקום פנוי? כתבו בוואטסאפ";
      } else {
        ctaButton = "לתיאום בוואטסאפ";
      }
    } else {
      ctaButton = ctas.var1;
    }
  }

  const imagePrompt =
    resolveDishBiasedPrompt({
      description: userText,
      category,
    }) ||
    resolveCreativeStudioLock({
      description: opts.userText || userText,
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

  const cleaned = sanitizeVariationCopy({
    headline,
    bodyText,
    ctaButton,
    fallbackHeadline: name || "העסק שלכם בפוסט אחד",
    fallbackBody: userText.slice(0, 420) || bodyText,
    fallbackCta: ctas.var1,
  });

  return {
    headline: cleaned.headline,
    bodyText: cleaned.bodyText,
    ctaButton: cleaned.ctaButton,
    imagePrompt,
    hashtags,
    category,
  };
}
