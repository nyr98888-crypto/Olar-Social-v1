"use client";

import { C } from "@/lib/olar/ui-copy";

const CHIPS = [
  { id: "garage", label: C.chipGarageLabel, text: C.chipGarageText },
  { id: "beauty", label: C.chipBeautyLabel, text: C.chipBeautyText },
  { id: "food", label: C.chipFoodLabel, text: C.chipFoodText },
] as const;

type Props = {
  onSelect: (text: string) => void;
  disabled?: boolean;
};

export function ExampleChips({ onSelect, disabled }: Props) {
  return (
    <div className="space-y-2 text-right" dir="rtl">
      <p className="text-xs font-medium text-slate-500">{C.tryExampleLabel}</p>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(chip.text)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-sky-300 hover:bg-sky-50 disabled:pointer-events-none disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
