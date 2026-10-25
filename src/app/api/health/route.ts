import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight connection probe for the header status indicator. */
export async function GET() {
  const started = Date.now();
  try {
    // Prefer unified session (guest cookie OR Supabase user) so guests are not
    // reported as "offline" when auth.getUser() returns "Auth session missing!".
    const session = await getAppSession();
    if (session?.mode === "guest") {
      return NextResponse.json({
        ok: true,
        connected: true,
        authenticated: true,
        guestMode: true,
        latencyMs: Date.now() - started,
      });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        ok: Boolean(session),
        connected: Boolean(session),
        authenticated: Boolean(session),
        guestMode: true,
        latencyMs: Date.now() - started,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && !user) {
      // No Supabase user — still "connected" if we somehow have a session
      if (session) {
        return NextResponse.json({
          ok: true,
          connected: true,
          authenticated: true,
          latencyMs: Date.now() - started,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          authenticated: false,
          latencyMs: Date.now() - started,
          error: error.message,
        },
        { status: 200 }
      );
    }

    if (user) {
      void supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            null,
          avatar_url:
            (user.user_metadata?.avatar_url as string | undefined) || null,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      authenticated: Boolean(user),
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        authenticated: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "health failed",
      },
      { status: 200 }
    );
  }
}
