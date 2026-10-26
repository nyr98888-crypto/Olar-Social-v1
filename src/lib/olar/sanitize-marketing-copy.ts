/**
 * Strip chip/template fill-in brackets and category leaks from outbound marketing copy.
 * Prevents headlines like "[בן אדם עובד / פירות מיץ...]" leaking into the UI.
 */
import { stripCategoryLeak } from "@/lib/olar/strip-category";

/** Remove `[...]` placeholder segments (incl. nested-looking fill-ins) and collapse whitespace. */
export function stripBracketPlaceholders(text: string): string {
  if (!text) return text;
  let out = text;
  // Repeat until stable — nested / adjacent brackets
  for (let i = 0; i < 8; i++) {
    const next = out.replace(/\[[^\]]*\]/g, " ");
    if (next === out) break;
    out = next;
  }
  // Any leftover bare brackets from malformed templates
  out = out.replace(/[\[\]]/g, " ");
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** True when copy still contains square brackets (hard reject signal). */
export function hasBracketLeak(text: string): boolean {
  return /[\[\]]/.test(text || "");
}

/**
 * Soft polish after bracket strip — drop form-label noise that often precedes examples.
 */
export function polishFormSnippet(text: string): string {
  let s = stripBracketPlaceholders(text);
  s = s
    .replace(/^למשל[:：]?\s*/i, "")
    .replace(/^השלימו כאן\s*/i, "")
    .replace(/^תארו בשפה שלכם\s*/i, "")
    .replace(/^אם יש\s*/i, "")
    .trim();
  // Drop leftover form labels like "שם העסק והעיר:" when value was stripped
  if (/^(שם|השירות|המבצע|הנעה|הטיפול|המוצר|לתיאום|איך מזמינים)/.test(s) && s.length < 28) {
    return "";
  }
  return s;
}

/** Full outbound sanitizer for headline / body / CTA / chat. */
export function sanitizeMarketingCopy(text: string): string {
  if (!text) return text;
  return polishFormSnippet(stripCategoryLeak(text));
}

/**
 * Sanitize variation fields. If headline/body still empty or bracket-tainted after strip,
 * rewrite with safe fallbacks (never return brackets to UI).
 */
export function sanitizeVariationCopy(opts: {
  headline: string;
  bodyText: string;
  ctaButton: string;
  fallbackHeadline?: string;
  fallbackBody?: string;
  fallbackCta?: string;
}): { headline: string; bodyText: string; ctaButton: string } {
  let headline = sanitizeMarketingCopy(opts.headline || "");
  let bodyText = sanitizeMarketingCopy(opts.bodyText || "");
  let ctaButton = sanitizeMarketingCopy(opts.ctaButton || "");

  if (!headline || hasBracketLeak(headline)) {
    headline = sanitizeMarketingCopy(
      opts.fallbackHeadline || "העסק שלכם בפוסט אחד"
    );
  }
  if (!bodyText || hasBracketLeak(bodyText)) {
    bodyText = sanitizeMarketingCopy(
      opts.fallbackBody ||
        "כתבו לנו בוואטסאפ — נשמח להתאים לכם בדיוק את מה שצריך."
    );
  }
  if (!ctaButton || hasBracketLeak(ctaButton)) {
    ctaButton = sanitizeMarketingCopy(
      opts.fallbackCta || "כתבו בוואטסאפ"
    );
  }

  // Final hard reject — never ship brackets
  if (hasBracketLeak(headline)) headline = "העסק שלכם בפוסט אחד";
  if (hasBracketLeak(bodyText)) {
    bodyText = "כתבו לנו בוואטסאפ — נשמח להתאים לכם בדיוק את מה שצריך.";
  }
  if (hasBracketLeak(ctaButton)) ctaButton = "כתבו בוואטסאפ";

  return { headline, bodyText, ctaButton };
}
