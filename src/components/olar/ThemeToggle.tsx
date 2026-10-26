"use client";

import type { OlarTheme } from "@/lib/olar/theme";
import { C } from "@/lib/olar/ui-copy";

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: OlarTheme;
  onChange: (t: OlarTheme) => void;
}) {
  return (
    <div
      className="theme-toggle inline-flex max-w-[min(100%,18rem)] shrink items-center gap-1 rounded-full border border-line bg-panel p-1 shadow-[var(--shadow)] sm:max-w-none"
      role="group"
      aria-label={C.themeToggleAria}
    >
      <button
        type="button"
        title={C.themeMinimal}
        onClick={() => onChange("minimal")}
        className={`min-h-11 rounded-full px-3 text-sm font-medium transition sm:px-4 sm:text-base ${
          theme === "minimal"
            ? "bg-accent font-bold text-white shadow-md shadow-sky-600/20"
            : "text-slate-800 hover:bg-accent-soft"
        }`}
        aria-pressed={theme === "minimal"}
      >
        <span className="hidden lg:inline">{C.themeMinimal}</span>
        <span className="lg:hidden">{C.themeMinimalShort}</span>
      </button>
      <button
        type="button"
        title={C.themePremium}
        onClick={() => onChange("premium")}
        className={`min-h-11 rounded-full px-3 text-sm font-medium transition sm:px-4 sm:text-base ${
          theme === "premium"
            ? "bg-accent font-bold text-white shadow-md shadow-sky-600/20"
            : "text-slate-800 hover:bg-accent-soft"
        }`}
        aria-pressed={theme === "premium"}
      >
        <span className="hidden lg:inline">{C.themePremium}</span>
        <span className="lg:hidden">{C.themePremiumShort}</span>
      </button>
    </div>
  );
}
