import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { runAgentPipeline } from "@/lib/ai/router";
import { jsonClientError } from "@/lib/api/client-error";
import {
  normalizeReferenceImages,
  type ChatTurn,
  type ReferenceImage,
} from "@/lib/ai/types";
import {
  mergeBrandDna,
  parseBrandDnaPartial,
  type BrandDna,
  type BrandGuidelines,
} from "../../../../schemas/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  conversationId?: string;
  message: string;
  brandGuidelines?: BrandGuidelines | null;
  /** Guest / client: Niche Lock DNA */
  brandDna?: BrandDna | null;
  brand_dna?: BrandDna | null;
  /** Guest mode: client-held sliding window (no DB). */
  history?: ChatTurn[];
  /** Guest mode: last image prompt for anti-lock. */
  previousImagePrompt?: string | null;
  /** Preferred: base64 strings or data-URIs */
  imageBase64Array?: string[];
  /** Backward compat with earlier scaffold */
  referenceImages?: ReferenceImage[];
}

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ChatBody;
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

      const result = await runAgentPipeline({
        userMessage: body.message.trim(),
        history,
        brandGuidelines: body.brandGuidelines ?? null,
        brandDna: mergeBrandDna(bodyDna, null),
        referenceImages:
          referenceImages.length > 0 ? referenceImages : undefined,
        previousImagePrompt: body.previousImagePrompt ?? null,
      });

      const { output, image } = result;
      const assistantMsg = {
        id: `guest-msg-${Date.now()}`,
        content: output.chat_reply,
        social_post: output.social_post,
        image_url: image?.url ?? null,
        image_seed: image?.seed ?? null,
        image_prompt: image?.prompt ?? null,
        intent: output.intent,
        created_at: new Date().toISOString(),
      };

      return NextResponse.json({
        conversationId,
        message: assistantMsg,
        output,
        image,
        providerUsed: result.providerUsed,
        guestMode: true,
        status: image
          ? "generated_visual"
          : result.visionNotes
            ? "analyzed_images"
            : "replied",
      });
    }

    // —— Authenticated Supabase path ——
    const supabase = await createClient();
    const userId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_dna")
      .eq("id", userId)
      .maybeSingle();

    const profileDna = parseBrandDnaPartial(profile?.brand_dna) ?? null;

    let conversationId = body.conversationId;
    let brandGuidelines: BrandGuidelines | null =
      body.brandGuidelines ?? null;
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

    const result = await runAgentPipeline({
      userMessage: body.message.trim(),
      history,
      brandGuidelines,
      brandDna,
      referenceImages:
        referenceImages.length > 0 ? referenceImages : undefined,
      previousImagePrompt,
    });

    const { output, image } = result;

    const { data: assistantMsg, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: output.chat_reply,
        social_post: output.social_post,
        image_url: image?.url ?? null,
        image_seed: image?.seed ?? null,
        image_prompt: image?.prompt ?? null,
        intent: output.intent,
      })
      .select(
        "id, content, social_post, image_url, image_seed, intent, created_at"
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
    if (image?.prompt) {
      updates.last_image_prompt = image.prompt;
    }

    await supabase
      .from("conversations")
      .update(updates)
      .eq("id", conversationId)
      .eq("user_id", userId);

    return NextResponse.json({
      conversationId,
      message: assistantMsg,
      output,
      image,
      providerUsed: result.providerUsed,
      brand_dna: brandDna,
      status: image
        ? "generated_visual"
        : result.visionNotes
          ? "analyzed_images"
          : "replied",
    });
  } catch (err) {
    return jsonClientError(err, 503);
  }
}
