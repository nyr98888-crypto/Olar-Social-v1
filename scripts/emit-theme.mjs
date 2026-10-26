import fs from "fs";

const themeTs = `"use client";

import { useEffect, useState } from "react";

export type OlarTheme = "minimal" | "premium";

const STORAGE_KEY = "olar-theme-style";
const DEFAULT_THEME: OlarTheme = "minimal";

export function readStoredTheme(): OlarTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "minimal" || v === "premium") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function useOlarTheme() {
  const [theme, setThemeState] = useState<OlarTheme>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, ready]);

  function setTheme(next: OlarTheme) {
    setThemeState(next);
  }

  function toggle() {
    setThemeState((t) => (t === "minimal" ? "premium" : "minimal"));
  }

  return { theme, setTheme, toggle, ready };
}
`;

const toggleTsx = `"use client";

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
      className="theme-toggle inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-panel p-1 shadow-[var(--shadow)]"
      role="group"
      aria-label={C.themeToggleAria}
    >
      <button
        type="button"
        onClick={() => onChange("minimal")}
        className={\`min-h-11 rounded-full px-3 text-sm font-medium transition sm:px-4 sm:text-base \${
          theme === "minimal"
            ? "bg-accent text-white"
            : "text-slate-800 hover:bg-paper-deep/60"
        }\`}
        aria-pressed={theme === "minimal"}
      >
        <span className="hidden sm:inline">{C.themeMinimal}</span>
        <span className="sm:hidden">A</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("premium")}
        className={\`min-h-11 rounded-full px-3 text-sm font-medium transition sm:px-4 sm:text-base \${
          theme === "premium"
            ? "bg-accent text-white"
            : "text-slate-800 hover:bg-paper-deep/60"
        }\`}
        aria-pressed={theme === "premium"}
      >
        <span className="hidden sm:inline">{C.themePremium}</span>
        <span className="sm:hidden">B</span>
      </button>
    </div>
  );
}
`;

fs.writeFileSync("src/lib/olar/theme.ts", themeTs, "utf8");
fs.writeFileSync("src/components/olar/ThemeToggle.tsx", toggleTsx, "utf8");
console.log("theme modules OK");
