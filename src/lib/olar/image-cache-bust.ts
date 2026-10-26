/** Force-fresh image generation helpers (seed + angle + browser cache bust). */

/** Neutral camera hints — never bake garage/auto scenes into unrelated niches. */
const ANGLE_HINTS = [
  "dynamic close-up angle, bright commercial daylight",
  "alternative angle, dynamic close-up perspective",
  "slightly wider framing, three-quarter view, soft natural light",
  "low angle hero shot, crisp detail, commercial daylight",
  "side profile angle, shallow depth of field, clean professional lighting",
] as const;

export function randomImageSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

export function withRegenAngleHint(prompt: string): string {
  const base = (prompt || "").trim();
  const hint = ANGLE_HINTS[Math.floor(Math.random() * ANGLE_HINTS.length)]!;
  // Strip previous regen angle markers so they don't stack forever
  const cleaned = base
    .replace(
      /(?:alternative angle[^.]*)|(?:slightly wider framing[^.]*)|(?:low angle hero shot[^.]*)|(?:overhead detail angle[^.]*)|(?:side profile angle[^.]*)/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned ? `${cleaned}. ${hint}` : hint;
}

/**
 * Append cache-buster for <img> display only.
 * Strips prior t/v stamps first so we never pile broken query chains.
 */
export function bustImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const absolute = url.startsWith("http://") || url.startsWith("https://");
    const u = new URL(url, absolute ? undefined : "https://local.invalid");
    u.searchParams.delete("t");
    u.searchParams.delete("v");
    u.searchParams.delete("seed");
    u.searchParams.set("t", String(Date.now()));
    if (absolute) return u.toString();
    const path = u.pathname + u.search;
    return path.startsWith("/") ? `${url.split("?")[0]}${u.search}` : url;
  } catch {
    const clean = url.split("?")[0] || url;
    return `${clean}?t=${Date.now()}`;
  }
}

/** Persistable URL without ephemeral cache-bust params. */
export function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const u = new URL(url);
      u.searchParams.delete("t");
      u.searchParams.delete("v");
      u.searchParams.delete("seed");
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url.split("?")[0] || url;
}
