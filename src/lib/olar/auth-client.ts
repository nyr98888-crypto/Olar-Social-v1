"use client";

import { useEffect, useState } from "react";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  bindGuestSessionCleanup,
  clearAllClientDrafts,
  getCachedAuthUserId,
  setCachedAuthUserId,
} from "./client-storage";

export type ClientAuthMode = "loading" | "guest" | "supabase";

/**
 * Client-side auth: real Supabase session vs guest.
 * Guests must never see "connected" network mocks or historical leads.
 */
export function useClientAuth() {
  const [mode, setMode] = useState<ClientAuthMode>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bindGuestSessionCleanup();

    async function resolve() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setMode("guest");
          setUserId(null);
          setCachedAuthUserId(null);
        }
        return;
      }
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setMode("supabase");
          setUserId(session.user.id);
          setCachedAuthUserId(session.user.id);
        } else {
          setMode("guest");
          setUserId(null);
          setCachedAuthUserId(null);
        }
      } catch {
        if (!cancelled) {
          setMode("guest");
          setUserId(null);
          setCachedAuthUserId(null);
        }
      }
    }

    void resolve();

    if (!isSupabaseConfigured())
      return () => {
        cancelled = true;
      };

    try {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          setMode("supabase");
          setUserId(session.user.id);
          setCachedAuthUserId(session.user.id);
        } else {
          setMode("guest");
          setUserId(null);
          setCachedAuthUserId(null);
        }
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } catch {
      return () => {
        cancelled = true;
      };
    }
  }, []);

  return {
    mode,
    userId,
    isGuest: mode === "guest",
    isAuthed: mode === "supabase",
    ready: mode !== "loading",
  };
}

/** Start Google OAuth via Supabase; preserves current origin for callback. */
export async function signInWithGoogle(
  nextPath = "/"
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "supabase_not_configured" };
  }
  try {
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "oauth_failed",
    };
  }
}

/**
 * Sign out Supabase + wipe user_data_${id}, sessionStorage, and legacy draft keys
 * so the next guest session starts clean.
 */
export async function signOutAndClear(): Promise<void> {
  const uid = getCachedAuthUserId();
  try {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
  } catch {
    /* ignore */
  }
  clearAllClientDrafts({ userId: uid, clearOAuthBridge: true });
  const { clearGuestSession } = await import("@/lib/olar/client-storage");
  clearGuestSession();
}
