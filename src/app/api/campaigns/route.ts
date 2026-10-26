/**
 * Campaigns CRUD — Turso when configured, else local SQLite (data/olar.db).
 * POST: save selected Home card → Studio.
 * GET: latest campaign for Studio hydrate fallback.
 */
import { NextResponse } from "next/server";
import {
  getLatestCampaign,
  insertCampaign,
  type CampaignInsert,
} from "@/lib/db";

export const runtime = "nodejs";

function normalizeHashtags(
  raw: unknown
): string | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const tags = raw
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    return tags.length ? tags.join(" ") : null;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    return t || null;
  }
  return null;
}

export async function GET() {
  try {
    const campaign = await getLatestCampaign();
    if (!campaign) {
      return NextResponse.json({ success: true, ok: true, campaign: null });
    }
    return NextResponse.json({ success: true, ok: true, campaign });
  } catch (err) {
    // Soft-fail: empty DB / init errors must not 500 Studio hydrate
    console.error("[api/campaigns] GET failed (soft)", err);
    return NextResponse.json({
      success: true,
      ok: true,
      campaign: null,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = String(
      body.title ?? body.headline ?? ""
    ).trim();
    const bodyText = String(
      body.bodyText ?? body.body ?? ""
    ).trim();
    const imageUrl = String(
      body.imageUrl ?? body.image_url ?? ""
    ).trim();

    if (!title && !bodyText) {
      return NextResponse.json(
        { ok: false, error: "title and bodyText required" },
        { status: 400 }
      );
    }

    const input: CampaignInsert = {
      title: title || "פוסט",
      bodyText,
      imageUrl: imageUrl || "",
      niche:
        typeof body.niche === "string" ? body.niche.trim() || null : null,
      hashtags: normalizeHashtags(body.hashtags),
      platform:
        typeof body.platform === "string" && body.platform.trim()
          ? body.platform.trim()
          : "Instagram",
    };

    const campaign = await insertCampaign(input);
    // Contract: { success, campaign: { id, title, bodyText, imageUrl, hashtags } }
    // Keep `ok` + `id` for older clients.
    return NextResponse.json({
      success: true,
      ok: true,
      id: campaign.id,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        bodyText: campaign.bodyText,
        imageUrl: campaign.imageUrl,
        hashtags: campaign.hashtags,
        niche: campaign.niche,
        platform: campaign.platform,
        createdAt: campaign.createdAt,
      },
    });
  } catch (err) {
    console.error("[api/campaigns] POST failed", err);
    return NextResponse.json(
      { success: false, ok: false, error: "Failed to save campaign" },
      { status: 500 }
    );
  }
}
