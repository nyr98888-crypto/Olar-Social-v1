/**
 * Maya Wingman — persistent marketing memory (Supabase user_marketing_profiles).
 * Soft-fails when table/session missing so guests and pre-migration envs stay safe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostTypeId } from "@/lib/olar/post-types";

export const RECENT_WINS_CAP = 5;

export type MarketingWin =
  | string
  | {
      text: string;
      at?: string;
      postType?: string | null;
    };

export type UserMarketingProfile = {
  user_id: string;
  business_name: string | null;
  owner_name: string | null;
  category: string | null;
  tone_preference: string | null;
  last_activity_at: string | null;
  last_post_topic: string | null;
  recent_wins: MarketingWin[];
  total_posts_created: number;
  updated_at?: string | null;
};

export type MarketingProfileUpsert = {
  business_name?: string | null;
  owner_name?: string | null;
  category?: string | null;
  tone_preference?: string | null;
  last_activity_at?: string | null;
  last_post_topic?: string | null;
  recent_wins?: MarketingWin[];
  total_posts_created?: number;
};

export type RecordPostActivityInput = {
  topic: string;
  win?: string | null;
  postType?: PostTypeId | string | null;
  /** Optional enrichment on first write */
  businessName?: string | null;
  ownerName?: string | null;
  category?: string | null;
  tonePreference?: string | null;
};

const TABLE = "user_marketing_profiles";

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string };
  const msg = `${e.message || ""} ${e.details || ""}`.toLowerCase();
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("user_marketing_profiles")
  );
}

function normalizeWins(raw: unknown): MarketingWin[] {
  if (!Array.isArray(raw)) return [];
  const out: MarketingWin[] = [];
  for (const w of raw) {
    if (typeof w === "string") {
      const t = w.trim();
      if (t) out.push(t);
      continue;
    }
    if (w && typeof w === "object" && "text" in w) {
      const text = String((w as { text?: unknown }).text || "").trim();
      if (!text) continue;
      out.push({
        text,
        at:
          typeof (w as { at?: unknown }).at === "string"
            ? (w as { at: string }).at
            : undefined,
        postType:
          typeof (w as { postType?: unknown }).postType === "string"
            ? (w as { postType: string }).postType
            : null,
      });
    }
  }
  return out.slice(0, RECENT_WINS_CAP);
}

function mapRow(row: Record<string, unknown>): UserMarketingProfile {
  return {
    user_id: String(row.user_id),
    business_name:
      typeof row.business_name === "string" ? row.business_name : null,
    owner_name: typeof row.owner_name === "string" ? row.owner_name : null,
    category: typeof row.category === "string" ? row.category : null,
    tone_preference:
      typeof row.tone_preference === "string" ? row.tone_preference : null,
    last_activity_at:
      typeof row.last_activity_at === "string" ? row.last_activity_at : null,
    last_post_topic:
      typeof row.last_post_topic === "string" ? row.last_post_topic : null,
    recent_wins: normalizeWins(row.recent_wins),
    total_posts_created:
      typeof row.total_posts_created === "number"
        ? row.total_posts_created
        : Number(row.total_posts_created) || 0,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** Safe subset for API / UI (no internal timestamps beyond last_activity). */
export function toSafeMarketingProfile(
  profile: UserMarketingProfile | null
): {
  business_name: string | null;
  owner_name: string | null;
  category: string | null;
  tone_preference: string | null;
  last_activity_at: string | null;
  last_post_topic: string | null;
  recent_wins: MarketingWin[];
  total_posts_created: number;
} | null {
  if (!profile) return null;
  return {
    business_name: profile.business_name,
    owner_name: profile.owner_name,
    category: profile.category,
    tone_preference: profile.tone_preference,
    last_activity_at: profile.last_activity_at,
    last_post_topic: profile.last_post_topic,
    recent_wins: profile.recent_wins,
    total_posts_created: profile.total_posts_created,
  };
}

export async function getMarketingProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMarketingProfile | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "user_id, business_name, owner_name, category, tone_preference, last_activity_at, last_post_topic, recent_wins, total_posts_created, updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        console.warn(
          "[marketing-profile] table missing — soft skip get",
          error.message
        );
        return null;
      }
      console.warn("[marketing-profile] get failed", error.message);
      return null;
    }
    if (!data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch (err) {
    console.warn(
      "[marketing-profile] get threw",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function upsertMarketingProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: MarketingProfileUpsert
): Promise<UserMarketingProfile | null> {
  try {
    const existing = await getMarketingProfile(supabase, userId);
    const row = {
      user_id: userId,
      business_name:
        patch.business_name !== undefined
          ? patch.business_name
          : existing?.business_name ?? null,
      owner_name:
        patch.owner_name !== undefined
          ? patch.owner_name
          : existing?.owner_name ?? null,
      category:
        patch.category !== undefined
          ? patch.category
          : existing?.category ?? null,
      tone_preference:
        patch.tone_preference !== undefined
          ? patch.tone_preference
          : existing?.tone_preference ?? null,
      last_activity_at:
        patch.last_activity_at !== undefined
          ? patch.last_activity_at
          : existing?.last_activity_at ?? null,
      last_post_topic:
        patch.last_post_topic !== undefined
          ? patch.last_post_topic
          : existing?.last_post_topic ?? null,
      recent_wins:
        patch.recent_wins !== undefined
          ? normalizeWins(patch.recent_wins)
          : existing?.recent_wins ?? [],
      total_posts_created:
        patch.total_posts_created !== undefined
          ? patch.total_posts_created
          : existing?.total_posts_created ?? 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "user_id" })
      .select(
        "user_id, business_name, owner_name, category, tone_preference, last_activity_at, last_post_topic, recent_wins, total_posts_created, updated_at"
      )
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        console.warn(
          "[marketing-profile] table missing — soft skip upsert",
          error.message
        );
        return null;
      }
      console.warn("[marketing-profile] upsert failed", error.message);
      return null;
    }
    if (!data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch (err) {
    console.warn(
      "[marketing-profile] upsert threw",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * After a successful post/campaign: bump counters + activity memory.
 * Soft-fails if table missing.
 */
export async function recordPostActivity(
  supabase: SupabaseClient,
  userId: string,
  input: RecordPostActivityInput
): Promise<UserMarketingProfile | null> {
  try {
    const topic = (input.topic || "").trim().slice(0, 280);
    if (!topic) return null;

    const existing = await getMarketingProfile(supabase, userId);
    const now = new Date().toISOString();
    const winText = (input.win || topic).trim().slice(0, 200);
    const nextWins: MarketingWin[] = [
      {
        text: winText,
        at: now,
        postType: input.postType || null,
      },
      ...(existing?.recent_wins || []),
    ].slice(0, RECENT_WINS_CAP);

    return upsertMarketingProfile(supabase, userId, {
      business_name: input.businessName ?? undefined,
      owner_name: input.ownerName ?? undefined,
      category: input.category ?? undefined,
      tone_preference: input.tonePreference ?? undefined,
      last_activity_at: now,
      last_post_topic: topic,
      recent_wins: nextWins,
      total_posts_created: (existing?.total_posts_created || 0) + 1,
    });
  } catch (err) {
    console.warn(
      "[marketing-profile] recordPostActivity soft-fail",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** LLM system-prompt block from marketing activity memory. */
export function buildWingmanActivityMemoryBlock(
  profile: UserMarketingProfile | null | undefined
): string {
  if (!profile) return "";

  const wins = profile.recent_wins
    .map((w) => (typeof w === "string" ? w : w.text))
    .filter(Boolean)
    .slice(0, RECENT_WINS_CAP);

  const lines = [
    profile.business_name
      ? `- business_name: ${profile.business_name}`
      : null,
    profile.owner_name ? `- owner_name: ${profile.owner_name}` : null,
    profile.category ? `- category: ${profile.category}` : null,
    profile.tone_preference
      ? `- tone_preference: ${profile.tone_preference}`
      : null,
    profile.last_post_topic
      ? `- last_post_topic: ${profile.last_post_topic}`
      : null,
    wins.length
      ? `- recent_wins: ${wins.map((w) => `"${w}"`).join("; ")}`
      : null,
    `- total_posts_created: ${profile.total_posts_created}`,
  ].filter(Boolean);

  if (lines.length <= 1 && !profile.last_post_topic && !wins.length) {
    return "";
  }

  return `
## Partner memory (Wingman activity — System State)
Use for continuity in chat_reply. Reference past topics/wins when natural. Never invent wins beyond this list.
${lines.join("\n")}
`;
}
