"use client";

import { useEffect, useState } from "react";

export type DailyFreq = "once" | "twice" | "realtime";

const STORAGE_KEY = "olar-daily-update-freq";
const DEFAULT_FREQ: DailyFreq = "once";

export function readDailyFreq(): DailyFreq {
  if (typeof window === "undefined") return DEFAULT_FREQ;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "once" || v === "twice" || v === "realtime") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_FREQ;
}

export function writeDailyFreq(freq: DailyFreq): void {
  try {
    localStorage.setItem(STORAGE_KEY, freq);
  } catch {
    /* ignore */
  }
}

export function useDailyUpdateFreq() {
  const [freq, setFreqState] = useState<DailyFreq>(DEFAULT_FREQ);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFreqState(readDailyFreq());
    setReady(true);
  }, []);

  function setFreq(next: DailyFreq) {
    setFreqState(next);
    writeDailyFreq(next);
  }

  return { freq, setFreq, ready };
}
