import { cookies } from "next/headers";

/** Cookie flag for local guest sessions — always available as secondary access. */
export const GUEST_COOKIE = "yona_guest_mode";
export const GUEST_COOKIE_VALUE = "1";

export const GUEST_USER = {
  id: "guest-local",
  email: "guest@local",
  name: "אורח (מקומי)",
  avatarUrl: null as string | null,
} as const;

/** Guest entry is always allowed (quick access / Google unavailable). */
export function isGuestModeAllowed(): boolean {
  return true;
}

export async function hasGuestCookie(): Promise<boolean> {
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
