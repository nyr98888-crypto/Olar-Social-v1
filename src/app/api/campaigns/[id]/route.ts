/**
 * Single campaign — GET by id, PUT/PATCH for Maya live edits.
 */
import { NextResponse } from "next/server";
import {
  getCampaignById,
  updateCampaign,
  type CampaignUpdate,
} from "@/lib/db";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function GET(
  _request: Request,
  ctx: RouteCtx
) {
  try {
    const { id: idRaw } = await ctx.params;
    const id = parseId(idRaw);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Invalid id" },
        { status: 400 }
      );
    }
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return NextResponse.json(
        { ok: false, campaign: null, error: "Not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    // Soft-fail for Studio hydrate — client falls back to localStorage
    console.error("[api/campaigns/[id]] GET failed (soft)", err);
    return NextResponse.json({
      ok: true,
      campaign: null,
    });
  }
}

async function applyUpdate(request: Request, ctx: RouteCtx) {
  try {
    const { id: idRaw } = await ctx.params;
    const id = parseId(idRaw);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const patch: CampaignUpdate = {};

    if (body.title !== undefined || body.headline !== undefined) {
      patch.title = String(body.title ?? body.headline ?? "").trim();
    }
    if (body.bodyText !== undefined || body.body !== undefined) {
      patch.bodyText = String(body.bodyText ?? body.body ?? "").trim();
    }
    if (body.imageUrl !== undefined || body.image_url !== undefined) {
      patch.imageUrl = String(body.imageUrl ?? body.image_url ?? "").trim();
    }
    if (body.niche !== undefined) {
      patch.niche =
        typeof body.niche === "string" ? body.niche.trim() || null : null;
    }
    if (body.hashtags !== undefined) {
      if (Array.isArray(body.hashtags)) {
        patch.hashtags = body.hashtags
          .map((t) => String(t || "").trim())
          .filter(Boolean)
          .join(" ");
      } else if (typeof body.hashtags === "string") {
        patch.hashtags = body.hashtags.trim() || null;
      } else {
        patch.hashtags = null;
      }
    }
    if (body.platform !== undefined && typeof body.platform === "string") {
      patch.platform = body.platform.trim() || "Instagram";
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const campaign = await updateCampaign(id, patch);
    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    console.error("[api/campaigns/[id]] update failed", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  return applyUpdate(request, ctx);
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  return applyUpdate(request, ctx);
}
