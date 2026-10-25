import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, getSupabaseEnv } from "./config";
import { GUEST_COOKIE, GUEST_COOKIE_VALUE } from "@/lib/guest";

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function isGuestRequest(request: NextRequest): boolean {
  return request.cookies.get(GUEST_COOKIE)?.value === GUEST_COOKIE_VALUE;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isGuest = isGuestRequest(request);

  // No Supabase keys: guest cookie gate only.
  if (!isSupabaseConfigured()) {
    const isAuthRoute =
      path.startsWith("/login") ||
      path.startsWith("/auth") ||
      path.startsWith("/api/guest") ||
      path.startsWith("/api/health");

    if (!isGuest && path === "/") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (isGuest && path === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }

    if (!isGuest && !isAuthRoute && path.startsWith("/api/")) {
      // Let route handlers return 401 JSON; avoid HTML redirects for APIs
      return supabaseResponse;
    }

    return supabaseResponse;
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    path.startsWith("/login") || path.startsWith("/auth");

  // Guest cookie lets users into workspace without Google.
  if (!user && isGuest) {
    if (path === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  if (!user && !isAuthRoute && path === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
