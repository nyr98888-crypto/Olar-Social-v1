/**
 * Proactive Maya Wingman greeting for authenticated users.
 * Guests → 401 / skip (no DB, no personalized greeting).
 */
import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  buildWingmanGreeting,
  WINGMAN_GREETING_CHIPS,
} from "@/lib/olar/wingman-greeting";
import {
  getMarketingProfile,
  toSafeMarketingProfile,
  type UserMarketingProfile,
} from "@/lib/olar/user-marketing-profile";
import type { BusinessProfileLike } from "@/lib/ai/partner-memory";

export const runtime = "nodejs";

async function handleGreeting() {
  const session = await getAppSession();
  if (!session || session.mode !== "supabase") {
    return NextResponse.json(
      { error: "Unauthorized", skip: true },
      { status: 401 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured", skip: true },
      { status: 503 }
    );
  }

  const userId = session.user.id;
  let marketing: UserMarketingProfile | null = null;
  let ownerName = session.user.name;
  let businessName: string | null = null;

  try {
    const supabase = await createClient();
    marketing = await getMarketingProfile(supabase, userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_profile")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.full_name && typeof profile.full_name === "string") {
      ownerName = profile.full_name;
    }

    const bp = profile?.business_profile as BusinessProfileLike | null;
    if (bp?.businessName?.trim()) {
      businessName = bp.businessName.trim();
    }

    // Soft seed marketing row from page profile when empty
    if (
      marketing &&
      !marketing.business_name &&
      businessName
    ) {
      marketing = {
        ...marketing,
        business_name: businessName,
        owner_name: marketing.owner_name || ownerName,
      };
    } else if (!marketing && (businessName || ownerName)) {
      marketing = {
        user_id: userId,
        business_name: businessName,
        owner_name: ownerName,
        category: null,
        tone_preference: null,
        last_activity_at: null,
        last_post_topic: null,
        recent_wins: [],
        total_posts_created: 0,
      };
    }
  } catch (err) {
    console.warn(
      "[api/agent/greeting] profile load soft-fail",
      err instanceof Error ? err.message : err
    );
  }

  const replyMessage = buildWingmanGreeting({
    profile: marketing,
    ownerName,
    businessName,
  });

  return NextResponse.json({
    replyMessage,
    chips: WINGMAN_GREETING_CHIPS,
    profile: toSafeMarketingProfile(
      marketing
        ? {
            ...marketing,
            owner_name: marketing.owner_name || ownerName || null,
            business_name: marketing.business_name || businessName || null,
          }
        : null
    ),
  });
}

export async function GET() {
  return handleGreeting();
}

export async function POST() {
  return handleGreeting();
}
