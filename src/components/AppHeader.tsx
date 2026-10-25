"use client";

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
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-panel/95 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="shrink-0">
          <h1
            className="text-xl leading-none text-ink sm:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            יונה
          </h1>
          <p className="mt-0.5 hidden text-xs text-ink-soft sm:block">
            סוכנת סושיאל
          </p>
        </div>
        {guestMode && (
          <div
            className="max-w-[9.5rem] truncate rounded-lg border border-line bg-paper-deep/50 px-2 py-1 text-[10px] text-ink-soft sm:max-w-none sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-xs"
            role="status"
            title="מצב אורח — בלי שמירה אחרי F5"
          >
            <span className="sm:hidden">אורח</span>
            <span className="hidden sm:inline">מצב אורח — בלי שמירה אחרי F5</span>
          </div>
        )}
        <div
          className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10px] sm:gap-2 sm:px-3 sm:text-xs"
          title={CONNECTION_LABEL[connection]}
        >
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              connection === "online"
                ? "bg-accent status-dot"
                : connection === "checking"
                  ? "bg-ink-soft/40"
                  : "bg-danger"
            }`}
            aria-hidden
          />
          <span className="text-ink-soft sm:hidden">
            {CONNECTION_SHORT[connection]}
          </span>
          <span className="hidden text-ink-soft sm:inline">
            {CONNECTION_LABEL[connection]}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onResetSession}
          disabled={resetting}
          className="min-h-10 rounded-xl border border-line px-2.5 py-2 text-[10px] text-ink-soft transition hover:border-accent hover:text-accent disabled:opacity-50 sm:px-3 sm:text-xs"
          title="מוחקת שיחות ומתחילה כמו משתמשת חדשה (נשארת מחוברת)"
        >
          <span className="sm:hidden">{resetting ? "..." : "איפוס"}</span>
          <span className="hidden sm:inline">
            {resetting ? "מאפסת..." : "Test New User (Reset Session)"}
          </span>
        </button>

        <div className="flex items-center gap-2 border-r border-line pr-2 sm:pr-3">
          <div className="hidden text-left text-xs text-ink-soft sm:block">
            <div className="max-w-[120px] truncate font-medium text-ink md:max-w-[140px]">
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
              className="h-8 w-8 rounded-full object-cover ring-2 ring-accent-soft sm:h-9 sm:w-9"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent sm:h-9 sm:w-9">
              {(user.name || user.email || "?").slice(0, 1)}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-10 rounded-xl border border-line px-2.5 py-2 text-[10px] text-ink-soft transition hover:border-ink hover:text-ink sm:px-3 sm:py-1.5 sm:text-xs"
        >
          יציאה
        </button>
      </div>
    </header>
  );
}
