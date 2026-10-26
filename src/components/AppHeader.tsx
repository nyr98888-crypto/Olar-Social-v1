"use client";

import Image from "next/image";
import Link from "next/link";

export type ConnectionState = "checking" | "online" | "offline";

interface UserInfo {
  email?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
}

interface AppHeaderProps {
  user: UserInfo;
  connection: ConnectionState;
  resetting: boolean;
  guestMode?: boolean;
  onResetSession: () => void;
  onLogout: () => void;
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  checking: "בודקת חיבור...",
  online: "מחוברת",
  offline: "אין חיבור",
};

const CONNECTION_SHORT: Record<ConnectionState, string> = {
  checking: "...",
  online: "מחוברת",
  offline: "אופליין",
};

export function AppHeader({
  user,
  connection,
  resetting,
  guestMode = false,
  onResetSession,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="relative flex shrink-0 items-center justify-between gap-2 bg-[#0B0F19] px-3 py-2.5 text-white sm:gap-3 sm:px-4 sm:py-3 md:px-6">
      {/* Brand gradient bottom border */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500" aria-hidden="true" />

      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center px-1 py-1.5"
          aria-label="One Loop Social — בית"
        >
          <Image
            src="/one-loop-logo.png?v=2"
            alt="One Loop Social"
            width={215}
            height={120}
            priority
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>
        {guestMode && (
          <div
            className="max-w-[9.5rem] truncate rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/70 sm:max-w-none sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-xs"
            role="status"
            title="מצב אורח — בלי שמירה אחרי F5"
          >
            <span className="sm:hidden">אורח</span>
            <span className="hidden sm:inline">מצב אורח — בלי שמירה אחרי F5</span>
          </div>
        )}
        <div
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-2 py-1 text-[10px] sm:gap-2 sm:px-3 sm:text-xs"
          title={CONNECTION_LABEL[connection]}
        >
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              connection === "online"
                ? "bg-emerald-400 status-dot"
                : connection === "checking"
                  ? "bg-white/40"
                  : "bg-red-400"
            }`}
            aria-hidden
          />
          <span className="text-white/70 sm:hidden">
            {CONNECTION_SHORT[connection]}
          </span>
          <span className="hidden text-white/70 sm:inline">
            {CONNECTION_LABEL[connection]}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onResetSession}
          disabled={resetting}
          className="min-h-10 rounded-xl border border-white/15 px-2.5 py-2 text-[10px] text-white/70 transition hover:border-cyan-400/50 hover:text-cyan-300 disabled:opacity-50 sm:px-3 sm:text-xs"
          title="מוחקת שיחות ומתחילה כמו משתמשת חדשה (נשארת מחוברת)"
        >
          <span className="sm:hidden">{resetting ? "..." : "איפוס"}</span>
          <span className="hidden sm:inline">
            {resetting ? "מאפסת..." : "Test New User (Reset Session)"}
          </span>
        </button>

        <div className="flex items-center gap-2 border-r border-white/15 pr-2 sm:pr-3">
          <div className="hidden text-left text-xs text-white/70 sm:block">
            <div className="max-w-[120px] truncate font-medium text-white md:max-w-[140px]">
              {user.name || user.email}
            </div>
            {user.email && user.name && (
              <div className="hidden max-w-[140px] truncate md:block">
                {user.email}
              </div>
            )}
          </div>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-2 ring-cyan-400/40 sm:h-9 sm:w-9"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white sm:h-9 sm:w-9">
              {(user.name || user.email || "?").slice(0, 1)}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-10 rounded-xl border border-white/15 px-2.5 py-2 text-[10px] text-white/70 transition hover:border-white/30 hover:text-white sm:px-3 sm:py-1.5 sm:text-xs"
        >
          יציאה
        </button>
      </div>
    </header>
  );
}
