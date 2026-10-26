import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { runAgentPipeline } from "@/lib/ai/router";
import { FALLBACK_SOFT_READY_HE } from "@/lib/ai/fallback-content";
import { softAiFallbackJson } from "@/lib/ai/soft-response";
import {
  isOpenRouterConfigured,
  OPENROUTER_MISSING_KEY_HE,
} from "@/lib/ai/providers/openrouter";
import {
  normalizeReferenceImages,
  type ChatTurn,
  type ReferenceImage,
} from "@/lib/ai/types";
import {
  expandBrandDnaDefaults,
  mergeBrandDna,
  parseBrandDnaPartial,
  type BrandDna,
  type BrandGuidelines,
} from "../../../../schemas/agent";
import {
  brandGuidelinesFromBusinessProfile,
  buildPartnerMemory,
  type BusinessProfileLike,
} from "@/lib/ai/partner-memory";
import { getMarketingProfile } from "@/lib/olar/user-marketing-profile";
import { getCampaignById } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CurrentPostBody {
  headline?: string;
  body?: string;
  bodyText?: string;
  cta?: string;
  ctaButton?: string;
  imageUrl?: string | null;
  hashtags?: string[];
}

interface ChatBody {
  conversationId?: string;
  message: string;
  brandGuidelines?: BrandGuidelines | null;
  /** Guest / client: Niche Lock DNA */
  brandDna?: BrandDna | null;
  brand_dna?: BrandDna | null;
  /** Guest: local onboarding business snapshot for Partner Memory */
  businessProfile?: BusinessProfileLike | null;
  /** Guest mode: client-held sliding window (no DB). */
  history?: ChatTurn[];
  /** Guest mode: last image prompt for anti-lock. */
  previousImagePrompt?: string | null;
  /** Preferred: base64 strings or data-URIs */
  imageBase64Array?: string[];
  /** Backward compat with earlier scaffold */
  referenceImages?: ReferenceImage[];
  /** Active view/route context for contextual greetings (e.g. "home", "studio") */
  routeContext?: string | null;
  /** Hebrew route hint injected as system context */
  routeHint?: string | null;
  /** Exact post on the left preview card — Maya must see this */
  currentPost?: CurrentPostBody | null;
  /** SQLite campaign id — authoritative when present */
  campaignId?: number | string | null;
}

function normalizeCurrentPost(
  raw: CurrentPostBody | null | undefined
): CurrentPostBody | null {
  if (!raw || typeof raw !== "object") return null;
  const headline = (raw.headline || "").trim();
  const body = (raw.bodyText || raw.body || "").trim();
  if (!headline && !body) return null;
  if (/^missing\s*card/i.test(headline)) return null;
  return {
    headline,
    body,
    bodyText: body,
    cta: (raw.ctaButton || raw.cta || "").trim(),
    ctaButton: (raw.ctaButton || raw.cta || "").trim(),
    imageUrl: raw.imageUrl || null,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
  };
}

async function resolveCurrentPost(
  body: ChatBody
): Promise<CurrentPostBody | null> {
  const rawId = body.campaignId;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number.parseInt(rawId, 10)
        : NaN;
  if (Number.isFinite(id) && id > 0) {
    try {
      const row = await getCampaignById(id);
      if (row) {
        return {
          headline: row.title,
          body: row.bodyText,
          bodyText: row.bodyText,
          imageUrl: row.imageUrl || null,
          hashtags: row.hashtags
            ? row.hashtags.split(/\s+/).filter(Boolean)
            : [],
        };
      }
    } catch (err) {
      console.warn("[api/chat] campaign DB lookup failed", err);
    }
  }
  return normalizeCurrentPost(body.currentPost);
}

/** Hebrew Maya context prepended when an active campaign exists. */
function mayaCampaignRouteHint(post: CurrentPostBody | null): string {
  if (!post) return "";
  const title = (post.headline || "").trim();
  const bodyText = (post.bodyText || post.body || "").trim();
  if (!title && !bodyText) return "";
  return `את מאיה, מנהלת השיווק הדיגיטלי. הפוסט הנוכחי המוצג ללקוח הוא: כותרת: "${title}", גוף הפוסט: "${bodyText}". אם הלקוח מבקש לשנות נוסח, החזירי JSON עם reply + cardUpdate: { "title": "..." או null, "bodyText": "..." או null }. אפשר גם updatedTitle/updatedBodyText לתאימות לאחור.`;
}

function withSoftFlags(
  payload: Record<string, unknown>,
  providerUsed: string
) {
  const fallback = providerUsed.startsWith("fallback:");
  return {
    ok: true,
    fallback,
    soft_message: fallback ? FALLBACK_SOFT_READY_HE : undefined,
    ...payload,
  };
}

export async function POST(request: Request) {
  let parsedBody: ChatBody | null = null;
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: OPENROUTER_MISSING_KEY_HE },
        { status: 503 }
      );
    }

    const body = (await request.json()) as ChatBody;
    parsedBody = body;
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const referenceImages = normalizeReferenceImages({
      imageBase64Array: body.imageBase64Array,
      referenceImages: body.referenceImages,
    });

    const bodyDna =
      parseBrandDnaPartial(body.brandDna ?? body.brand_dna) ?? null;

    // —— Guest / local: no Supabase persistence ——
    if (session.mode === "guest") {
      const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
      const conversationId =
        body.conversationId?.startsWith("guest-")
          ? body.conversationId
          : `guest-${Date.now()}`;

      const guestBp = body.businessProfile ?? null;
      const guestBrand =
        body.brandGuidelines ??
        brandGuidelinesFromBusinessProfile(guestBp, null);
      const partnerMemory = buildPartnerMemory({
        fullName: null,
        businessProfile: guestBp,
        brandGuidelines: guestBrand,
      });
      const guestDna = mergeBrandDna(
        guestBp?.niche
          ? expandBrandDnaDefaults({ business_type: String(guestBp.niche) })
          : null,
        bodyDna
      );

      // Inject route context as a system-level hint prepended to user message
      const guestCurrentPost = await resolveCurrentPost(body);
      const mayaHint = mayaCampaignRouteHint(guestCurrentPost);
      const routePrefix = [mayaHint, body.routeHint?.trim()]
        .filter(Boolean)
        .join("\n");

      // Defer FAL so mobile/Vercel get chat_reply fast; client follows up for image.
      const result = await runAgentPipeline({
        userMessage:
          (routePrefix ? `${routePrefix}\n` : "") + body.message.trim(),
        history,
        brandGuidelines: guestBrand,
        brandDna: guestDna,
        partnerMemory,
        currentPost: guestCurrentPost,
        referenceImages:
          referenceImages.length > 0 ? referenceImages : undefined,
        previousImagePrompt: body.previousImagePrompt ?? null,
        deferImage: true,
      });

      const { output, image } = result;
      const pendingPrompt =
        image?.prompt ??
        (output.image_task.generate_image
          ? output.image_task.prompt ?? null
          : null);
      const assistantMsg = {
        id: `guest-msg-${Date.now()}`,
        content: output.chat_reply,
        social_post: output.social_post,
        image_url: image?.url ?? null,
        image_seed: image?.seed ?? null,
        image_prompt: pendingPrompt,
        intent: output.intent,
        created_at: new Date().toISOString(),
      };

      const guestUpdatedTitle =
        output.social_post?.headline?.trim() || undefined;
      const guestUpdatedBody =
        output.social_post?.body?.trim() || undefined;

      return NextResponse.json(
        withSoftFlags(
          {
            conversationId,
            message: assistantMsg,
            output,
            image,
            imagePending: Boolean(
              !image && output.image_task.generate_image && pendingPrompt
            ),
            providerUsed: result.providerUsed,
            guestMode: true,
            reply: output.chat_reply,
            cardUpdate: {
              title: guestUpdatedTitle ?? null,
              bodyText: guestUpdatedBody ?? null,
            },
            updatedTitle: guestUpdatedTitle,
            updatedBodyText: guestUpdatedBody,
            status: image
              ? "generated_visual"
              : result.visionNotes
                ? "analyzed_images"
                : "replied",
          },
          result.providerUsed
        )
      );
    }

    // —— Authenticated Supabase path ——
    const supabase = await createClient();
    const userId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_dna, business_profile, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const businessProfile = (profile?.business_profile ??
      null) as BusinessProfileLike | null;
    const profileDna =
      parseBrandDnaPartial(profile?.brand_dna) ??
      (businessProfile?.niche
        ? expandBrandDnaDefaults({ business_type: businessProfile.niche })
        : null);

    let conversationId = body.conversationId;
    let brandGuidelines: BrandGuidelines | null =
      body.brandGuidelines ??
      brandGuidelinesFromBusinessProfile(businessProfile, null);
    let previousImagePrompt: string | null = null;
    let conversationDna = parseBrandDnaPartial(null);

    if (conversationId) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("id, brand_guidelines, brand_dna, last_image_prompt")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single();

      if (error || !conv) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      brandGuidelines =
        (body.brandGuidelines as BrandGuidelines) ??
        (conv.brand_guidelines as BrandGuidelines) ??
        null;
      conversationDna = parseBrandDnaPartial(conv.brand_dna);
      previousImagePrompt = conv.last_image_prompt ?? null;
    } else {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          brand_guidelines: brandGuidelines ?? {},
        })
        .select("id")
        .single();

      if (error || !created) {
        return NextResponse.json(
          { error: error?.message ?? "Failed to create conversation" },
          { status: 500 }
        );
      }
      conversationId = created.id;
    }

    // Niche lock: conversation override + profile base; body can supply DNA
    const brandDna = mergeBrandDna(
      mergeBrandDna(profileDna, conversationDna),
      bodyDna
    );

    // Prefer body brand if provided; else merge profile business snapshot
    if (body.brandGuidelines) {
      brandGuidelines = body.brandGuidelines;
    } else if (!brandGuidelines?.brand_name && businessProfile) {
      brandGuidelines = brandGuidelinesFromBusinessProfile(
        businessProfile,
        brandGuidelines
      );
    }

    const partnerMemory = buildPartnerMemory({
      fullName: profile?.full_name ?? session.user.name,
      businessProfile,
      brandGuidelines,
    });

    const marketingProfile = await getMarketingProfile(supabase, userId);

    // Load chat text only — never image_prompt (context bleed prevention)
    const { data: priorMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history: ChatTurn[] = (priorMessages ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: body.message.trim(),
    });

    const authCurrentPost = await resolveCurrentPost(body);
    const authMayaHint = mayaCampaignRouteHint(authCurrentPost);
    const authRoutePrefix = [authMayaHint, body.routeHint?.trim()]
      .filter(Boolean)
      .join("\n");

    const result = await runAgentPipeline({
      userMessage:
        (authRoutePrefix ? `${authRoutePrefix}\n` : "") + body.message.trim(),
      history,
      brandGuidelines,
      brandDna,
      partnerMemory,
      marketingProfile,
      currentPost: authCurrentPost,
      referenceImages:
        referenceImages.length > 0 ? referenceImages : undefined,
      previousImagePrompt,
      deferImage: true,
    });

    const { output, image } = result;
    const pendingPrompt =
      image?.prompt ??
      (output.image_task.generate_image
        ? output.image_task.prompt ?? null
        : null);

    const { data: assistantMsg, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: output.chat_reply,
        social_post: output.social_post,
        image_url: image?.url ?? null,
        image_seed: image?.seed ?? null,
        image_prompt: pendingPrompt,
        intent: output.intent,
      })
      .select(
        "id, content, social_post, image_url, image_seed, image_prompt, intent, created_at"
      )
      .single();

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.brandGuidelines) {
      updates.brand_guidelines = body.brandGuidelines;
    }
    if (bodyDna) {
      updates.brand_dna = brandDna ?? bodyDna;
    }
    if (pendingPrompt) {
      updates.last_image_prompt = pendingPrompt;
    }

    await supabase
      .from("conversations")
      .update(updates)
      .eq("id", conversationId)
      .eq("user_id", userId);

    return NextResponse.json(
      withSoftFlags(
        {
          conversationId,
          message: assistantMsg,
          output,
          image,
          imagePending: Boolean(
            !image && output.image_task.generate_image && pendingPrompt
          ),
          providerUsed: result.providerUsed,
          brand_dna: brandDna,
          reply: output.chat_reply,
          cardUpdate: {
            title: output.social_post?.headline?.trim() || null,
            bodyText: output.social_post?.body?.trim() || null,
          },
          updatedTitle: output.social_post?.headline?.trim() || undefined,
          updatedBodyText: output.social_post?.body?.trim() || undefined,
          status: image
            ? "generated_visual"
            : result.visionNotes
              ? "analyzed_images"
              : "replied",
        },
        result.providerUsed
      )
    );
  } catch (err) {
    console.error(
      "[api/chat] soft fallback",
      err instanceof Error ? err.message : err
    );
    return softAiFallbackJson({
      ctx: { rawInput: parsedBody?.message?.trim() ?? "" },
      brand: parsedBody?.brandGuidelines ?? null,
      conversationId: parsedBody?.conversationId,
      extra: { guestMode: true },
    });
  }
}
