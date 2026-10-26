"use client";

import type { OlarView } from "@/lib/olar/types";
import { TICKER_ITEMS } from "@/lib/olar/mock-data";
import { resolveTickerNav } from "@/lib/olar/ticker-nav";
import { C } from "@/lib/olar/ui-copy";
import { Megaphone } from "lucide-react";

export function TopTicker({
  onNavigate,
}: {
  onNavigate?: (v: OlarView) => void;
}) {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  function handleClick(item: (typeof TICKER_ITEMS)[number]) {
    const dest = resolveTickerNav(item);
    if (dest && onNavigate) onNavigate(dest);
  }

  return (
    <div
      className="relative flex h-11 w-full shrink-0 items-center gap-2 overflow-hidden border-b border-slate-800 bg-slate-900 text-white"
      role="status"
      aria-label={C.tickerLive}
    >
      <div className="z-10 flex h-full shrink-0 items-center gap-1.5 bg-slate-900 px-4">
        <Megaphone className="h-4 w-4 text-sky-100" aria-hidden />
        <span className="text-sm font-semibold tracking-wide text-sky-100">
          {C.tickerLive}
        </span>
      </div>
      <div className="ticker-track flex min-w-max items-center gap-8 whitespace-nowrap pe-8 text-base">
        {doubled.map((item, i) => {
          const dest = resolveTickerNav(item);
          const clickable = Boolean(dest && onNavigate);
          return (
            <button
              key={`${item.id}-${i}`}
              type="button"
              disabled={!clickable}
              onClick={() => handleClick(item)}
              className={`inline-flex items-center gap-2 bg-transparent text-inherit ${
                clickable
                  ? "cursor-pointer hover:underline"
                  : "cursor-default"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  item.tone === "warn"
                    ? "bg-amber-400"
                    : item.tone === "good"
                      ? "bg-emerald-400"
                      : "bg-sky-200"
                }`}
              />
              {item.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
