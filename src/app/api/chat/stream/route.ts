import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  runAgentPipelineStream,
  type AgentStreamEvent,
} from "@/lib/ai/router";
import { toClientErrorPayload } from "@/lib/api/client-error";
import { formatSse, sseResponse } from "@/lib/ai/sse";
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
} from "../../../../../schemas/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatStreamBody {
  conversationId?: string;
  message: string;
  brandGuidelines?: BrandGuidelines | null;
  brandDna?: BrandDna | null;
  brand_dna?: BrandDna | null;
  history?: ChatTurn[];
  previousImagePrompt?: string | null;
  imageBase64Array?: string[];
  referenceImages?: ReferenceImage[];
}

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatStreamBody;
  try {
    body = (await request.json()) as ChatStreamBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  const referenceImages = normalizeReferenceImages({
    imageBase64Array: body.imageBase64Array,
    referenceImages: body.referenceImages,
  });
  const bodyDna =
    parseBrandDnaPartial(body.brandDna ?? body.brand_dna) ?? null;
  const userMessage = body.message.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSse(event, data)));
      };

      try {
        // —— Guest path ——
        if (session.mode === "guest") {
          const history = Array.isArray(body.history)
            ? body.history.slice(-20)
            : [];
          const conversationId =
            body.conversationId?.startsWith("guest-")
              ? body.conversationId
              : `guest-${Date.now()}`;

          send("meta", { conversationId, guestMode: true });

          const emit = (ev: AgentStreamEvent) => send(ev.type, ev);
          const result = await runAgentPipelineStream(
            {
              userMessage,
              history,
              brandGuidelines: body.brandGuidelines ?? null,
              brandDna: mergeBrandDna(bodyDna, null),
              referenceImages:
                referenceImages.length > 0 ? referenceImages : undefined,
              previousImagePrompt: body.previousImagePrompt ?? null,
              deferImage: true,
            },
            emit
          );

          const { output, image } = result;
          const pendingPrompt =
            image?.prompt ??
            (output.image_task.generate_image
              ? output.image_task.prompt ?? null
              : null);
          const assistantMsg = {
            id: `guest-msg-${Date.now()}`,
            role: "assistant" as const,
            content: output.chat_reply,
            social_post: output.social_post,
            image_url: image?.url ?? null,
            image_seed: image?.seed ?? null,
            image_prompt: pendingPrompt,
            intent: output.intent,
            created_at: new Date().toISOString(),
          };

          send("message", { message: assistantMsg });
          send("done", {
            conversationId,
            providerUsed: result.providerUsed,
            guestMode: true,
            imagePending: Boolean(
              !image && output.image_task.generate_image && pendingPrompt
            ),
            status: image
              ? "generated_visual"
              : result.visionNotes
                ? "analyzed_images"
                : "replied",
          });
          controller.close();
          return;
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
            send("error", {
              error: "Conversation not found",
              error_he: "השיחה לא נמצאה.",
            });
            controller.close();
            return;
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
            send("error", {
              error: error?.message ?? "Failed to create conversation",
              error_he: "לא הצלחתי לפתוח שיחה חדשה.",
            });
            controller.close();
            return;
          }
          conversationId = created.id;
        }

        const brandDna = mergeBrandDna(
          mergeBrandDna(profileDna, conversationDna),
          bodyDna
        );

        send("meta", { conversationId, guestMode: false, brand_dna: brandDna });

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
          content: userMessage,
        });

        const emit = (ev: AgentStreamEvent) => send(ev.type, ev);
        const result = await runAgentPipelineStream(
          {
            userMessage,
            history,
            brandGuidelines,
            brandDna,
            referenceImages:
              referenceImages.length > 0 ? referenceImages : undefined,
            previousImagePrompt,
            deferImage: true,
          },
          emit
        );

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
          send("error", {
            error: msgErr.message,
            error_he: "שמירת ההודעה נכשלה.",
          });
          controller.close();
          return;
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

        send("message", {
          message: { ...assistantMsg, role: "assistant" },
        });
        send("done", {
          conversationId,
          providerUsed: result.providerUsed,
          brand_dna: brandDna,
          imagePending: Boolean(
            !image && output.image_task.generate_image && pendingPrompt
          ),
          status: image
            ? "generated_visual"
            : result.visionNotes
              ? "analyzed_images"
              : "replied",
        });
        controller.close();
      } catch (err) {
        console.error("[chat/stream]", err);
        const payload = toClientErrorPayload(err);
        send("error", payload);
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
