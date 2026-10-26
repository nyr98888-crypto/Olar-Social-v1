import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  DEFAULT_PUBLISH_MODE,
  type PublishMode,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";
import {
  loadSocialAccountsServer,
  publicAccountsFromMap,
  upsertSocialAccountServer,
} from "@/lib/olar/social-accounts-server";

export const runtime = "nodejs";

const PLATFORMS: SocialPlatform[] = ["facebook", "instagram"];

function isPlatform(v: unknown): v is SocialPlatform {
  return v === "facebook" || v === "instagram";
}

function isMode(v: unknown): v is PublishMode {
  return v === "api_business" || v === "assisted_personal";
}

/** Client-safe account status (no access tokens). */
export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({
      accounts: {
        facebook: {
          platform: "facebook",
          mode: DEFAULT_PUBLISH_MODE,
          isConnected: false,
          hasCredentials: false,
        },
        instagram: {
          platform: "instagram",
          mode: DEFAULT_PUBLISH_MODE,
          isConnected: false,
          hasCredentials: false,
        },
      },
      guestMode: true,
    });
  }

  const supabase = await createClient();
  const { map, softFailed } = await loadSocialAccountsServer(
    supabase,
    session.user.id
  );

  return NextResponse.json({
    accounts: publicAccountsFromMap(map),
    softFailed,
  });
}

/**
 * PATCH body: {
 *   platform, mode?, profileUrl?, pageId?, accessToken?, isConnected?
 * }
 * accessToken is write-only — never echoed back.
 */
export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.mode === "guest") {
    return NextResponse.json(
      {
        ok: false,
        error: "אורחים לא יכולים לשמור חיבורי Meta — התחברו קודם",
        guestMode: true,
      },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isPlatform(body.platform)) {
    return NextResponse.json(
      { error: "platform חייב להיות facebook או instagram" },
      { status: 400 }
    );
  }

  const platform = body.platform;
  const patch: {
    mode?: PublishMode;
    profileUrl?: string;
    pageId?: string;
    accessToken?: string;
    isConnected?: boolean;
  } = {};

  if (body.mode !== undefined) {
    if (!isMode(body.mode)) {
      return NextResponse.json(
        { error: "mode לא תקין" },
        { status: 400 }
      );
    }
    patch.mode = body.mode;
  }
  if (typeof body.profileUrl === "string") patch.profileUrl = body.profileUrl;
  if (typeof body.pageId === "string") patch.pageId = body.pageId;
  if (typeof body.accessToken === "string") {
    // Accept token write; never log the value
    patch.accessToken = body.accessToken;
  }
  if (typeof body.isConnected === "boolean") {
    patch.isConnected = body.isConnected;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "אין שדות לעדכון" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const result = await upsertSocialAccountServer(
    supabase,
    session.user.id,
    session.user.email,
    platform,
    patch
  );

  if (!result.ok && result.softFailed) {
    return NextResponse.json(
      {
        ok: false,
        softFailed: true,
        account: result.public,
        error:
          "שמירת החיבור נכשלה זמנית (טבלת הפרופיל). אפשר להמשיך במצב 3 קליקים מקומית.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    softFailed: result.softFailed,
    account: result.public,
  });
}

export { PLATFORMS };
