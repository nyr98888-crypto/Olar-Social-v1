import { NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
  isGuestModeAllowed,
} from "@/lib/guest";

export const runtime = "nodejs";

/** Enter local guest mode — only when Supabase is not configured. */
export async function POST() {
  if (!isGuestModeAllowed()) {
    return NextResponse.json(
      {
        error:
          "Guest mode is disabled while Supabase is configured. Use Google sign-in.",
      },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ ok: true, mode: "guest" });
  res.cookies.set(GUEST_COOKIE, GUEST_COOKIE_VALUE, guestCookieOptions());
  return res;
}

/** Leave guest mode. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GUEST_COOKIE, "", { ...guestCookieOptions(0), maxAge: 0 });
  return res;
}
