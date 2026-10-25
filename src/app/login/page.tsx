"use client";

import {
  createClient,
  getSupabaseConfigHint,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const configHint = getSupabaseConfigHint();
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setError(friendlyAuthError(authError.message));
        setLoading(false);
      }
    } catch (err) {
      const raw =
        err instanceof SupabaseConfigError
          ? err.message
          : err instanceof Error
            ? err.message
            : "שגיאה בהתחברות";
      setError(friendlyAuthError(raw));
      setLoading(false);
    }
  }

  async function continueAsGuest() {
    if (configured) return;
    setGuestLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guest", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "לא ניתן להיכנס כאורח");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במצב אורח");
      setGuestLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-accent-soft/60 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-paper-deep blur-3xl" />
      </div>

      <section className="relative w-full max-w-md animate-rise rounded-3xl border border-line bg-panel p-6 shadow-[var(--shadow)] sm:p-10">
        <p
          className="text-sm tracking-wide text-accent"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Social Swiss Army Knife
        </p>
        <h1
          className="mt-3 text-4xl leading-none text-ink sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          יונה
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          סוכנת הסושיאל שלך — שיחה, פוסטים וויז&apos;ואל במקום אחד. התחברות שומרת
          את הרצף גם אחרי ריענון.
        </p>

        {!configured && (
          <div
            className="mt-6 rounded-2xl border border-line bg-paper-deep/40 px-4 py-3 text-sm leading-relaxed text-ink-soft break-words"
            role="status"
          >
            <p className="font-medium text-ink">חסרים מפתחות Supabase</p>
            {configHint && <p className="mt-2 text-ink">{configHint}</p>}
            <p className="mt-2">
              מפתחות AI (OpenRouter/Groq/Gemini/FAL) לא מחברים Google. אפשר
              להמשיך כאורח מקומי — בלי שמירה אחרי F5. אחרי מילוי URL + anon
              ב־<code className="text-ink">.env.local</code> הפעילו מחדש את
              השרת.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading || !configured || guestLoading}
          className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 py-3.5 text-base font-medium text-panel transition hover:bg-ink-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          <GoogleIcon />
          {!configured
            ? "התחברות Google מושבתת — חסרים מפתחות"
            : loading
              ? "פותחים Google..."
              : "המשך עם Google"}
        </button>

        {!configured && (
          <button
            type="button"
            onClick={continueAsGuest}
            disabled={guestLoading}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-panel px-5 py-3.5 text-base font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {guestLoading ? "נכנסת כאורח..." : "המשך כאורח"}
          </button>
        )}

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** Soften raw network/DNS dumps into actionable Hebrew. */
function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("err_name_not_resolved") ||
    lower.includes("name_not_resolved") ||
    lower.includes("could not reach") ||
    lower.includes("can't connect to server") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("getaddrinfo") ||
    lower.includes("enotfound") ||
    /\(-105\)/.test(raw)
  ) {
    return "לא מצליחים להגיע לפרויקט Supabase (כתובת לא נפתרת ב־DNS). בדקו ב־Dashboard → Settings → API שה־Project URL מדויק, עדכנו .env.local, והפעילו מחדש את השרת.";
  }
  if (raw.includes("Missing NEXT_PUBLIC_SUPABASE")) {
    return "חסרים מפתחות Supabase ב־.env.local — הדביקו Project URL + anon key מה־Dashboard והפעילו מחדש.";
  }
  return raw;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.1 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
