import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  GUEST_USER,
  hasGuestCookie,
} from "@/lib/guest";
import { withTimeout } from "@/lib/ai/with-timeout";

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type AppSession =
  | { mode: "supabase"; user: AppUser }
  | { mode: "guest"; user: AppUser };

const AUTH_TIMEOUT_MS = 4_000;

function guestSession(): AppSession {
  return {
    mode: "guest",
    user: {
      id: GUEST_USER.id,
      email: GUEST_USER.email,
      name: GUEST_USER.name,
      avatarUrl: GUEST_USER.avatarUrl,
    },
  };
}

/**
 * Resolve the current session.
 * Prefer real Supabase user; otherwise honor guest cookie for quick access.
 * Guest cookie is checked early so a hung Supabase auth never blocks guest mode.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const guest = await hasGuestCookie();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_TIMEOUT_MS,
        "supabase.auth.getUser"
      );
      if (user) {
        return {
          mode: "supabase",
          user: {
            id: user.id,
            email: user.email ?? null,
            name:
              (user.user_metadata?.full_name as string | undefined) ||
              (user.user_metadata?.name as string | undefined) ||
              null,
            avatarUrl:
              (user.user_metadata?.avatar_url as string | undefined) || null,
          },
        };
      }
    } catch (err) {
      console.warn(
        "[session] auth.getUser failed/timed out",
        err instanceof Error ? err.message : err
      );
      // Fall through — guest still works on Vercel without Google.
    }
  }

  if (guest) return guestSession();

  return null;
}
