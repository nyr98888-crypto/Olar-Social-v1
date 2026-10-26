"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WINGMAN_CHIP_PREFILL_KEY,
  WINGMAN_GREETED_KEY,
  type WingmanGreetingChip,
} from "@/lib/olar/wingman-greeting";
import type { PostTypeId } from "@/lib/olar/post-types";
import { setStudioPostType, appendStudioMessage } from "@/lib/store";

export type WingmanGreetingState = {
  replyMessage: string | null;
  chips: WingmanGreetingChip[];
  loading: boolean;
  shown: boolean;
};

type PrefillPayload = {
  postType: PostTypeId;
  label: string;
  promptHint?: string;
};

/**
 * Fetch proactive Wingman greeting once per browser session (auth only).
 * Guests: no-op.
 */
export function useWingmanGreeting(opts: {
  enabled: boolean;
  /** When true, also append assistant bubble into studio store */
  appendToStudio?: boolean;
}) {
  const [replyMessage, setReplyMessage] = useState<string | null>(null);
  const [chips, setChips] = useState<WingmanGreetingChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!opts.enabled || started.current) return;
    if (typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem(WINGMAN_GREETED_KEY) === "1") {
        started.current = true;
        return;
      }
    } catch {
      /* ignore */
    }

    started.current = true;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/agent/greeting", {
          method: "GET",
          signal: AbortSignal.timeout(12_000),
        });
        if (res.status === 401) return;
        if (!res.ok) return;
        const data = (await res.json()) as {
          replyMessage?: string;
          chips?: WingmanGreetingChip[];
        };
        const msg = data.replyMessage?.trim();
        if (!msg) return;

        setReplyMessage(msg);
        setChips(Array.isArray(data.chips) ? data.chips : []);
        setShown(true);

        try {
          sessionStorage.setItem(WINGMAN_GREETED_KEY, "1");
        } catch {
          /* ignore */
        }

        if (opts.appendToStudio) {
          appendStudioMessage({ role: "assistant", content: msg });
        }
      } catch (err) {
        console.warn(
          "[wingman] greeting fetch failed",
          err instanceof Error ? err.message : err
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [opts.enabled, opts.appendToStudio]);

  const onChipClick = useCallback((chip: WingmanGreetingChip) => {
    setStudioPostType(chip.postType);
    const payload: PrefillPayload = {
      postType: chip.postType,
      label: chip.label,
      promptHint: chip.label.replace(/^[^\s]+\s/, ""), // strip emoji prefix loosely
    };
    try {
      sessionStorage.setItem(
        WINGMAN_CHIP_PREFILL_KEY,
        JSON.stringify(payload)
      );
    } catch {
      /* ignore */
    }
  }, []);

  return {
    replyMessage,
    chips,
    loading,
    shown,
    onChipClick,
  } satisfies WingmanGreetingState & {
    onChipClick: (chip: WingmanGreetingChip) => void;
  };
}

/** Read + clear chip prefill (Studio / CampaignGenerator). */
export function consumeWingmanChipPrefill(): PrefillPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(WINGMAN_CHIP_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(WINGMAN_CHIP_PREFILL_KEY);
    const parsed = JSON.parse(raw) as PrefillPayload;
    if (!parsed?.postType) return null;
    return parsed;
  } catch {
    return null;
  }
}
