import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

/** Load the user's most recent conversation + messages (F5 restore). */
export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guest: nothing to restore from DB
  if (session.mode === "guest") {
    return NextResponse.json({
      conversation: null,
      messages: [],
      guestMode: true,
    });
  }

  const supabase = await createClient();
  const userId = session.user.id;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, brand_guidelines, last_image_prompt, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ conversation: null, messages: [] });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, role, content, social_post, image_url, image_seed, image_prompt, intent, created_at"
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
  });
}

/** Update brand guidelines for active conversation */
export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({ ok: true, guestMode: true });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { conversationId, brandGuidelines } = body as {
    conversationId: string;
    brandGuidelines: Record<string, unknown>;
  };

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      brand_guidelines: brandGuidelines,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
