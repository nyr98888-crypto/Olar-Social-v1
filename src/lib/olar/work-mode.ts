"use client";

import { useEffect, useState } from "react";

export type WorkMode = "quick" | "full";

const STORAGE_KEY = "olar-work-mode";
const DEFAULT_MODE: WorkMode = "quick";

export function readStoredWorkMode(): WorkMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "quick" || v === "full") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODE;
}

export function useWorkMode() {
  const [workMode, setWorkModeState] = useState<WorkMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWorkModeState(readStoredWorkMode());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, workMode);
    } catch {
      /* ignore */
    }
  }, [workMode, ready]);

  function setWorkMode(next: WorkMode) {
    setWorkModeState(next);
  }

  return { workMode, setWorkMode, ready };
}
