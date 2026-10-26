import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_COOKIE,
  GUEST_COOKIE_VALUE,
  guestCookieOptions,
} from "@/lib/guest-cookie";

/**
 * Prototype mode: guest cookie for free access.
 * OAuth callback MUST run — never redirect /auth/callback away (code exchange).
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Google / Supabase OAuth return — exchange code, do not strip query
  if (path.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  // Just-authenticated window: do not re-stamp guest over a fresh session
  if (request.cookies.get("olar_oauth_just_done")?.value === "1") {
    return NextResponse.next({ request });
  }

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
