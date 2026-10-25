import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  BrandDnaPartialSchema,
  expandBrandDnaDefaults,
  parseBrandDnaPartial,
} from "../../../../schemas/agent";

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
      brand_dna: null,
      guestMode: true,
    });
  }

  const supabase = await createClient();
  const userId = session.user.id;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, brand_guidelines, brand_dna, last_image_prompt, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_dna")
    .eq("id", userId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({
      conversation: null,
      messages: [],
      brand_dna: parseBrandDnaPartial(profile?.brand_dna) ?? null,
    });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, role, content, social_post, image_url, image_seed, intent, created_at"
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  // Context bleed: do not restore image_prompt into client chat history
  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    brand_dna:
      parseBrandDnaPartial(conversation.brand_dna) ??
      parseBrandDnaPartial(profile?.brand_dna) ??
      null,
  });
}

/**
 * Update brand guidelines and/or brand_dna for active conversation.
 * brand_dna is also upserted onto profiles (source of truth for Niche Lock).
 */
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
  const {
    conversationId,
    brandGuidelines,
    brand_dna: brandDnaBody,
    brandDna: brandDnaAlt,
  } = body as {
    conversationId: string;
    brandGuidelines?: Record<string, unknown>;
    brand_dna?: Record<string, unknown>;
    brandDna?: Record<string, unknown>;
  };

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (brandGuidelines !== undefined) {
    updates.brand_guidelines = brandGuidelines;
  }

  const rawDna = brandDnaBody ?? brandDnaAlt;
  let savedDna: unknown = undefined;

  if (rawDna !== undefined) {
    const partial = BrandDnaPartialSchema.safeParse(rawDna);
    if (!partial.success) {
      return NextResponse.json(
        { error: "Invalid brand_dna", details: partial.error.flatten() },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_dna")
      .eq("id", session.user.id)
      .maybeSingle();

    const prev = parseBrandDnaPartial(profile?.brand_dna) ?? {};
    const mergedPartial = {
      ...prev,
      ...Object.fromEntries(
        Object.entries(partial.data).filter(([, v]) => v !== undefined)
      ),
    };
    const expanded = expandBrandDnaDefaults(mergedPartial);
    const next = expanded ?? {
      ...mergedPartial,
      forbidden_elements: mergedPartial.forbidden_elements ?? [],
    };

    updates.brand_dna = next;
    savedDna = next;

    await supabase.from("profiles").upsert({
      id: session.user.id,
      email: session.user.email,
      brand_dna: next,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", conversationId)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, brand_dna: savedDna });
}
