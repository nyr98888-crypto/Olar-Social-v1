import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  BrandDnaPartialSchema,
  expandBrandDnaDefaults,
  parseBrandDnaPartial,
} from "../../../../schemas/agent";

export const runtime = "nodejs";

/** Load current user's profile Brand DNA. */
export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({ brand_dna: null, guestMode: true });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, brand_dna")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data,
    brand_dna: parseBrandDnaPartial(data?.brand_dna) ?? data?.brand_dna ?? null,
  });
}

/**
 * PATCH profile Brand DNA (Niche Lock).
 * Body: { brand_dna: { business_type, allowed_visual_style, forbidden_elements? } }
 * Merges with existing DNA so partial updates work.
 */
export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({ ok: true, guestMode: true });
  }

  const body = await request.json();
  const raw = body?.brand_dna ?? body?.brandDna;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { error: "brand_dna object required" },
      { status: 400 }
    );
  }

  const partial = BrandDnaPartialSchema.safeParse(raw);
  if (!partial.success) {
    return NextResponse.json(
      { error: "Invalid brand_dna", details: partial.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const userId = session.user.id;

  const { data: existing } = await supabase
    .from("profiles")
    .select("brand_dna")
    .eq("id", userId)
    .maybeSingle();

  const prev = parseBrandDnaPartial(existing?.brand_dna) ?? {};
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

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email: session.user.email,
      brand_dna: next,
      updated_at: new Date().toISOString(),
    })
    .select("id, brand_dna")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    brand_dna: data.brand_dna,
  });
}
