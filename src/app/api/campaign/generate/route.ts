/**
 * Generate 3 campaign posts as a strict JSON array.
 * Soft success — never returns canned niche marketing when AI fails.
 */
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import {
  parseCampaignPosts,
  type CampaignPost,
} from "@/lib/olar/campaign-posts";
import {
  FALLBACK_SOFT_FAIL_HE,
  FALLBACK_SOFT_READY_HE,
} from "@/lib/ai/fallback-content";
import { withTimeout } from "@/lib/ai/with-timeout";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM = `You write Hebrew social ads for Israeli small businesses.
Return ONLY valid JSON: {"posts":[...]} with exactly 3 objects.
Each object MUST have: title, hook, body, cta (all Hebrew strings).
Ground ONLY in the userText. Never invent numeric prices unless the user wrote them.
CTA should be WhatsApp quote style like לתיאום והצעת מחיר בוואטסאפ when no price given.
No markdown fences. Never use generic filler like "אם חיפשתם שירות אמין".`;

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
              content: topic.slice(0, 800),
            },
          ],
        }),
      }),
      12_000,
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
      userText?: string;
      topic?: string;
      prompt?: string;
      category?: string;
    };
    const topic = stripCategoryLeak(
      (body.userText || body.topic || body.prompt || "").trim()
    );

    if (!topic) {
      return NextResponse.json({
        ok: false,
        error: "חסר טקסט מהמשתמש",
        soft_message: FALLBACK_SOFT_FAIL_HE,
        posts: [],
      });
    }

    const posts = await tryGroqCampaign(topic);
    const parsed = parseCampaignPosts(posts, topic);

    if (!parsed.length) {
      return NextResponse.json({
        ok: false,
        error: FALLBACK_SOFT_FAIL_HE,
        soft_message: FALLBACK_SOFT_FAIL_HE,
        posts: [],
      });
    }

    return NextResponse.json({
      ok: true,
      soft_message: FALLBACK_SOFT_READY_HE,
      posts: parsed,
      category: body.category || null,
    });
  } catch (err) {
    console.error(
      "[api/campaign] error",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({
      ok: false,
      fallback: true,
      soft_message: FALLBACK_SOFT_FAIL_HE,
      error: FALLBACK_SOFT_FAIL_HE,
      posts: [],
    });
  }
}
