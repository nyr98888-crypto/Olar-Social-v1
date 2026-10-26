/**
 * Single source of truth for Studio session — chat + A/B preview.
 * useSyncExternalStore (no Zustand in deps).
 * Survives F5 + tab switches via localStorage `current_active_post`.
 */
"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  VAR_1_LABEL,
  VAR_2_LABEL,
  type CampaignVariation,
  type VariationId,
} from "@/lib/olar/ab-variations";
import {
  DEFAULT_POST_TYPE,
  normalizePostType,
  type PostTypeId,
} from "@/lib/olar/post-types";

export interface PostVariation {
  id: string;
  label: string;
  headline: string;
  bodyText: string;
  imageUrl: string;
  imagePrompt: string;
  ctaButton: string;
}

export type StudioApplyPatch = {
  headline: string;
  bodyText: string;
  ctaButton?: string;
};

export type StudioChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** When set, UI shows "החל על הפוסט שלי" and applies this copy to the preview. */
  applyPatch?: StudioApplyPatch | null;
};

export interface StudioSessionState {
  businessName: string;
  category: string;
  /** Content pillar — milestone | client_satisfaction | before_after | promotion */
  postType: PostTypeId;
  /** Optional 2–4 visual words — forwarded on image regen (image-only). */
  imageAnchorWords: string;
  messages: StudioChatMessage[];
  variations: [PostVariation, PostVariation] | null;
  selectedVariationIndex: number;
  isLoading: boolean;
  /** True while A/B images are still generating after text reply. */
  imagesPending: boolean;
}

/** Full A/B post payload — localStorage key (survives F5 + menu navigation). */
export const CURRENT_ACTIVE_POST_KEY = "current_active_post";

const STORAGE_KEY = "olar-studio-session";

const DEFAULT_STATE: StudioSessionState = {
  businessName: "",
  category: "",
  postType: DEFAULT_POST_TYPE,
  imageAnchorWords: "",
  messages: [],
  variations: null,
  selectedVariationIndex: 0,
  isLoading: false,
  imagesPending: false,
};

let state: StudioSessionState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emit() {
  for (const l of listeners) l();
}

export type ActivePostData = {
  businessName: string;
  category: string;
  postType: PostTypeId;
  imageAnchorWords: string;
  messages: StudioSessionState["messages"];
  variations: [PostVariation, PostVariation] | null;
  selectedVariationIndex: number;
  updatedAt: string;
};

function toActivePostPayload(next: StudioSessionState): ActivePostData {
  return {
    businessName: next.businessName,
    category: next.category,
    postType: next.postType,
    imageAnchorWords: next.imageAnchorWords,
    messages: next.messages.slice(-24),
    variations: next.variations,
    selectedVariationIndex: next.selectedVariationIndex,
    updatedAt: new Date().toISOString(),
  };
}

function parseStoredPayload(raw: string | null): StudioSessionState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StudioSessionState> & {
      updatedAt?: string;
    };
    const vars = normalizeVariationsTuple(parsed.variations);
    return {
      businessName:
        typeof parsed.businessName === "string" ? parsed.businessName : "",
      category: typeof parsed.category === "string" ? parsed.category : "",
      postType: normalizePostType(
        typeof parsed.postType === "string" ? parsed.postType : DEFAULT_POST_TYPE
      ),
      imageAnchorWords:
        typeof parsed.imageAnchorWords === "string"
          ? parsed.imageAnchorWords.slice(0, 160)
          : "",
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.filter(
            (m): m is StudioChatMessage =>
              Boolean(
                m &&
                  (m.role === "user" || m.role === "assistant") &&
                  typeof m.content === "string"
              )
          )
        : [],
      variations: vars,
      selectedVariationIndex:
        vars && parsed.selectedVariationIndex === 1 ? 1 : 0,
      isLoading: false,
      imagesPending: false,
    };
  } catch {
    return null;
  }
}

/** Write full post (texts + 2 images) to localStorage immediately. */
export function persistActivePost(next: StudioSessionState = state): void {
  if (!isBrowser()) return;
  try {
    const payload = toActivePostPayload(next);
    localStorage.setItem(CURRENT_ACTIVE_POST_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadActivePost(): ActivePostData | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(CURRENT_ACTIVE_POST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivePostData;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistGuestPieces(next: StudioSessionState) {
  if (!isBrowser()) return;
  const payload = toActivePostPayload(next);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  // Authoritative durable copy — F5 / menu navigation must not wipe results
  try {
    localStorage.setItem(CURRENT_ACTIVE_POST_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function hydrateFromSession(): StudioSessionState {
  if (!isBrowser()) return { ...DEFAULT_STATE };
  // Prefer durable localStorage; fall back to session draft
  try {
    const fromLocal = parseStoredPayload(
      localStorage.getItem(CURRENT_ACTIVE_POST_KEY)
    );
    if (fromLocal?.variations) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    const fromSession = parseStoredPayload(sessionStorage.getItem(STORAGE_KEY));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_STATE };
}

let hydrated = false;

function ensureHydrated() {
  if (hydrated || !isBrowser()) return;
  hydrated = true;
  state = hydrateFromSession();
}

function setState( partial: Partial<StudioSessionState> | ((prev: StudioSessionState) => StudioSessionState)
) {
  ensureHydrated();
  const next =
    typeof partial === "function" ? partial(state) : { ...state, ...partial };
  state = next;
  persistGuestPieces(state);
  emit();
}

export function getStudioState(): StudioSessionState {
  ensureHydrated();
  return state;
}

export function subscribeStudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStudioStore(): StudioSessionState {
  return useSyncExternalStore(
    subscribeStudio,
    () => {
      ensureHydrated();
      return state;
    },
    () => DEFAULT_STATE
  );
}

export function useSelectedVariation(): PostVariation | null {
  const s = useStudioStore();
  if (!s.variations) return null;
  return s.variations[s.selectedVariationIndex] ?? s.variations[0] ?? null;
}

export function campaignToPostVariation(
  v: CampaignVariation,
  index: number
): PostVariation {
  const id = (v.id === "var_2" || index === 1 ? "var_2" : "var_1") as VariationId;
  return {
    id,
    label: v.label || (id === "var_1" ? VAR_1_LABEL : VAR_2_LABEL),
    headline: v.headline,
    bodyText: v.bodyText,
    imageUrl: v.imageUrl || "",
    imagePrompt: v.imagePrompt || "",
    ctaButton: v.ctaButton || "",
  };
}

export function postToCampaignVariation(v: PostVariation): CampaignVariation {
  const id: VariationId = v.id === "var_2" ? "var_2" : "var_1";
  return {
    id,
    label: v.label || (id === "var_1" ? VAR_1_LABEL : VAR_2_LABEL),
    headline: v.headline,
    bodyText: v.bodyText,
    ctaButton: v.ctaButton,
    imagePrompt: v.imagePrompt,
    imageUrl: v.imageUrl || null,
  };
}

function normalizeVariationsTuple(
  raw: unknown
): [PostVariation, PostVariation] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const a = raw[0] as Partial<PostVariation>;
  const b = raw[1] as Partial<PostVariation>;
  if (!a?.headline?.trim() || !a?.bodyText?.trim()) return null;
  if (!b?.headline?.trim() || !b?.bodyText?.trim()) return null;
  return [
    {
      id: a.id === "var_2" ? "var_2" : "var_1",
      label: a.label || VAR_1_LABEL,
      headline: String(a.headline),
      bodyText: String(a.bodyText),
      imageUrl: typeof a.imageUrl === "string" ? a.imageUrl : "",
      imagePrompt: typeof a.imagePrompt === "string" ? a.imagePrompt : "",
      ctaButton: typeof a.ctaButton === "string" ? a.ctaButton : "",
    },
    {
      id: "var_2",
      label: b.label || VAR_2_LABEL,
      headline: String(b.headline),
      bodyText: String(b.bodyText),
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : "",
      imagePrompt: typeof b.imagePrompt === "string" ? b.imagePrompt : "",
      ctaButton: typeof b.ctaButton === "string" ? b.ctaButton : "",
    },
  ];
}

export function setStudioMeta(opts: {
  businessName?: string;
  category?: string;
  postType?: PostTypeId;
  imageAnchorWords?: string | null;
}) {
  setState((prev) => ({
    ...prev,
    businessName:
      opts.businessName !== undefined ? opts.businessName : prev.businessName,
    category: opts.category !== undefined ? opts.category : prev.category,
    postType:
      opts.postType !== undefined
        ? normalizePostType(opts.postType)
        : prev.postType,
    imageAnchorWords:
      opts.imageAnchorWords !== undefined
        ? (opts.imageAnchorWords || "").trim().slice(0, 160)
        : prev.imageAnchorWords,
  }));
}

export function setStudioPostType(postType: PostTypeId) {
  setState({ postType: normalizePostType(postType) });
}

export function setStudioLoading(isLoading: boolean) {
  if (isLoading) {
    // New generate: wipe prior images immediately so cards show spinner, not stale FAL URLs
    setState((prev) => ({
      ...prev,
      isLoading: true,
      imagesPending: true,
      variations: prev.variations
        ? [
            { ...prev.variations[0], imageUrl: "" },
            { ...prev.variations[1], imageUrl: "" },
          ]
        : null,
    }));
    return;
  }
  setState({ isLoading: false });
}

export function setStudioImagesPending(imagesPending: boolean) {
  setState({ imagesPending });
}

export function setStudioMessages(messages: StudioChatMessage[]) {
  setState({
    messages: Array.isArray(messages) ? messages.slice(-48) : [],
  });
}

/** Explicit image cache reset (create / send). */
export function clearStudioVariationImages() {
  setState((prev) => {
    if (!prev.variations) return prev;
    return {
      ...prev,
      variations: [
        { ...prev.variations[0], imageUrl: "" },
        { ...prev.variations[1], imageUrl: "" },
      ],
    };
  });
}

export function appendStudioMessage(msg: StudioChatMessage) {
  setState((prev) => ({
    ...prev,
    messages: [...prev.messages, msg].slice(-48),
  }));
}

export function setStudioVariations(
  vars: [PostVariation, PostVariation] | CampaignVariation[] | PostVariation[]
) {
  if (!Array.isArray(vars) || vars.length < 2) {
    setState({ variations: null, selectedVariationIndex: 0 });
    return;
  }
  const asCampaign = (v: PostVariation | CampaignVariation, i: number) =>
    campaignToPostVariation(
      {
        id: (v.id === "var_2" || i === 1 ? "var_2" : "var_1") as VariationId,
        label: v.label || (i === 0 ? VAR_1_LABEL : VAR_2_LABEL),
        headline: v.headline,
        bodyText: v.bodyText,
        ctaButton: v.ctaButton,
        imagePrompt: v.imagePrompt,
        imageUrl: v.imageUrl ?? null,
        hashtags: "hashtags" in v ? v.hashtags : undefined,
      },
      i
    );
  const tuple: [PostVariation, PostVariation] = [
    asCampaign(vars[0]!, 0),
    asCampaign(vars[1]!, 1),
  ];
  setState({
    variations: tuple,
    selectedVariationIndex: 0,
  });
}

export function selectVariationIndex(index: number) {
  setState((prev) => {
    if (!prev.variations) return prev;
    const i = index === 1 ? 1 : 0;
    return { ...prev, selectedVariationIndex: i };
  });
}

export function updateVariationImage(
  index: number,
  opts: { imageUrl: string; imagePrompt?: string }
) {
  setState((prev) => {
    if (!prev.variations) return prev;
    const i = index === 1 ? 1 : 0;
    const next: [PostVariation, PostVariation] = [
      { ...prev.variations[0] },
      { ...prev.variations[1] },
    ];
    next[i] = {
      ...next[i]!,
      imageUrl: opts.imageUrl,
      ...(opts.imagePrompt !== undefined
        ? { imagePrompt: opts.imagePrompt }
        : {}),
    };
    return { ...prev, variations: next };
  });
}

export function updateVariationCopy(
  index: number,
  opts: { headline?: string; bodyText?: string; ctaButton?: string }
) {
  setState((prev) => {
    if (!prev.variations) return prev;
    const i = index === 1 ? 1 : 0;
    const next: [PostVariation, PostVariation] = [
      { ...prev.variations[0] },
      { ...prev.variations[1] },
    ];
    const cur = next[i]!;
    next[i] = {
      ...cur,
      headline:
        opts.headline !== undefined ? opts.headline : cur.headline,
      bodyText:
        opts.bodyText !== undefined ? opts.bodyText : cur.bodyText,
      ctaButton:
        opts.ctaButton !== undefined ? opts.ctaButton : cur.ctaButton,
    };
    return { ...prev, variations: next };
  });
}

export function clearStudioSession() {
  state = { ...DEFAULT_STATE };
  if (isBrowser()) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(CURRENT_ACTIVE_POST_KEY);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("one_loop_studio_messages");
    } catch {
      /* ignore */
    }
  }
  emit();
}

/** Re-apply `current_active_post` from localStorage into the live store. */
export function hydrateStudioFromActivePost(): boolean {
  if (!isBrowser()) return false;
  try {
    const restored = parseStoredPayload(
      localStorage.getItem(CURRENT_ACTIVE_POST_KEY)
    );
    if (!restored?.variations) return false;
    state = { ...restored, isLoading: false, imagesPending: false };
    hydrated = true;
    persistGuestPieces(state);
    emit();
    return true;
  } catch {
    return false;
  }
}

/** Hook helpers for send flow */
export function useStudioActions() {
  const appendMessage = useCallback(
    (msg: { role: "user" | "assistant"; content: string }) => {
      appendStudioMessage(msg);
    },
    []
  );
  const setLoading = useCallback((v: boolean) => setStudioLoading(v), []);
  const setVariations = useCallback(
    (vars: [PostVariation, PostVariation] | CampaignVariation[]) => {
      setStudioVariations(vars);
    },
    []
  );
  const selectIndex = useCallback(
    (i: number) => selectVariationIndex(i),
    []
  );
  const setImage = useCallback(
    (index: number, opts: { imageUrl: string; imagePrompt?: string }) => {
      updateVariationImage(index, opts);
    },
    []
  );
  return { appendMessage, setLoading, setVariations, selectIndex, setImage };
}
