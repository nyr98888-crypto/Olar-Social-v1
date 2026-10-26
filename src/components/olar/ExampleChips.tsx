"use client";

import { C } from "@/lib/olar/ui-copy";

const CHIPS = [
  { id: "clinic", label: C.chipClinicLabel, text: C.chipClinicText },
  { id: "food", label: C.chipFoodLabel, text: C.chipFoodText },
  { id: "services", label: C.chipServicesLabel, text: C.chipServicesText },
  { id: "shop", label: C.chipShopLabel, text: C.chipShopText },
  { id: "fitness", label: C.chipFitnessLabel, text: C.chipFitnessText },
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
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
