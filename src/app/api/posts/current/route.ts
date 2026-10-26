import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";

export const runtime = "nodejs";

type PostBody = {
  headline?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  offer?: string;
  image_url?: string | null;
  image_seed?: number | null;
  image_prompt?: string | null;
  network?: string;
  business_profile?: unknown;
};

function normalizePost(body: PostBody) {
  return {
    headline: typeof body.headline === "string" ? body.headline : "",
    body: typeof body.body === "string" ? body.body : "",
    cta: typeof body.cta === "string" ? body.cta : "",
    hashtags: Array.isArray(body.hashtags)
      ? body.hashtags.filter((t) => typeof t === "string")
      : [],
    offer: typeof body.offer === "string" ? body.offer : null,
    image_url:
      typeof body.image_url === "string" && body.image_url.trim()
        ? body.image_url
        : null,
    image_seed:
      typeof body.image_seed === "number" ? body.image_seed : null,
    image_prompt:
      typeof body.image_prompt === "string" ? body.image_prompt : null,
    network: typeof body.network === "string" ? body.network : null,
  };
}

/** Load the authenticated user's current business post. */
export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({ post: null, guestMode: true });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_posts")
    .select(
      "id, headline, body, cta, hashtags, offer, image_url, image_seed, image_prompt, network, updated_at"
    )
    .eq("user_id", session.user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    post: data
      ? {
          headline: data.headline,
          body: data.body,
          cta: data.cta,
          hashtags: data.hashtags ?? [],
          offer: data.offer,
          image_url: data.image_url,
          image_seed: data.image_seed,
          image_prompt: data.image_prompt,
          network: data.network,
          updatedAt: data.updated_at,
        }
      : null,
  });
}

/**
 * Upsert current post for authenticated user.
 * Also accepts optional business_profile to store on profiles.
 * Guest: acknowledged without DB write.
 */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const post = normalizePost(body);

  if (session.mode === "guest") {
    return NextResponse.json({ ok: true, guestMode: true, post });
  }

  const supabase = await createClient();
  const userId = session.user.id;
  const now = new Date().toISOString();

  // Clear previous current flag, then insert new current row
  await supabase
    .from("business_posts")
    .update({ is_current: false, updated_at: now })
    .eq("user_id", userId)
    .eq("is_current", true);

  const { data, error } = await supabase
    .from("business_posts")
    .insert({
      user_id: userId,
      ...post,
      is_current: true,
      updated_at: now,
    })
    .select(
      "id, headline, body, cta, hashtags, offer, image_url, image_seed, image_prompt, network, updated_at"
    )
    .single();

  if (error) {
    // Fallback: try update-or-insert without unique partial index reliance
    const { data: existing } = await supabase
      .from("business_posts")
      .select("id")
      .eq("user_id", userId)
      .eq("is_current", true)
      .maybeSingle();

    if (existing?.id) {
      const { data: updated, error: upErr } = await supabase
        .from("business_posts")
        .update({ ...post, updated_at: now })
        .eq("id", existing.id)
        .select(
          "id, headline, body, cta, hashtags, offer, image_url, image_seed, image_prompt, network, updated_at"
        )
        .single();
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, post: updated });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.business_profile && typeof body.business_profile === "object") {
    await supabase.from("profiles").upsert(
      {
        id: userId,
        email: session.user.email,
        business_profile: body.business_profile,
        updated_at: now,
      },
      { onConflict: "id" }
    );
  }

  return NextResponse.json({
    ok: true,
    post: data
      ? {
          headline: data.headline,
          body: data.body,
          cta: data.cta,
          hashtags: data.hashtags ?? [],
          offer: data.offer,
          image_url: data.image_url,
          image_seed: data.image_seed,
          image_prompt: data.image_prompt,
          network: data.network,
          updatedAt: data.updated_at,
        }
      : post,
  });
}
