/**
 * Guest vs Auth client storage.
 *
 * Guest (userId null): ALL business draft data → sessionStorage only.
 * Auth (userId set): local cache under `user_data_${userId}:*` (+ Supabase sync elsewhere).
 *
 * OAuth bridge: before Google redirect, copy session draft into localStorage pending keys
 * (`olar-onboarding-pending` / profile-backup / post-backup). After auth success, migrate
 * into `user_data_${id}` then clear pending (see OlarApp finalizeAuthTransition).
 */
"use client";

export const LEGACY_KEYS = [
  "olar-onboarding-done",
  "olar-business-profile",
  "olar-work-mode",
  "current_business_post",
  "olar-yona-idea",
  "olar-daily-freq",
  "olar-selected-category",
  "olar-appointments",
  "olar-calendar-events",
] as const;

export type StorageLogicalKey =
  | "onboarding-done"
  | "business-profile"
  | "work-mode"
  | "current-post"
  | "yona-idea"
  | "daily-freq"
  | "selected-category"
  | "appointments"
  | "calendar-events";

const LOGICAL_TO_SUFFIX: Record<StorageLogicalKey, string> = {
  "onboarding-done": "olar-onboarding-done",
  "business-profile": "olar-business-profile",
  "work-mode": "olar-work-mode",
  "current-post": "current_business_post",
  "yona-idea": "olar-yona-idea",
  "daily-freq": "olar-daily-freq",
  "selected-category": "olar-selected-category",
  appointments: "olar-appointments",
  "calendar-events": "olar-calendar-events",
};

const AUTH_USER_ID_KEY = "olar-auth-user-id";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Cached auth user id for sync storage helpers (set by auth-client). */
export function getCachedAuthUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(AUTH_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setCachedAuthUserId(userId: string | null): void {
  if (!isBrowser()) return;
  try {
    if (userId) localStorage.setItem(AUTH_USER_ID_KEY, userId);
    else localStorage.removeItem(AUTH_USER_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function isGuestMode(): boolean {
  return !getCachedAuthUserId();
}

function userPrefixedKey(userId: string, logical: StorageLogicalKey): string {
  return `user_data_${userId}:${LOGICAL_TO_SUFFIX[logical]}`;
}

function guestKey(logical: StorageLogicalKey): string {
  return LOGICAL_TO_SUFFIX[logical];
}

/** Read draft value — guest: sessionStorage; auth: user_data_${id}:* */
export function storageGet(logical: StorageLogicalKey): string | null {
  if (!isBrowser()) return null;
  const userId = getCachedAuthUserId();
  try {
    if (!userId) {
      return sessionStorage.getItem(guestKey(logical));
    }
    const prefixed = localStorage.getItem(userPrefixedKey(userId, logical));
    if (prefixed != null) return prefixed;
    // One-time migrate legacy flat localStorage → user prefix
    const legacy = localStorage.getItem(LOGICAL_TO_SUFFIX[logical]);
    if (legacy != null) {
      localStorage.setItem(userPrefixedKey(userId, logical), legacy);
      try {
        localStorage.removeItem(LOGICAL_TO_SUFFIX[logical]);
      } catch {
        /* ignore */
      }
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/** Write draft value — guest: sessionStorage only; auth: isolated user prefix */
export function storageSet(logical: StorageLogicalKey, value: string): void {
  if (!isBrowser()) return;
  const userId = getCachedAuthUserId();
  try {
    if (!userId) {
      sessionStorage.setItem(guestKey(logical), value);
      return;
    }
    localStorage.setItem(userPrefixedKey(userId, logical), value);
  } catch {
    /* ignore */
  }
}

export function storageRemove(logical: StorageLogicalKey): void {
  if (!isBrowser()) return;
  const userId = getCachedAuthUserId();
  try {
    if (!userId) {
      sessionStorage.removeItem(guestKey(logical));
      return;
    }
    localStorage.removeItem(userPrefixedKey(userId, logical));
  } catch {
    /* ignore */
  }
}

/** Clear all keys under user_data_${userId}:* */
export function clearUserDataCache(userId: string): void {
  if (!isBrowser() || !userId) return;
  const prefix = `user_data_${userId}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Remove legacy flat localStorage draft keys (never leave for next guest). */
export function clearLegacyLocalDraftKeys(): void {
  if (!isBrowser()) return;
  for (const k of LEGACY_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/** Clear guest session draft data. */
export function clearGuestSessionStorage(): void {
  if (!isBrowser()) return;
  try {
    for (const logical of Object.keys(LOGICAL_TO_SUFFIX) as StorageLogicalKey[]) {
      sessionStorage.removeItem(guestKey(logical));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Guest entry / logout cleanup:
 * sessionStorage.clear() + drop legacy user_cache + guest draft keys.
 */
export function clearGuestSession(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem("user_cache");
  } catch {
    /* ignore */
  }
  clearGuestSessionStorage();
  clearLegacyLocalDraftKeys();
  setCachedAuthUserId(null);
}

/**
 * Full wipe on sign-out / restart: user cache + session + legacy flat keys.
 * Keeps OAuth pending bridge keys until migrate finishes (caller may clear those).
 */
export function clearAllClientDrafts(opts?: {
  userId?: string | null;
  clearOAuthBridge?: boolean;
}): void {
  const uid = opts?.userId ?? getCachedAuthUserId();
  if (uid) clearUserDataCache(uid);
  clearGuestSessionStorage();
  clearLegacyLocalDraftKeys();
  if (opts?.clearOAuthBridge !== false) {
    try {
      localStorage.removeItem("olar-onboarding-pending");
      localStorage.removeItem("olar-onboarding-profile-backup");
      localStorage.removeItem("olar-onboarding-post-backup");
    } catch {
      /* ignore */
    }
  }
  setCachedAuthUserId(null);
}

/**
 * Copy current guest session draft into localStorage OAuth bridge keys
 * so the round-trip can restore after Google redirect.
 */
export function stageOAuthBridgeFromSession(): void {
  if (!isBrowser()) return;
  try {
    const profile = sessionStorage.getItem(guestKey("business-profile"));
    const post = sessionStorage.getItem(guestKey("current-post"));
    localStorage.setItem("olar-onboarding-pending", "1");
    if (profile) {
      localStorage.setItem("olar-onboarding-profile-backup", profile);
    }
    if (post) {
      localStorage.setItem("olar-onboarding-post-backup", post);
    }
  } catch {
    /* ignore */
  }
}

/**
 * After auth: move bridge / legacy into user_data_${userId} and drop pending.
 */
export function migrateBridgeToUser(userId: string): void {
  if (!isBrowser() || !userId) return;
  setCachedAuthUserId(userId);
  try {
    const profile =
      localStorage.getItem("olar-onboarding-profile-backup") ||
      sessionStorage.getItem(guestKey("business-profile")) ||
      localStorage.getItem("olar-business-profile");
    const post =
      localStorage.getItem("olar-onboarding-post-backup") ||
      sessionStorage.getItem(guestKey("current-post")) ||
      localStorage.getItem("current_business_post");
    if (profile) {
      localStorage.setItem(userPrefixedKey(userId, "business-profile"), profile);
    }
    if (post) {
      localStorage.setItem(userPrefixedKey(userId, "current-post"), post);
    }
    localStorage.setItem(userPrefixedKey(userId, "onboarding-done"), "1");
    localStorage.removeItem("olar-onboarding-pending");
    localStorage.removeItem("olar-onboarding-profile-backup");
    localStorage.removeItem("olar-onboarding-post-backup");
    clearLegacyLocalDraftKeys();
    clearGuestSessionStorage();
  } catch {
    /* ignore */
  }
}

let beforeUnloadBound = false;

/** Guest: wipe session drafts when the tab closes. */
export function bindGuestSessionCleanup(): void {
  if (!isBrowser() || beforeUnloadBound) return;
  beforeUnloadBound = true;
  window.addEventListener("beforeunload", () => {
    if (isGuestMode()) {
      try {
        clearGuestSession();
      } catch {
        /* ignore */
      }
    }
  });
}

export { stripCategoryLeak } from "./strip-category";
