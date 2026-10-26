/**
 * Central campaign persistence store (Phase 1).
 * Bidirectional sync with localStorage key `one_loop_active_campaign`.
 * Survives F5 and side-nav switches (calendar / leads / my page / studio).
 */
"use client";

import { useCallback, useSyncExternalStore } from "react";

export const ONE_LOOP_CAMPAIGN_KEY = "one_loop_active_campaign";
export const ONE_LOOP_SCHEDULED_POSTS_KEY = "one_loop_scheduled_posts";

export type CampaignVariation = {
  id: "var_1" | "var_2";
  label: string;
  headline: string;
  bodyText: string;
  ctaButton: string;
  imageUrl: string | null;
  imagePrompt: string;
};

export type ActiveCampaign = {
  businessName: string;
  prompt: string;
  imageAnchorWords: string;
  variations: [CampaignVariation, CampaignVariation] | null;
};

/** Local calendar posts (Phase 6) — persisted under `one_loop_scheduled_posts`. */
export type ScheduledPost = {
  id: string;
  headline: string;
  bodyText: string;
  ctaButton: string;
  imageUrl: string | null;
  /** ISO datetime when the post should go live */
  scheduledAt: string;
  createdAt: string;
};

export type CampaignStoreState = {
  activeCampaign: ActiveCampaign | null;
  isLoading: boolean;
  activeVariationIndex: 0 | 1;
  scheduledPosts: ScheduledPost[];
};

export type SchedulePostInput = {
  headline: string;
  bodyText?: string;
  ctaButton?: string;
  imageUrl?: string | null;
  /** Defaults to ~2 hours from now, on the hour */
  scheduledAt?: Date | string;
};

export type SetCampaignInput = {
  businessName?: string;
  prompt?: string;
  imageAnchorWords?: string;
  variations?: [CampaignVariation, CampaignVariation] | CampaignVariation[] | null;
};

const EMPTY_VARIATION = (index: 0 | 1): CampaignVariation => ({
  id: index === 1 ? "var_2" : "var_1",
  label: index === 1 ? "אופציה 2" : "אופציה 1",
  headline: "",
  bodyText: "",
  ctaButton: "",
  imageUrl: null,
  imagePrompt: "",
});

const DEFAULT_STATE: CampaignStoreState = {
  activeCampaign: null,
  isLoading: false,
  activeVariationIndex: 0,
  scheduledPosts: [],
};

let state: CampaignStoreState = { ...DEFAULT_STATE };
let hydrated = false;
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emit() {
  for (const l of listeners) l();
}

function normalizeVariation(
  raw: Partial<CampaignVariation> | null | undefined,
  index: 0 | 1
): CampaignVariation {
  const base = EMPTY_VARIATION(index);
  if (!raw || typeof raw !== "object") return base;
  const imageUrl =
    typeof raw.imageUrl === "string" && raw.imageUrl.trim()
      ? raw.imageUrl
      : null;
  return {
    id: index === 1 ? "var_2" : "var_1",
    label:
      typeof raw.label === "string" && raw.label.trim()
        ? raw.label
        : base.label,
    headline: typeof raw.headline === "string" ? raw.headline : "",
    bodyText: typeof raw.bodyText === "string" ? raw.bodyText : "",
    ctaButton: typeof raw.ctaButton === "string" ? raw.ctaButton : "",
    imageUrl,
    imagePrompt: typeof raw.imagePrompt === "string" ? raw.imagePrompt : "",
  };
}

function normalizeVariations(
  raw: unknown
): [CampaignVariation, CampaignVariation] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const a = normalizeVariation(raw[0] as Partial<CampaignVariation>, 0);
  const b = normalizeVariation(raw[1] as Partial<CampaignVariation>, 1);
  if (!a.headline.trim() && !a.bodyText.trim() && !b.headline.trim()) {
    // Allow image-only drafts if at least one image exists
    if (!a.imageUrl && !b.imageUrl) return null;
  }
  return [a, b];
}

function persistToLocalStorage(next: CampaignStoreState) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      ONE_LOOP_CAMPAIGN_KEY,
      JSON.stringify({
        activeCampaign: next.activeCampaign,
        isLoading: false, // never restore mid-flight loading
        activeVariationIndex: next.activeVariationIndex,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* quota / private mode */
  }
  persistScheduledPosts(next.scheduledPosts);
}

function persistScheduledPosts(posts: ScheduledPost[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(ONE_LOOP_SCHEDULED_POSTS_KEY, JSON.stringify(posts));
  } catch {
    /* quota / private mode */
  }
}

function normalizeScheduledPost(raw: unknown): ScheduledPost | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ScheduledPost>;
  const id = typeof p.id === "string" && p.id.trim() ? p.id : null;
  const scheduledAt =
    typeof p.scheduledAt === "string" && p.scheduledAt.trim()
      ? p.scheduledAt
      : null;
  if (!id || !scheduledAt) return null;
  return {
    id,
    headline: typeof p.headline === "string" ? p.headline : "",
    bodyText: typeof p.bodyText === "string" ? p.bodyText : "",
    ctaButton: typeof p.ctaButton === "string" ? p.ctaButton : "",
    imageUrl:
      typeof p.imageUrl === "string" && p.imageUrl.trim() ? p.imageUrl : null,
    scheduledAt,
    createdAt:
      typeof p.createdAt === "string" && p.createdAt.trim()
        ? p.createdAt
        : scheduledAt,
  };
}

function readScheduledPostsFromStorage(): ScheduledPost[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ONE_LOOP_SCHEDULED_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeScheduledPost)
      .filter((p): p is ScheduledPost => Boolean(p))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  } catch {
    return [];
  }
}

/** Flat card written from home → studio (also embedded in storage payload). */
export type SelectedCardPayload = {
  headline: string;
  bodyText: string;
  body?: string;
  ctaButton?: string;
  cta?: string;
  imageUrl?: string | null;
  imagePrompt?: string;
  hashtags?: string[];
  businessName?: string;
  label?: string;
};

function variationsFromSelectedCard(
  card: SelectedCardPayload
): [CampaignVariation, CampaignVariation] | null {
  const headline = (card.headline || "").trim();
  const bodyText = (card.bodyText || card.body || "").trim();
  if (!headline && !bodyText) return null;
  if (/^missing\s*card/i.test(headline)) return null;
  const cta = (card.ctaButton || card.cta || "").trim();
  const imageUrl =
    typeof card.imageUrl === "string" && card.imageUrl.trim()
      ? card.imageUrl.trim()
      : null;
  const imagePrompt =
    typeof card.imagePrompt === "string" ? card.imagePrompt : "";
  const a: CampaignVariation = {
    id: "var_1",
    label: card.label || "אופציה 1",
    headline,
    bodyText,
    ctaButton: cta,
    imageUrl,
    imagePrompt,
  };
  const b: CampaignVariation = {
    ...a,
    id: "var_2",
    label: "אופציה 2",
  };
  return [a, b];
}

function readFromLocalStorage(): CampaignStoreState | null {
  if (!isBrowser()) return null;
  const scheduledPosts = readScheduledPostsFromStorage();
  try {
    const raw = localStorage.getItem(ONE_LOOP_CAMPAIGN_KEY);
    if (!raw) {
      return {
        activeCampaign: null,
        isLoading: false,
        activeVariationIndex: 0,
        scheduledPosts,
      };
    }
    const parsed = JSON.parse(raw) as Partial<CampaignStoreState> &
      SelectedCardPayload & {
        updatedAt?: string;
      };
    const campaign = parsed.activeCampaign;
    let variations =
      campaign && typeof campaign === "object"
        ? normalizeVariations(campaign.variations)
        : null;

    // Flat selectedCard written by home "המשך לעריכה בסטודיו"
    if (!variations) {
      variations = variationsFromSelectedCard(parsed);
    }

    if (!campaign || typeof campaign !== "object") {
      if (!variations) {
        return {
          activeCampaign: null,
          isLoading: false,
          activeVariationIndex: parsed.activeVariationIndex === 1 ? 1 : 0,
          scheduledPosts,
        };
      }
      return {
        activeCampaign: {
          businessName:
            typeof parsed.businessName === "string" ? parsed.businessName : "",
          prompt: typeof parsed.headline === "string" ? parsed.headline : "",
          imageAnchorWords: "",
          variations,
        },
        isLoading: false,
        activeVariationIndex: parsed.activeVariationIndex === 1 ? 1 : 0,
        scheduledPosts,
      };
    }

    return {
      activeCampaign: {
        businessName:
          typeof campaign.businessName === "string"
            ? campaign.businessName
            : "",
        prompt: typeof campaign.prompt === "string" ? campaign.prompt : "",
        imageAnchorWords:
          typeof campaign.imageAnchorWords === "string"
            ? campaign.imageAnchorWords
            : "",
        variations,
      },
      isLoading: false,
      activeVariationIndex: parsed.activeVariationIndex === 1 ? 1 : 0,
      scheduledPosts,
    };
  } catch {
    return {
      activeCampaign: null,
      isLoading: false,
      activeVariationIndex: 0,
      scheduledPosts,
    };
  }
}

function ensureHydrated() {
  if (hydrated || !isBrowser()) return;
  hydrated = true;
  const restored = readFromLocalStorage();
  if (restored) {
    state = restored;
  }
}

function setState(
  partial:
    | Partial<CampaignStoreState>
    | ((prev: CampaignStoreState) => CampaignStoreState)
) {
  ensureHydrated();
  const next =
    typeof partial === "function" ? partial(state) : { ...state, ...partial };
  state = next;
  persistToLocalStorage(state);
  emit();
}

/** Subscribe — used by StudioLayout / multi-tab sync. */
export function subscribeCampaignStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCampaignState(): CampaignStoreState {
  ensureHydrated();
  return state;
}

/** Force re-read from localStorage (e.g. storage event from another tab). */
export function hydrateCampaignFromStorage(): boolean {
  if (!isBrowser()) return false;
  const restored = readFromLocalStorage();
  hydrated = true;
  if (!restored) return false;
  state = restored;
  emit();
  return Boolean(restored.activeCampaign?.variations);
}

export function setCampaign(data: SetCampaignInput) {
  setState((prev) => {
    const base: ActiveCampaign = prev.activeCampaign ?? {
      businessName: "",
      prompt: "",
      imageAnchorWords: "",
      variations: null,
    };
    const variations =
      data.variations === undefined
        ? base.variations
        : data.variations === null
          ? null
          : normalizeVariations(data.variations);

    return {
      ...prev,
      activeCampaign: {
        businessName:
          data.businessName !== undefined
            ? data.businessName
            : base.businessName,
        prompt: data.prompt !== undefined ? data.prompt : base.prompt,
        imageAnchorWords:
          data.imageAnchorWords !== undefined
            ? data.imageAnchorWords
            : base.imageAnchorWords,
        variations,
      },
    };
  });
}

/**
 * Home → Studio handoff.
 * Writes the selected card into `one_loop_active_campaign` (flat + structured)
 * so StudioLayout can paint the left card immediately.
 */
export function persistSelectedCardToActiveCampaign(
  selectedCard: SelectedCardPayload
): boolean {
  if (!isBrowser()) return false;
  const headline = (selectedCard.headline || "").trim();
  const bodyText = (
    selectedCard.bodyText ||
    selectedCard.body ||
    ""
  ).trim();
  if (!headline && !bodyText) return false;
  if (/^missing\s*card/i.test(headline)) return false;

  const variations = variationsFromSelectedCard({
    ...selectedCard,
    headline,
    bodyText,
  });
  if (!variations) return false;

  const businessName =
    typeof selectedCard.businessName === "string"
      ? selectedCard.businessName
      : getCampaignState().activeCampaign?.businessName || "";

  const payload = {
    // Flat selectedCard (explicit handoff shape)
    headline,
    bodyText,
    body: bodyText,
    ctaButton: (selectedCard.ctaButton || selectedCard.cta || "").trim(),
    cta: (selectedCard.ctaButton || selectedCard.cta || "").trim(),
    imageUrl: variations[0].imageUrl,
    imagePrompt: variations[0].imagePrompt,
    hashtags: Array.isArray(selectedCard.hashtags)
      ? selectedCard.hashtags
      : [],
    businessName,
    // Structured campaign-store shape
    activeCampaign: {
      businessName,
      prompt: headline,
      imageAnchorWords: "",
      variations,
    },
    activeVariationIndex: 0 as const,
    isLoading: false,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(ONE_LOOP_CAMPAIGN_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }

  hydrated = true;
  state = {
    ...state,
    activeCampaign: payload.activeCampaign,
    isLoading: false,
    activeVariationIndex: 0,
  };
  emit();
  return true;
}

export function updateVariationText(
  index: number,
  headline: string,
  bodyText: string
) {
  const i: 0 | 1 = index === 1 ? 1 : 0;
  setState((prev) => {
    if (!prev.activeCampaign?.variations) return prev;
    const nextVars: [CampaignVariation, CampaignVariation] = [
      { ...prev.activeCampaign.variations[0] },
      { ...prev.activeCampaign.variations[1] },
    ];
    nextVars[i] = {
      ...nextVars[i]!,
      headline,
      bodyText,
    };
    return {
      ...prev,
      activeCampaign: {
        ...prev.activeCampaign,
        variations: nextVars,
      },
    };
  });
}

export function updateVariationImage(index: number, imageUrl: string | null) {
  const i: 0 | 1 = index === 1 ? 1 : 0;
  setState((prev) => {
    if (!prev.activeCampaign?.variations) return prev;
    const nextVars: [CampaignVariation, CampaignVariation] = [
      { ...prev.activeCampaign.variations[0] },
      { ...prev.activeCampaign.variations[1] },
    ];
    nextVars[i] = {
      ...nextVars[i]!,
      imageUrl: imageUrl?.trim() || null,
    };
    return {
      ...prev,
      activeCampaign: {
        ...prev.activeCampaign,
        variations: nextVars,
      },
    };
  });
}

export function setActiveVariationIndex(index: number) {
  setState({ activeVariationIndex: index === 1 ? 1 : 0 });
}

export function setCampaignLoading(isLoading: boolean) {
  setState({ isLoading });
}

export function reset() {
  setState({
    activeCampaign: null,
    isLoading: false,
    activeVariationIndex: 0,
    // Keep scheduled posts — they live on the calendar independently
  });
}

function defaultScheduleAt(): Date {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 2);
  return start;
}

/** Add a post to the local calendar (`one_loop_scheduled_posts`). */
export function schedulePost(input: SchedulePostInput): ScheduledPost {
  ensureHydrated();
  const when =
    input.scheduledAt instanceof Date
      ? input.scheduledAt
      : typeof input.scheduledAt === "string" && input.scheduledAt.trim()
        ? new Date(input.scheduledAt)
        : defaultScheduleAt();
  const scheduledAt = Number.isNaN(when.getTime())
    ? defaultScheduleAt().toISOString()
    : when.toISOString();
  const post: ScheduledPost = {
    id: `sched_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    headline: (input.headline || "").trim() || "פוסט מתוזמן",
    bodyText: (input.bodyText || "").trim(),
    ctaButton: (input.ctaButton || "").trim(),
    imageUrl: input.imageUrl?.trim() || null,
    scheduledAt,
    createdAt: new Date().toISOString(),
  };
  setState((prev) => ({
    ...prev,
    scheduledPosts: [...prev.scheduledPosts, post].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt)
    ),
  }));
  return post;
}

export function removeScheduledPost(id: string) {
  setState((prev) => ({
    ...prev,
    scheduledPosts: prev.scheduledPosts.filter((p) => p.id !== id),
  }));
}

export function getScheduledPosts(): ScheduledPost[] {
  ensureHydrated();
  return state.scheduledPosts;
}

export function useCampaignStore(): CampaignStoreState {
  return useSyncExternalStore(
    subscribeCampaignStore,
    () => {
      ensureHydrated();
      return state;
    },
    () => DEFAULT_STATE
  );
}

export function useActiveCampaignVariation(): CampaignVariation | null {
  const s = useCampaignStore();
  if (!s.activeCampaign?.variations) return null;
  return (
    s.activeCampaign.variations[s.activeVariationIndex] ??
    s.activeCampaign.variations[0] ??
    null
  );
}

/** Imperative helpers for non-hook call sites (StudioLayout bridge). */
export function useCampaignActions() {
  return {
    setCampaign: useCallback((data: SetCampaignInput) => setCampaign(data), []),
    updateVariationText: useCallback(
      (index: number, headline: string, bodyText: string) =>
        updateVariationText(index, headline, bodyText),
      []
    ),
    updateVariationImage: useCallback(
      (index: number, imageUrl: string | null) =>
        updateVariationImage(index, imageUrl),
      []
    ),
    setActiveVariationIndex: useCallback(
      (index: number) => setActiveVariationIndex(index),
      []
    ),
    setCampaignLoading: useCallback(
      (v: boolean) => setCampaignLoading(v),
      []
    ),
    schedulePost: useCallback(
      (input: SchedulePostInput) => schedulePost(input),
      []
    ),
    removeScheduledPost: useCallback(
      (id: string) => removeScheduledPost(id),
      []
    ),
    reset: useCallback(() => reset(), []),
    hydrate: useCallback(() => hydrateCampaignFromStorage(), []),
  };
}
