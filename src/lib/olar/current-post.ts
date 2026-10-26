/** Current business post — guest: sessionStorage; auth: user_data_${id} + server sync. */
"use client";

import { useEffect, useState } from "react";
import {
  getCachedAuthUserId,
  isGuestMode,
  storageGet,
  storageRemove,
  storageSet,
} from "./client-storage";
import { stripCategoryLeak } from "./strip-category";

export const CURRENT_POST_KEY = "current_business_post";

export type CurrentBusinessPost = {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  offer?: string;
  image_url: string | null;
  image_seed?: number | null;
  image_prompt?: string | null;
  network?: string;
  updatedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith("data:image/svg") ||
    url.includes("תמונה%20בהכנה") ||
    url.includes("%D7%AA%D7%9E%D7%95%D7%A0%D7%94%20%D7%91%D7%94%D7%9B%D7%A0%D7%94")
  );
}

export function sanitizeImageUrl(
  url: string | null | undefined,
  fallback = false
): string | null {
  if (fallback || isPlaceholderUrl(url)) return null;
  return url ?? null;
}

export function loadCurrentPost(): CurrentBusinessPost | null {
  const raw = storageGet("current-post");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CurrentBusinessPost;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      headline: stripCategoryLeak(parsed.headline || ""),
      body: stripCategoryLeak(parsed.body || ""),
      cta: stripCategoryLeak(parsed.cta || ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      offer: parsed.offer || undefined,
      image_url: sanitizeImageUrl(parsed.image_url),
      image_seed: parsed.image_seed ?? null,
      image_prompt: parsed.image_prompt ?? null,
      network: parsed.network,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveCurrentPost(
  patch: Partial<CurrentBusinessPost> &
    Pick<CurrentBusinessPost, "headline" | "body">
): CurrentBusinessPost {
  const prev = loadCurrentPost();
  const next: CurrentBusinessPost = {
    headline: stripCategoryLeak(patch.headline ?? prev?.headline ?? ""),
    body: stripCategoryLeak(patch.body ?? prev?.body ?? ""),
    cta: stripCategoryLeak(patch.cta ?? prev?.cta ?? ""),
    hashtags: patch.hashtags ?? prev?.hashtags ?? [],
    offer: patch.offer ?? prev?.offer,
    image_url:
      patch.image_url !== undefined
        ? sanitizeImageUrl(patch.image_url)
        : (prev?.image_url ?? null),
    image_seed:
      patch.image_seed !== undefined
        ? patch.image_seed
        : (prev?.image_seed ?? null),
    image_prompt:
      patch.image_prompt !== undefined
        ? patch.image_prompt
        : (prev?.image_prompt ?? null),
    network: patch.network ?? prev?.network,
    updatedAt: new Date().toISOString(),
  };
  storageSet("current-post", JSON.stringify(next));
  if (isBrowser()) {
    try {
      window.dispatchEvent(
        new CustomEvent("olar-current-post", { detail: next })
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function saveCurrentPostImage(opts: {
  image_url: string | null;
  image_seed?: number | null;
  image_prompt?: string | null;
  fallback?: boolean;
}): CurrentBusinessPost | null {
  const url = sanitizeImageUrl(opts.image_url, opts.fallback === true);
  const prev = loadCurrentPost();
  if (!prev) {
    if (!url) return null;
    return saveCurrentPost({
      headline: "",
      body: "",
      cta: "",
      hashtags: [],
      image_url: url,
      image_seed: opts.image_seed ?? null,
      image_prompt: opts.image_prompt ?? null,
    });
  }
  return saveCurrentPost({
    ...prev,
    image_url: url,
    image_seed: opts.image_seed ?? prev.image_seed ?? null,
    image_prompt: opts.image_prompt ?? prev.image_prompt ?? null,
  });
}

export function clearCurrentPost(): void {
  storageRemove("current-post");
}

/** Persist to Supabase when authenticated (fire-and-forget). Guests skip. */
export async function syncCurrentPostToServer(
  post?: CurrentBusinessPost | null
): Promise<void> {
  if (isGuestMode() || !getCachedAuthUserId()) return;
  const payload = post ?? loadCurrentPost();
  if (!payload) return;
  try {
    await fetch("/api/posts/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* soft fail — local copy remains */
  }
}

export function useCurrentPost() {
  const [post, setPost] = useState<CurrentBusinessPost | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPost(loadCurrentPost());
    setReady(true);

    function onCustom(e: Event) {
      const detail = (e as CustomEvent<CurrentBusinessPost>).detail;
      setPost(detail ?? loadCurrentPost());
    }
    function onStorage(e: StorageEvent) {
      if (
        e.key === CURRENT_POST_KEY ||
        (e.key && e.key.includes("current_business_post"))
      ) {
        setPost(loadCurrentPost());
      }
    }
    window.addEventListener("olar-current-post", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("olar-current-post", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { post, ready, reload: () => setPost(loadCurrentPost()) };
}
