"use client";

import { useEffect, useState } from "react";
import { storageGet, storageSet } from "./client-storage";

export type WorkMode = "quick" | "full";

const DEFAULT_MODE: WorkMode = "quick";

export function readStoredWorkMode(): WorkMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = storageGet("work-mode");
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
    storageSet("work-mode", workMode);
  }, [workMode, ready]);

  function setWorkMode(next: WorkMode) {
    setWorkModeState(next);
  }

  return { workMode, setWorkMode, ready };
}
