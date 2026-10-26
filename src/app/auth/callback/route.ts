import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  GUEST_COOKIE,
  guestCookieOptions,
} from "@/lib/guest-cookie";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata?.full_name as string | undefined) ||
              (user.user_metadata?.name as string | undefined) ||
              null,
            avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) || null,
            updated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }

      // Clear guest cookie so session is real auth going forward.
      // Client (OlarApp) migrates current_business_post from localStorage → Supabase.
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.set(GUEST_COOKIE, "", {
        ...guestCookieOptions(0),
        maxAge: 0,
      });
      res.cookies.set("olar_oauth_just_done", "1", {
        path: "/",
        maxAge: 120,
        sameSite: "lax",
      });
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
