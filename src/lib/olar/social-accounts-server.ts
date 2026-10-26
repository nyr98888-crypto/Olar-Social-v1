/**
 * Server-side social account secrets (profiles.social_accounts jsonb).
 * Soft-fails if column/table missing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PUBLISH_MODE,
  toPublicAccount,
  type PublishMode,
  type SocialAccountConfig,
  type SocialAccountPublic,
  type SocialPlatform,
} from "./social-accounts";

type StoredMap = Partial<Record<SocialPlatform, SocialAccountConfig>>;

function parseStored(raw: unknown): StoredMap {
  if (!raw || typeof raw !== "object") return {};
  const out: StoredMap = {};
  for (const platform of ["facebook", "instagram"] as const) {
    const row = (raw as Record<string, unknown>)[platform];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const mode: PublishMode =
      r.mode === "api_business" ? "api_business" : DEFAULT_PUBLISH_MODE;
    out[platform] = {
      platform,
      mode,
      profileUrl: typeof r.profileUrl === "string" ? r.profileUrl : undefined,
      isConnected: Boolean(r.isConnected),
      accessToken:
        typeof r.accessToken === "string" ? r.accessToken : undefined,
      pageId: typeof r.pageId === "string" ? r.pageId : undefined,
    };
  }
  return out;
}

export async function loadSocialAccountsServer(
  supabase: SupabaseClient,
  userId: string
): Promise<{ map: StoredMap; softFailed: boolean }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("social_accounts")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn(
        "[social-accounts] load soft-fail",
        error.code || error.message
      );
      return { map: {}, softFailed: true };
    }

    return {
      map: parseStored(data?.social_accounts),
      softFailed: false,
    };
  } catch (err) {
    console.warn(
      "[social-accounts] load soft-fail",
      err instanceof Error ? err.message : err
    );
    return { map: {}, softFailed: true };
  }
}

export function publicAccountsFromMap(
  map: StoredMap
): Record<SocialPlatform, SocialAccountPublic> {
  const empty = (platform: SocialPlatform): SocialAccountPublic =>
    toPublicAccount({
      platform,
      mode: DEFAULT_PUBLISH_MODE,
      isConnected: false,
    });

  return {
    facebook: map.facebook
      ? toPublicAccount(map.facebook)
      : empty("facebook"),
    instagram: map.instagram
      ? toPublicAccount(map.instagram)
      : empty("instagram"),
  };
}

export async function upsertSocialAccountServer(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  platform: SocialPlatform,
  patch: Partial<SocialAccountConfig>
): Promise<{ ok: boolean; public: SocialAccountPublic; softFailed: boolean }> {
  const { map, softFailed: loadFail } = await loadSocialAccountsServer(
    supabase,
    userId
  );

  const prev = map[platform] || {
    platform,
    mode: DEFAULT_PUBLISH_MODE,
    isConnected: false,
  };

  const next: SocialAccountConfig = {
    ...prev,
    ...patch,
    platform,
    // Never clear token unless explicitly set to empty string
    accessToken:
      patch.accessToken !== undefined
        ? patch.accessToken.trim() || undefined
        : prev.accessToken,
    pageId:
      patch.pageId !== undefined
        ? patch.pageId.trim() || undefined
        : prev.pageId,
    profileUrl:
      patch.profileUrl !== undefined
        ? patch.profileUrl.trim() || undefined
        : prev.profileUrl,
    mode: patch.mode ?? prev.mode ?? DEFAULT_PUBLISH_MODE,
    isConnected: patch.isConnected ?? prev.isConnected ?? false,
  };

  const nextMap: StoredMap = { ...map, [platform]: next };

  try {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: email ?? undefined,
      social_accounts: nextMap,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(
        "[social-accounts] upsert soft-fail",
        error.code || error.message
      );
      return {
        ok: false,
        public: toPublicAccount(next),
        softFailed: true,
      };
    }

    return { ok: true, public: toPublicAccount(next), softFailed: false };
  } catch (err) {
    console.warn(
      "[social-accounts] upsert soft-fail",
      err instanceof Error ? err.message : err
    );
    return {
      ok: false,
      public: toPublicAccount(next),
      softFailed: true,
    };
  }
}

export async function getCredentialsForPublish(
  supabase: SupabaseClient,
  userId: string,
  platform: SocialPlatform
): Promise<{
  mode: PublishMode;
  accessToken?: string;
  pageId?: string;
  softFailed: boolean;
}> {
  const { map, softFailed } = await loadSocialAccountsServer(supabase, userId);
  const row = map[platform];
  return {
    mode: row?.mode ?? DEFAULT_PUBLISH_MODE,
    accessToken: row?.accessToken,
    pageId: row?.pageId,
    softFailed,
  };
}
