"use client";

import {
  POST_TYPES,
  type PostTypeId,
} from "@/lib/olar/post-types";

/** 4 content-pillar tabs above studio / landing textarea */
export function ContentPillarTabs({
  value,
  onChange,
  disabled,
}: {
  value: PostTypeId;
  onChange: (id: PostTypeId) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="tablist"
      aria-label="סוג תוכן"
    >
      {POST_TYPES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-sm font-semibold transition ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-300 bg-white text-slate-800 hover:border-cyan-400 hover:bg-cyan-50/50"
            } disabled:opacity-50`}
          >
            {p.labelHe}
          </button>
        );
      })}
    </div>
  );
}
