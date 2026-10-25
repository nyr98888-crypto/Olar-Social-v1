import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  GUEST_USER,
  hasGuestCookie,
  isGuestModeAllowed,
} from "@/lib/guest";

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type AppSession =
  | { mode: "supabase"; user: AppUser }
  | { mode: "guest"; user: AppUser };

/**
 * Resolve the current session.
 * Guest is allowed ONLY when Supabase public keys are missing —
 * never a bypass when production auth is configured.
 */
export async function getAppSession(): Promise<AppSession | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
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

  if (isGuestModeAllowed() && (await hasGuestCookie())) {
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

  return null;
}
