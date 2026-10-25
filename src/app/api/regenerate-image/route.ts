import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import { generateImageWithFal } from "@/lib/ai/providers/fal";
import { jsonClientError } from "@/lib/api/client-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, prompt, aspectRatio, previousImagePrompt } =
      (await request.json()) as {
        conversationId: string;
        prompt?: string;
        previousImagePrompt?: string | null;
        aspectRatio?: "1:1" | "4:5" | "16:9";
      };

    if (session.mode === "guest") {
      const basePrompt = prompt?.trim() || previousImagePrompt?.trim();
      if (!basePrompt) {
        return NextResponse.json(
          { error: "No image prompt available" },
          { status: 400 }
        );
      }

      const image = await generateImageWithFal({
        prompt: basePrompt,
        aspectRatio: aspectRatio ?? "1:1",
        previousPrompt: previousImagePrompt ?? null,
      });

      const msg = {
        id: `guest-msg-${Date.now()}`,
        content: "הנה גרסה ויזואלית נוספת, אותו כיוון עם Seed חדש לגמרי.",
        image_url: image.url,
        image_seed: image.seed,
        image_prompt: image.prompt,
        created_at: new Date().toISOString(),
      };

      return NextResponse.json({ image, message: msg, guestMode: true });
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, last_image_prompt")
      .eq("id", conversationId)
      .eq("user_id", session.user.id)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const previousPrompt = conv.last_image_prompt;
    const basePrompt = prompt?.trim() || previousPrompt;
    if (!basePrompt) {
      return NextResponse.json(
        { error: "No image prompt available" },
        { status: 400 }
      );
    }

    const image = await generateImageWithFal({
      prompt: basePrompt,
      aspectRatio: aspectRatio ?? "1:1",
      previousPrompt,
    });

    await supabase
      .from("conversations")
      .update({
        last_image_prompt: image.prompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: "הנה גרסה ויזואלית נוספת, אותו כיוון עם Seed חדש לגמרי.",
        image_url: image.url,
        image_seed: image.seed,
        image_prompt: image.prompt,
        intent: "refinement",
      })
      .select("id, content, image_url, image_seed, created_at")
      .single();

    return NextResponse.json({ image, message: msg });
  } catch (err) {
    return jsonClientError(err, 503);
  }
}
