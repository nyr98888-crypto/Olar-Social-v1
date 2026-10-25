import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Cookie flag for local guest/dev sessions. Only valid when Supabase is unset. */
export const GUEST_COOKIE = "yona_guest_mode";
export const GUEST_COOKIE_VALUE = "1";

export const GUEST_USER = {
  id: "guest-local",
  email: "guest@local",
  name: "אורח (מקומי)",
  avatarUrl: null as string | null,
} as const;

export function isGuestModeAllowed(): boolean {
  return !isSupabaseConfigured();
}

export async function hasGuestCookie(): Promise<boolean> {
  if (!isGuestModeAllowed()) return false;
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value === GUEST_COOKIE_VALUE;
}

export function guestCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
