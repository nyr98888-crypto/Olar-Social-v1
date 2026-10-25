import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Test New User (Reset Session): wipe conversations/messages for the
 * authenticated user so the UI behaves like a clean first visit.
 * Profile + auth session stay intact. Guest: client clears local state only.
 */
export async function POST() {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.mode === "guest") {
      return NextResponse.json({ ok: true, reset: true, guestMode: true });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("profiles").upsert(
      {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.name,
        avatar_url: session.user.avatarUrl,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true, reset: true });
  } catch (err) {
    console.error("[api/session/reset]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
