import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight connection probe for the header status indicator. */
export async function GET() {
  const started = Date.now();
  try {
    if (!isSupabaseConfigured()) {
      const session = await getAppSession();
      return NextResponse.json({
        ok: true,
        connected: true,
        authenticated: session?.mode === "guest",
        guestMode: true,
        latencyMs: Date.now() - started,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
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
