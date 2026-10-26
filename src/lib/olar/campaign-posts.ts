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

function fallbackCampaignPosts(topic?: string): CampaignPost[] {
  const t = (topic || "").trim().slice(0, 60);
  const topicBit = t
    ? `\n${t}`
    : "";
  return [
    {
      title: "\u05d4\u05e9\u05d1\u05d5\u05e2 \u05d0\u05e6\u05dc\u05e0\u05d5 \u2014 \u05de\u05d5\u05db\u05e0\u05d9\u05dd \u05dc\u05db\u05dd",
      hook: "\u05e9\u05d9\u05e8\u05d5\u05ea \u05de\u05d4\u05d9\u05e8 \u05d1\u05d9\u05d7\u05e1 \u05d0\u05d9\u05e9\u05d9",
      body:
        `\u05d0\u05dd \u05d7\u05d9\u05e4\u05e9\u05ea\u05dd \u05e9\u05d9\u05e8\u05d5\u05ea \u05d0\u05de\u05d9\u05df \u05dc\u05d9\u05d3 \u05d4\u05d1\u05d9\u05ea \u2014 \u05d4\u05d2\u05e2\u05ea\u05dd \u05dc\u05de\u05e7\u05d5\u05dd \u05d4\u05e0\u05db\u05d5\u05df.${topicBit}\n\u05db\u05ea\u05d1\u05d5 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05d5\u05e0\u05d7\u05d6\u05d5\u05e8 \u05d1\u05de\u05d4\u05d9\u05e8\u05d5\u05ea.`,
      cta: DEFAULT_CTA,
    },
    {
      title: "\u05ea\u05d9\u05d0\u05d5\u05dd \u05de\u05d4\u05d9\u05e8 \u2014 \u05d1\u05dc\u05d9 \u05dc\u05d7\u05e5",
      hook: "\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
      body:
        `\u05e0\u05e9\u05de\u05d7 \u05dc\u05ea\u05d0\u05dd \u05dc\u05db\u05dd \u05e9\u05e2\u05d4 \u05e0\u05d5\u05d7\u05d4 \u05d5\u05dc\u05ea\u05ea \u05d4\u05e6\u05e2\u05ea \u05de\u05d7\u05d9\u05e8 \u05d1\u05e8\u05d5\u05e8\u05d4.${topicBit}\n\u05e9\u05dc\u05d7\u05d5 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05e7\u05e6\u05e8\u05d4 \u2014 \u05d5\u05e0\u05d7\u05d6\u05d5\u05e8.`,
      cta: DEFAULT_CTA,
    },
    {
      title: "\u05de\u05d4\u05e9\u05d8\u05d7 \u05e9\u05dc\u05e0\u05d5 \u2014 \u05d9\u05d7\u05e1 \u05e9\u05de\u05e8\u05d2\u05d9\u05e9\u05d9\u05dd",
      hook: "\u05e2\u05e1\u05e7 \u05de\u05e7\u05d5\u05de\u05d9 \u05e9\u05d0\u05e4\u05e9\u05e8 \u05dc\u05e1\u05de\u05d5\u05da \u05e2\u05dc\u05d9\u05d5",
      body:
        `\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e0\u05e7\u05d9\u05d9\u05d4, \u05d4\u05e1\u05d1\u05e8\u05d5\u05ea \u05d1\u05e8\u05d5\u05e8\u05d5\u05ea, \u05d5\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d0\u05e0\u05d5\u05e9\u05d9\u05ea.${topicBit}\n\u05db\u05ea\u05d1\u05d5 \u05dc\u05e0\u05d5 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05dc\u05e4\u05e8\u05d8\u05d9\u05dd.`,
      cta: DEFAULT_CTA,
    },
  ];
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
        if (posts.length >= 1) {
          while (posts.length < 3) {
            posts.push(fallbackCampaignPosts(topic)[posts.length]!);
          }
          return posts.slice(0, 3);
        }
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

  if (posts.length === 0) return fallbackCampaignPosts(topic);
  const fill = fallbackCampaignPosts(topic);
  while (posts.length < 3) {
    posts.push(fill[posts.length]!);
  }
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
