import { NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
} from "@/lib/guest";

export const runtime = "nodejs";

/** Enter guest mode — always available (even when Supabase is configured). */
export async function POST() {
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
