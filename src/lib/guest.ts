import { cookies } from "next/headers";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
} from "./guest-cookie";

export {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
} from "./guest-cookie";

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
