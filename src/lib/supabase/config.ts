/** Thrown when Supabase public env vars are missing or empty. */
export class SupabaseConfigError extends Error {
  readonly code = "SUPABASE_NOT_CONFIGURED" as const;

  constructor(
    message = "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Paste values from Supabase Dashboard → Project Settings → API into .env.local, then restart npm run dev."
  ) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/**
 * True when URL looks like a real Supabase project URL (https://….supabase.co).
 * Rejects secrets pasted into the URL slot (e.g. sb_secret_…) and other non-URL shapes.
 */
export function isValidSupabaseProjectUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Common mistake: putting a secret/publishable key in the URL field
  if (
    trimmed.startsWith("sb_secret_") ||
    trimmed.startsWith("sb_publishable_") ||
    trimmed.startsWith("eyJ")
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    return host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/** Anon key must look like a JWT, not a secret key. */
export function isValidSupabaseAnonKey(anonKey: string): boolean {
  const trimmed = anonKey.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("sb_secret_")) return false;
  // Legacy JWT anon keys start with eyJ; new publishable keys are also accepted
  return (
    trimmed.startsWith("eyJ") || trimmed.startsWith("sb_publishable_")
  );
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return isValidSupabaseProjectUrl(url) && isValidSupabaseAnonKey(anonKey);
}

/** Hebrew hint for login UI when URL and/or anon key are missing/invalid. */
export function getSupabaseConfigHint(): string | null {
  if (isSupabaseConfigured()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const parts: string[] = [];
  if (!isValidSupabaseProjectUrl(url)) {
    parts.push(
      url
        ? "כתובת הפרויקט (URL) לא תקינה — חייבת להיות https://PROJECT.supabase.co (לא מפתח)."
        : "חסרה כתובת הפרויקט: NEXT_PUBLIC_SUPABASE_URL (https://PROJECT.supabase.co)."
    );
  }
  if (!isValidSupabaseAnonKey(anonKey)) {
    parts.push(
      anonKey
        ? "מפתח anon/public לא תקין — השתמשו ב־anon/public או sb_publishable_ (לא sb_secret_)."
        : "חסר מפתח anon/public: NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return parts.join(" ");
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!isValidSupabaseProjectUrl(url) || !isValidSupabaseAnonKey(anonKey)) {
    throw new SupabaseConfigError();
  }
  return { url, anonKey };
}
