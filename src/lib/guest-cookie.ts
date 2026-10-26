/** Edge-safe guest cookie constants (no next/headers). */

export const GUEST_COOKIE = "yona_guest_mode";
export const GUEST_COOKIE_VALUE = "1";

export function guestCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
