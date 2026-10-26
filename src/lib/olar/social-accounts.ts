/**
 * Dual-track publishing: api_business (Meta Graph) vs assisted_personal (3-click handoff).
 * Client-safe config lives alongside connections; tokens stay server-side when possible.
 */

import type { AccountKind } from "./types";
import type { ConnEntry, ConnectionsState } from "./connections";

export type SocialPlatform = "facebook" | "instagram";
export type PublishMode = "api_business" | "assisted_personal";

/** Full shape (server may hold secrets; client must not persist accessToken). */
export interface SocialAccountConfig {
  platform: SocialPlatform;
  mode: PublishMode;
  profileUrl?: string;
  isConnected: boolean;
  /** Server-only when possible — never log or expose in full to client. */
  accessToken?: string;
  pageId?: string;
}

/** Safe for client UI / localStorage. */
export interface SocialAccountPublic {
  platform: SocialPlatform;
  mode: PublishMode;
  profileUrl?: string;
  isConnected: boolean;
  /** True when server has token+pageId (api_business). */
  hasCredentials: boolean;
  pageId?: string;
}

export const DEFAULT_PUBLISH_MODE: PublishMode = "assisted_personal";

export function kindToPublishMode(
  kind: AccountKind | null | undefined
): PublishMode {
  if (kind === "business") return "api_business";
  return "assisted_personal";
}

export function publishModeToKind(mode: PublishMode): AccountKind {
  return mode === "api_business" ? "business" : "personal";
}

/** Resolve mode from ConnEntry (mode field wins; else kind; else safer default). */
export function resolvePublishMode(entry: ConnEntry | undefined): PublishMode {
  if (!entry) return DEFAULT_PUBLISH_MODE;
  if (entry.mode === "api_business" || entry.mode === "assisted_personal") {
    return entry.mode;
  }
  return kindToPublishMode(entry.kind);
}

export function accountFromConn(
  platform: SocialPlatform,
  entry: ConnEntry | undefined
): SocialAccountPublic {
  const mode = resolvePublishMode(entry);
  const connected = Boolean(entry?.connected);
  return {
    platform,
    mode,
    profileUrl: entry?.pageUrl?.trim() || undefined,
    isConnected: connected,
    hasCredentials: false,
    pageId: entry?.pageId?.trim() || undefined,
  };
}

export function getSocialAccount(
  networks: ConnectionsState,
  platform: SocialPlatform
): SocialAccountPublic {
  return accountFromConn(platform, networks[platform]);
}

export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Destination for assisted handoff. */
export function assistedDestinationUrl(
  platform: SocialPlatform,
  profileUrl?: string | null
): string {
  const trimmed = profileUrl?.trim();
  if (trimmed && isHttpUrl(trimmed)) return trimmed;
  if (platform === "instagram") return "https://www.instagram.com/";
  return "https://www.facebook.com/";
}

/** Strip secrets before any client JSON / logs. */
export function toPublicAccount(
  cfg: SocialAccountConfig & { hasCredentials?: boolean }
): SocialAccountPublic {
  const hasToken = Boolean(cfg.accessToken?.trim());
  const hasPage = Boolean(cfg.pageId?.trim());
  return {
    platform: cfg.platform,
    mode: cfg.mode,
    profileUrl: cfg.profileUrl,
    isConnected: cfg.isConnected,
    hasCredentials:
      cfg.hasCredentials ?? (cfg.mode === "api_business" && hasToken && hasPage),
    pageId: cfg.pageId,
  };
}
