/**
 * Safe campaign post parsing — NEVER treat a string as a post array
 * (avoids the "מ" bug from result[0] on Hebrew strings).
 */

export type CampaignPost = {
  title: string;
  hook: string;
  body: string;
  cta: string;
};

const DEFAULT_CTA = "\u05dc\u05ea\u05d9\u05d0\u05d5\u05dd \u05d5\u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function strField(
  obj: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function normalizeCampaignPost(
  raw: unknown,
  index: number
): CampaignPost | null {
  // Reject single characters / string indexing mistakes
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.length < 8) return null;
    const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    return {
      title: lines[0]!.slice(0, 80),
      hook: lines[1]?.slice(0, 120) || lines[0]!.slice(0, 80),
      body: lines.slice(1).join("\n") || t,
      cta: DEFAULT_CTA,
    };
  }

  const obj = asRecord(raw);
  if (!obj) return null;

  const title =
    strField(obj, "title", "headline", "heading") ||
    `\u05e4\u05d5\u05e1\u05d8 ${index + 1}`;
  const hook = strField(obj, "hook", "subtitle", "lead");
  const body =
    strField(obj, "body", "text", "postText", "content") || hook || title;
  const cta = strField(obj, "cta", "call_to_action", "callToAction") || DEFAULT_CTA;

  if (title.length < 2 && body.length < 8) return null;

  return { title, hook: hook || title, body, cta };
}

/** Empty — never inject canned marketing when AI fails. */
function fallbackCampaignPosts(_topic?: string): CampaignPost[] {
  return [];
}

/**
 * Force exactly 3 CampaignPost objects. Never returns string characters.
 */
export function parseCampaignPosts(
  raw: unknown,
  topic?: string
): CampaignPost[] {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // CRITICAL: do not use trimmed[0] as a post
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      const chunks = trimmed
        .split(/\n{2,}|---+|(?=\n\d+[\.\)]\s)/)
        .map((c) => c.trim())
        .filter((c) => c.length >= 8);
      if (chunks.length >= 1) {
        const posts = chunks
          .slice(0, 3)
          .map((c, i) => normalizeCampaignPost(c, i))
          .filter((p): p is CampaignPost => Boolean(p));
        if (posts.length >= 1) return posts.slice(0, 3);
      }
      return fallbackCampaignPosts(topic);
    }
  }

  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const obj = candidate as Record<string, unknown>;
    if (Array.isArray(obj.posts)) candidate = obj.posts;
    else if (Array.isArray(obj.campaign)) candidate = obj.campaign;
    else if (Array.isArray(obj.items)) candidate = obj.items;
  }

  if (!Array.isArray(candidate)) {
    return fallbackCampaignPosts(topic);
  }

  // Guard: if somehow we got a string coerced to char array via spread, reject short items
  const posts: CampaignPost[] = [];
  for (let i = 0; i < candidate.length && posts.length < 3; i++) {
    const item = candidate[i];
    if (typeof item === "string" && item.length < 8) continue;
    const normalized = normalizeCampaignPost(item, posts.length);
    if (normalized) posts.push(normalized);
  }

  // Return only real AI posts — never pad with canned marketing templates
  return posts.slice(0, 3);
}

export function isCampaignPostsArray(v: unknown): v is CampaignPost[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as CampaignPost).title === "string" &&
        typeof (p as CampaignPost).body === "string" &&
        (p as CampaignPost).title.length >= 2 &&
        (p as CampaignPost).body.length >= 4
    )
  );
}

export function buildLocalCampaignPosts(topic: string): CampaignPost[] {
  return parseCampaignPosts(null, topic);
}
