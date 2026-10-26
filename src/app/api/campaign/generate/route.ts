/**
 * Generate 3 campaign posts as a strict JSON array.
 * Soft success — never returns a raw string that UI might index as [0].
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import {
  buildLocalCampaignPosts,
  parseCampaignPosts,
  type CampaignPost,
} from "@/lib/olar/campaign-posts";
import { FALLBACK_SOFT_READY_HE } from "@/lib/ai/fallback-content";
import { withTimeout } from "@/lib/ai/with-timeout";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM = `You write Hebrew social ads for Israeli small businesses.
Return ONLY valid JSON: {"posts":[...]} with exactly 3 objects.
Each object MUST have: title, hook, body, cta (all Hebrew strings).
Never invent numeric prices (no 150, 350, 200 shekels) unless the user wrote them.
CTA should be WhatsApp quote style like לתיאום והצעת מחיר בוואטסאפ when no price given.
No markdown fences.`;

async function tryGroqCampaign(topic: string): Promise<CampaignPost[] | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const res = await withTimeout(
      fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.6,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Create 3 campaign posts for:\n${topic.slice(0, 800)}`,
            },
          ],
        }),
      }),
      20_000,
      "Groq campaign"
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseCampaignPosts(content, topic);
  } catch (err) {
    console.warn(
      "[api/campaign] Groq failed",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      prompt?: string;
    };
    const topic = (body.topic || body.prompt || "").trim();

    let posts = await tryGroqCampaign(topic || "עסק מקומי");
    if (!posts || !Array.isArray(posts) || posts.length < 3) {
      posts = buildLocalCampaignPosts(topic);
    }

    // Final guard — never ship string / char arrays
    posts = parseCampaignPosts(posts, topic);

    return NextResponse.json({
      ok: true,
      soft_message: FALLBACK_SOFT_READY_HE,
      posts,
    });
  } catch (err) {
    console.error(
      "[api/campaign] error",
      err instanceof Error ? err.message : err
    );
    const posts = buildLocalCampaignPosts("");
    return NextResponse.json({
      ok: true,
      fallback: true,
      soft_message: FALLBACK_SOFT_READY_HE,
      posts,
    });
  }
}
