"use client";

import type { WingmanGreetingChip } from "@/lib/olar/wingman-greeting";

export function WingmanGreetingCard({
  replyMessage,
  chips,
  onChipClick,
  className = "",
}: {
  replyMessage: string;
  chips: WingmanGreetingChip[];
  onChipClick?: (chip: WingmanGreetingChip) => void;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-white p-5 text-right shadow-sm ${className}`}
      dir="rtl"
      aria-label="ברכת מאיה"
    >
      <p className="text-xs font-semibold text-cyan-700">מאיה · השותפה שלך</p>
      <div className="mt-3 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-base leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-100">
        {replyMessage}
      </div>
      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipClick?.(chip)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
