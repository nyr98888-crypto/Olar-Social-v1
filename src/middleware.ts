import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
} from "@/lib/guest-cookie";

/**
 * Prototype mode: permanent Guest bypass.
 * No Supabase / Google checks — every visit gets a guest cookie and free access.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/login") || path.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const res = NextResponse.redirect(url);
    res.cookies.set(GUEST_COOKIE, GUEST_COOKIE_VALUE, guestCookieOptions());
    return res;
  }

  const res = NextResponse.next({ request });
  if (request.cookies.get(GUEST_COOKIE)?.value !== GUEST_COOKIE_VALUE) {
    res.cookies.set(GUEST_COOKIE, GUEST_COOKIE_VALUE, guestCookieOptions());
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
