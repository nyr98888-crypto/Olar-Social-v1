/**
 * Client helpers — save selected card to SQLite campaigns API,
 * then hand off to Studio with ?id= as source of truth.
 */
"use client";

export const ACTIVE_CAMPAIGN_ID_KEY = "one_loop_active_campaign_id";

export type SaveCampaignInput = {
  title?: string;
  headline?: string;
  bodyText?: string;
  body?: string;
  imageUrl?: string | null;
  hashtags?: string[] | string | null;
  niche?: string | null;
  platform?: string | null;
};

export type SavedCampaign = {
  id: number;
  title: string;
  bodyText: string;
  imageUrl: string;
  niche: string | null;
  hashtags: string | null;
  platform: string;
  createdAt: string;
};

function rememberCampaignId(id: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_CAMPAIGN_ID_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export function readActiveCampaignId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = localStorage.getItem(ACTIVE_CAMPAIGN_ID_KEY);
    if (fromLs) {
      const n = Number.parseInt(fromLs, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("id");
    if (q) {
      const n = Number.parseInt(q, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** POST /api/campaigns — returns saved row or null on soft failure. */
export async function postCampaignToDb(
  input: SaveCampaignInput
): Promise<SavedCampaign | null> {
  const title = (input.title || input.headline || "").trim();
  const bodyText = (input.bodyText || input.body || "").trim();
  if (!title && !bodyText) return null;

  try {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "פוסט",
        bodyText,
        imageUrl: (input.imageUrl || "").trim(),
        hashtags: input.hashtags ?? null,
        niche: input.niche ?? null,
        platform: input.platform || "Instagram",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      ok?: boolean;
      campaign?: SavedCampaign;
      id?: number;
    };
    if (!res.ok || !data.campaign?.id) return null;
    rememberCampaignId(data.campaign.id);
    return data.campaign;
  } catch {
    return null;
  }
}

/** PATCH live Maya edits into SQLite. */
export async function patchCampaignInDb(
  id: number,
  patch: {
    title?: string;
    bodyText?: string;
    imageUrl?: string | null;
  }
): Promise<SavedCampaign | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: patch.title,
        bodyText: patch.bodyText,
        imageUrl: patch.imageUrl,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      campaign?: SavedCampaign;
    };
    if (!res.ok || !data.campaign) return null;
    rememberCampaignId(data.campaign.id);
    return data.campaign;
  } catch {
    return null;
  }
}

export async function fetchCampaignById(
  id: number
): Promise<SavedCampaign | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const res = await fetch(`/api/campaigns/${id}`);
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      campaign?: SavedCampaign;
    };
    if (!res.ok || !data.campaign) return null;
    rememberCampaignId(data.campaign.id);
    return data.campaign;
  } catch {
    return null;
  }
}

export async function fetchLatestCampaign(): Promise<SavedCampaign | null> {
  try {
    const res = await fetch("/api/campaigns");
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      campaign?: SavedCampaign | null;
    };
    if (!res.ok || !data.campaign) return null;
    rememberCampaignId(data.campaign.id);
    return data.campaign;
  } catch {
    return null;
  }
}

/**
 * Persist selected card to DB then navigate to /studio?id=N.
 * localStorage campaign-store remains a cache (caller still writes it).
 */
export async function saveCampaignAndGoToStudio(
  input: SaveCampaignInput,
  navigate: (href: string) => void
): Promise<number | null> {
  const saved = await postCampaignToDb(input);
  if (saved?.id) {
    navigate(`/studio?id=${saved.id}`);
    return saved.id;
  }
  // Soft fallback — still open studio (localStorage cache)
  navigate("/studio");
  return null;
}
