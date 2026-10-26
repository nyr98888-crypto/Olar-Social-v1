import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  isHttpUrl,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";
import { getCredentialsForPublish } from "@/lib/olar/social-accounts-server";

export const runtime = "nodejs";

const GRAPH_VERSION = "v19.0";

function isPlatform(v: unknown): v is SocialPlatform {
  return v === "facebook" || v === "instagram";
}

/**
 * POST { caption, imageUrl, platform }
 * api_business + valid token+pageId → Meta Graph photos publish (Facebook).
 * Instagram: clear Hebrew error until product/IG Graph setup exists.
 */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "נדרשת התחברות" },
      { status: 401 }
    );
  }

  if (session.mode === "guest") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "אורחים לא יכולים לפרסם אוטומטית — התחברו, או השתמשו במצב 3 קליקים",
      },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "בקשה לא תקינה" },
      { status: 400 }
    );
  }

  const platform = body.platform;
  const caption =
    typeof body.caption === "string"
      ? body.caption
      : typeof body.text === "string"
        ? body.text
        : "";
  const imageUrl =
    typeof body.imageUrl === "string"
      ? body.imageUrl.trim()
      : typeof body.image_url === "string"
        ? body.image_url.trim()
        : "";

  if (!isPlatform(platform)) {
    return NextResponse.json(
      { ok: false, error: "platform חייב להיות facebook או instagram" },
      { status: 400 }
    );
  }

  if (!imageUrl || !isHttpUrl(imageUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: "נדרש קישור תמונה תקין (http/https) לפרסום אוטומטי",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const creds = await getCredentialsForPublish(
    supabase,
    session.user.id,
    platform
  );

  if (creds.mode !== "api_business") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "החשבון מוגדר למצב אישי (3 קליקים). לפרסום אוטומטי בחרו «עמוד עסקי רשמי» בהגדרות ושמרו טוקן + מזהה עמוד.",
      },
      { status: 400 }
    );
  }

  const token = creds.accessToken?.trim();
  const pageId = creds.pageId?.trim();

  if (!token || !pageId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "חסרים פרטי Meta (טוקן גישה + מזהה עמוד). עדכנו בהגדרות, או עברו למצב «פרופיל אישי / 3 קליקים».",
      },
      { status: 400 }
    );
  }

  if (platform === "instagram") {
    // Do not fake success — IG Content Publishing API needs FB Page + IG Business + product setup
    return NextResponse.json(
      {
        ok: false,
        error:
          "פרסום אוטומטי לאינסטגרם דורש חשבון עסקי מקושר לעמוד פייסבוק והגדרת מוצר Meta. בינתיים השתמשו ב«פרסם באינסטגרם (3 קליקים)».",
      },
      { status: 501 }
    );
  }

  // Facebook: Graph API POST /{page-id}/photos
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/photos`;
  const form = new URLSearchParams();
  form.set("url", imageUrl);
  form.set("caption", caption);
  form.set("access_token", token);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const raw = (await res.json().catch(() => null)) as {
      id?: string;
      post_id?: string;
      error?: { message?: string; code?: number; type?: string };
    } | null;

    if (!res.ok || raw?.error) {
      const msg =
        raw?.error?.message ||
        `Meta Graph החזיר שגיאה (${res.status})`;
      // Never log access_token
      console.warn("[api/publish] Facebook Graph error", {
        status: res.status,
        code: raw?.error?.code,
        type: raw?.error?.type,
        message: msg,
        pageIdPrefix: pageId.slice(0, 4) + "…",
      });
      return NextResponse.json(
        {
          ok: false,
          error: `פרסום לפייסבוק נכשל: ${msg}. בדקו טוקן ומזהה עמוד, או עברו למצב 3 קליקים.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      platform: "facebook",
      id: raw?.id ?? null,
      post_id: raw?.post_id ?? null,
      message: "הפוסט פורסם בהצלחה לעמוד העסקי בפייסבוק",
    });
  } catch (err) {
    console.warn(
      "[api/publish] network error",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      {
        ok: false,
        error: "שגיאת רשת מול Meta — נסו שוב או השתמשו במצב 3 קליקים",
      },
      { status: 502 }
    );
  }
}
