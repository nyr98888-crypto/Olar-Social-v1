"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/olar/ui-copy";

/**
 * Rotating optimistic Hebrew progress while AI calls / retries run.
 * 0–3s → progress1 | 4–7s → progress2 | 8s+ → progress3
 */
export const AI_PROGRESS_INTERVALS_MS = [0, 3000, 7000] as const;

export function getAiProgressMessages(): [string, string, string] {
  const copy = C as Record<string, string>;
  return [
    copy.aiProgress1 ||
      "חושבת על זווית טובה לפוסט הזה...",
    copy.aiProgress2 ||
      "מנסחת לנו את הפוסט...",
    copy.aiProgress3 ||
      "כמעט מוכן! עוד רגע תראו את התוצאה...",
  ];
}

export function useAiProgressMessages(active: boolean): {
  message: string;
  step: 0 | 1 | 2;
} {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const messages = getAiProgressMessages();

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    setStep(0);
    const t1 = window.setTimeout(() => setStep(1), 3000);
    const t2 = window.setTimeout(() => setStep(2), 7000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active]);

  return {
    message: messages[step],
    step,
  };
}
