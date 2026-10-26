/**
 * Server-side text guardrails — strip hallucinated prices / risky service phrases
 * before content reaches the UI. Used by pipeline-validator.
 */

/** Neutral replacement when an invented price is stripped. */
export const PRICE_STRIP_REPLACEMENT = "לפרטים ומחיר בוואטסאפ";

/** Preferred CTA when no explicit price in user input. */
export const NEUTRAL_PRICE_CTA = "לתיאום והצעת מחיר בוואטסאפ";

/**
 * Matches Israeli / common currency price tokens:
 * ₪150, 150 ₪, 150ש״ח, 99 ש"ח, 200 שח, NIS 99, 99 ILS, etc.
 */
export const PRICE_PATTERN =
  /(?:₪\s*\d{1,6}(?:[.,]\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?\s*(?:₪|ש["״']?\s*ח|שקלים?|nis|ils)|(?:nis|ils)\s*\d{1,6}(?:[.,]\d{1,2})?)/gi;

/** Dummy / demo phones that must never ship. */
export const DUMMY_PHONE_PATTERN =
  /(?:\+?972[\s\-.]*)?0?5[0-9][\s\-.]*(?:0{5,9}|0{3}[\s\-.]0{4})|\b050[\s\-.]?0{6,7}\b|\b972500000000\b|\b0500000000\b/gi;

/** wa.me links pointing at placeholder numbers. */
export const DUMMY_WAME_PATTERN =
  /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(?:972)?5?0{6,12}\b/gi;

/**
 * Specific technical phrases often hallucinated for broad niches.
 * Only flagged when NOT present in user input (allowlist = user text).
 */
export const RISKY_SERVICE_PHRASES = [
  "החלפת שמן גיר",
  "שמן גיר",
  "חומצה הילרונית",
  "בוטוקס",
  "מילוי שפתיים",
  "אבחון ממוחשב מלא",
  "טיפול לייזר",
  "החלפת ראש מנוע",
] as const;

export function extractPriceMatches(text: string): string[] {
  if (!text) return [];
  return [...text.matchAll(PRICE_PATTERN)].map((m) => m[0].trim()).filter(Boolean);
}

function compactDigits(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/** True when this price token's digit core appears in the user's raw input. */
export function priceIsGroundedInInput(
  priceToken: string,
  rawPrompt: string
): boolean {
  const digits = compactDigits(priceToken);
  if (!digits || digits.length < 1) return false;
  const token = priceToken.trim();
  if (rawPrompt.includes(token)) return true;
  if (
    rawPrompt.replace(/\s+/g, "").includes(token.replace(/\s+/g, ""))
  ) {
    return true;
  }
  // Contiguous digit run from the price must appear in the raw prompt
  const re = new RegExp(`(?:^|\\D)${digits}(?:\\D|$)`);
  return re.test(rawPrompt);
}

/**
 * Strip price tokens that were NOT in user input; replace with neutral CTA phrase.
 * Also clears common Hebrew prepositions glued to invented prices (רק ב- / החל מ-).
 */
export function sanitizePricesInText(
  text: string,
  rawPrompt: string
): { text: string; stripped: string[]; hadExplicit: boolean } {
  if (!text) return { text: "", stripped: [], hadExplicit: false };

  const stripped: string[] = [];
  let hadExplicit = false;

  // Match optional Hebrew price preamble + currency token as one unit when stripping
  const withPreamble =
    /(?:רק\s+)?(?:ב[\-–—]?\s*|החל\s+מ[\-–—]?\s*|בסך\s+|בעלות\s+של\s+|במחיר\s+)?(?:₪\s*\d{1,6}(?:[.,]\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?\s*(?:₪|ש["״']?\s*ח|שקלים?|nis|ils)|(?:nis|ils)\s*\d{1,6}(?:[.,]\d{1,2})?)/gi;

  const next = text.replace(withPreamble, (match) => {
    // Extract the bare price token for grounding check
    const priceOnly = match.match(PRICE_PATTERN)?.[0] ?? match;
    if (priceIsGroundedInInput(priceOnly, rawPrompt)) {
      hadExplicit = true;
      return match;
    }
    stripped.push(priceOnly);
    return PRICE_STRIP_REPLACEMENT;
  });

  // Collapse accidental double replacements / spaces / leftover "ב-" before replacement
  const cleaned = next
    .replace(
      new RegExp(
        `(?:ב[\\-–—]?\\s*)?${PRICE_STRIP_REPLACEMENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "g"
      ),
      PRICE_STRIP_REPLACEMENT
    )
    .replace(
      new RegExp(`(?:${PRICE_STRIP_REPLACEMENT}\\s*){2,}`, "g"),
      `${PRICE_STRIP_REPLACEMENT} `
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: cleaned, stripped, hadExplicit };
}

/**
 * When an allowlist of user-stated services exists (raw prompt), remove risky
 * invented phrases that never appeared in input.
 */
export function sanitizeInventedServices(
  text: string,
  rawPrompt: string
): { text: string; removed: string[] } {
  if (!text) return { text: "", removed: [] };
  const lowerRaw = rawPrompt.toLowerCase();
  const removed: string[] = [];
  let next = text;

  for (const phrase of RISKY_SERVICE_PHRASES) {
    if (!phrase) continue;
    if (lowerRaw.includes(phrase.toLowerCase())) continue;
    if (next.includes(phrase)) {
      removed.push(phrase);
      next = next.split(phrase).join("").replace(/[ \t]{2,}/g, " ");
    }
  }

  return { text: next.trim(), removed };
}

export function userInputHasExplicitPrice(rawPrompt: string): boolean {
  return extractPriceMatches(rawPrompt).length > 0;
}
