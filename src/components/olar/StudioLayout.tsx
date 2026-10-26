"use client";

import { useEffect, type ReactNode } from "react";
import {
  ONE_LOOP_CAMPAIGN_KEY,
  getCampaignState,
  hydrateCampaignFromStorage,
  persistSelectedCardToActiveCampaign,
  setActiveVariationIndex,
  setCampaign,
  setCampaignLoading,
  subscribeCampaignStore,
  type CampaignVariation,
} from "@/lib/store/campaign-store";
import {
  getStudioState,
  setStudioMessages,
  setStudioMeta,
  setStudioVariations,
  selectVariationIndex,
  subscribeStudio,
  type PostVariation,
  type StudioChatMessage,
} from "@/lib/store";
import { loadCurrentPost } from "@/lib/olar/current-post";
import {
  fetchCampaignById,
  fetchLatestCampaign,
  type SavedCampaign,
} from "@/lib/olar/campaigns-client";

export const ONE_LOOP_STUDIO_MESSAGES_KEY = "one_loop_studio_messages";

function isBlankOrMissingHeadline(headline?: string | null): boolean {
  const h = (headline || "").trim();
  if (!h) return true;
  return /^missing\s*card/i.test(h);
}

function toCampaignVariation(
  v: PostVariation,
  index: 0 | 1
): CampaignVariation {
  return {
    id: index === 1 ? "var_2" : "var_1",
    label: v.label || (index === 1 ? "אופציה 2" : "אופציה 1"),
    headline: v.headline || "",
    bodyText: v.bodyText || "",
    ctaButton: v.ctaButton || "",
    imageUrl: v.imageUrl?.trim() ? v.imageUrl : null,
    imagePrompt: v.imagePrompt || "",
  };
}

function loadPersistedMessages(): StudioChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ONE_LOOP_STUDIO_MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is StudioChatMessage =>
          Boolean(
            m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
      )
      .slice(-48);
  } catch {
    return [];
  }
}

function persistMessages(messages: StudioChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      ONE_LOOP_STUDIO_MESSAGES_KEY,
      JSON.stringify(messages.slice(-48))
    );
  } catch {
    /* ignore */
  }
}

function paintCampaignFromDb(campaign: SavedCampaign): boolean {
  const title = (campaign.title || "").trim();
  const bodyText = (campaign.bodyText || "").trim();
  if (!title && !bodyText) return false;
  if (/^missing\s*card/i.test(title)) return false;

  persistSelectedCardToActiveCampaign({
    headline: title || bodyText.slice(0, 48),
    bodyText,
    body: bodyText,
    imageUrl: campaign.imageUrl || null,
    hashtags: campaign.hashtags
      ? campaign.hashtags.split(/\s+/).filter(Boolean)
      : [],
  });

  const headline = title || bodyText.slice(0, 48);
  setStudioVariations([
    {
      id: "var_1",
      label: "אופציה 1",
      headline,
      bodyText,
      ctaButton: "",
      imageUrl: campaign.imageUrl || null,
      imagePrompt: "",
    },
    {
      id: "var_2",
      label: "אופציה 2",
      headline,
      bodyText,
      ctaButton: "",
      imageUrl: campaign.imageUrl || null,
      imagePrompt: "",
    },
  ]);
  selectVariationIndex(0);
  return true;
}

/**
 * On studio mount: SQLite campaign (URL id / latest) is source of truth,
 * then localStorage `one_loop_active_campaign` as cache.
 * Always overwrites blank / "Missing Card N" shells — never leaves them visible.
 */
function hydrateStudioFromCampaignStore(): boolean {
  // Direct localStorage read (authoritative handoff key) then sync memory
  try {
    const raw = localStorage.getItem(ONE_LOOP_CAMPAIGN_KEY);
    if (raw) hydrateCampaignFromStorage();
  } catch {
    /* ignore */
  }
  hydrateCampaignFromStorage();

  let camp = getCampaignState();
  let vars = camp.activeCampaign?.variations;

  // Fallback: last saved home / current post
  if (
    (!vars?.[0] ||
      (isBlankOrMissingHeadline(vars[0].headline) &&
        !vars[0].bodyText?.trim())) &&
    typeof window !== "undefined"
  ) {
    const cur = loadCurrentPost();
    if (cur?.headline?.trim() || cur?.body?.trim()) {
      if (!/^missing\s*card/i.test((cur.headline || "").trim())) {
        persistSelectedCardToActiveCampaign({
          headline: cur.headline || "",
          bodyText: cur.body || "",
          body: cur.body || "",
          ctaButton: cur.cta || "",
          imageUrl: cur.image_url,
          imagePrompt: cur.image_prompt || "",
          hashtags: cur.hashtags || [],
        });
        camp = getCampaignState();
        vars = camp.activeCampaign?.variations;
      }
    }
  }

  if (
    !vars?.[0] ||
    (isBlankOrMissingHeadline(vars[0].headline) && !vars[0].bodyText?.trim())
  ) {
    return false;
  }

  // Strip any "Missing Card" residue before painting
  const cleanVars: [CampaignVariation, CampaignVariation] = [
    {
      ...vars[0],
      headline: isBlankOrMissingHeadline(vars[0].headline)
        ? vars[0].bodyText?.trim()?.slice(0, 48) || ""
        : vars[0].headline,
    },
    {
      ...vars[1],
      headline: isBlankOrMissingHeadline(vars[1].headline)
        ? vars[1].bodyText?.trim()?.slice(0, 48) || vars[0].headline
        : vars[1].headline,
    },
  ];
  if (
    isBlankOrMissingHeadline(cleanVars[0].headline) &&
    !cleanVars[0].bodyText?.trim()
  ) {
    return false;
  }

  // Always push real campaign into studio store on mount / storage sync
  setStudioVariations(cleanVars);
  setStudioMeta({
    businessName: camp.activeCampaign?.businessName || "",
    imageAnchorWords: camp.activeCampaign?.imageAnchorWords || "",
  });
  selectVariationIndex(camp.activeVariationIndex === 1 ? 1 : 0);
  return true;
}

/**
 * App shell — campaign + Maya chat persistence.
 * SQLite (?id= / latest) hydrates left preview; localStorage is cache only.
 */
export function StudioLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Immediate paint from localStorage cache (no Missing Card flash)
    hydrateStudioFromCampaignStore();

    let cancelled = false;
    async function hydrateFromSqlite() {
      try {
        let idNum = NaN;
        try {
          const q = new URLSearchParams(window.location.search).get("id");
          if (q) idNum = Number.parseInt(q, 10);
        } catch {
          /* ignore */
        }
        const fromDb =
          Number.isFinite(idNum) && idNum > 0
            ? await fetchCampaignById(idNum)
            : await fetchLatestCampaign();
        if (cancelled || !fromDb) return;
        paintCampaignFromDb(fromDb);
      } catch {
        // API/DB failure — keep localStorage cache already painted above
      }
    }
    void hydrateFromSqlite();

    const savedMsgs = loadPersistedMessages();
    if (savedMsgs.length) {
      const live = getStudioState();
      if (!live.messages.length) {
        setStudioMessages(savedMsgs);
      }
    }

    function mirrorStudioIntoCampaign() {
      const studio = getStudioState();
      setCampaignLoading(studio.isLoading || studio.imagesPending);
      setActiveVariationIndex(studio.selectedVariationIndex === 1 ? 1 : 0);
      persistMessages(studio.messages);

      if (!studio.variations) return;

      const a = studio.variations[0];
      const b = studio.variations[1];
      // Never persist blank / Missing Card shells
      if (
        isBlankOrMissingHeadline(a?.headline) &&
        !a?.bodyText?.trim() &&
        isBlankOrMissingHeadline(b?.headline) &&
        !b?.bodyText?.trim()
      ) {
        return;
      }

      setCampaign({
        businessName: studio.businessName || "",
        prompt:
          studio.messages.filter((m) => m.role === "user").at(-1)?.content ||
          "",
        imageAnchorWords: studio.imageAnchorWords || "",
        variations: [
          toCampaignVariation(studio.variations[0], 0),
          toCampaignVariation(studio.variations[1], 1),
        ],
      });
    }

    // Re-hydrate after first mirror in case studio still blank
    if (
      !getStudioState().variations ||
      isBlankOrMissingHeadline(getStudioState().variations?.[0]?.headline) ||
      !getStudioState().variations?.[0]?.bodyText?.trim()
    ) {
      hydrateStudioFromCampaignStore();
    }

    mirrorStudioIntoCampaign();

    const unsubStudio = subscribeStudio(mirrorStudioIntoCampaign);
    const unsubCampaign = subscribeCampaignStore(() => {
      const live = getStudioState();
      if (
        (isBlankOrMissingHeadline(live.variations?.[0]?.headline) ||
          !live.variations?.[0]?.bodyText?.trim()) &&
        !live.isLoading
      ) {
        hydrateStudioFromCampaignStore();
      }
    });

    function onStorage(e: StorageEvent) {
      if (
        e.key === ONE_LOOP_CAMPAIGN_KEY ||
        e.key === "one_loop_active_campaign"
      ) {
        hydrateStudioFromCampaignStore();
      }
      if (e.key === ONE_LOOP_STUDIO_MESSAGES_KEY) {
        const msgs = loadPersistedMessages();
        if (msgs.length) setStudioMessages(msgs);
      }
    }
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      unsubStudio();
      unsubCampaign();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <>{children}</>;
}
