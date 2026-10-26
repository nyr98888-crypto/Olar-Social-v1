"use client";

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
