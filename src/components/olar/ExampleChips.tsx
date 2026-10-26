"use client";

import { C } from "@/lib/olar/ui-copy";

export type NicheChipId =
  | "interior"
  | "clinic"
  | "restaurant"
  | "salon"
  | "legal"
  | "fitness"
  | "renovation"
  | "garage"
  | "shop"
  | "bakery"
  | "real_estate"
  | "wellness";

const CHIPS: { id: NicheChipId; label: string; template: string }[] = [
  {
    id: "interior",
    label: C.nicheInteriorLabel,
    template: C.nicheInteriorTemplate,
  },
  {
    id: "clinic",
    label: C.nicheClinicLabel,
    template: C.nicheClinicTemplate,
  },
  {
    id: "restaurant",
    label: C.nicheRestaurantLabel,
    template: C.nicheRestaurantTemplate,
  },
  {
    id: "salon",
    label: C.nicheSalonLabel,
    template: C.nicheSalonTemplate,
  },
  {
    id: "legal",
    label: C.nicheLegalLabel,
    template: C.nicheLegalTemplate,
  },
  {
    id: "fitness",
    label: C.nicheFitnessLabel,
    template: C.nicheFitnessTemplate,
  },
  {
    id: "renovation",
    label: C.nicheRenovationLabel,
    template: C.nicheRenovationTemplate,
  },
  {
    id: "garage",
    label: C.nicheGarageLabel,
    template: C.nicheGarageTemplate,
  },
  {
    id: "shop",
    label: C.nicheShopLabel,
    template: C.nicheShopTemplate,
  },
  {
    id: "bakery",
    label: C.nicheBakeryLabel,
    template: C.nicheBakeryTemplate,
  },
  {
    id: "real_estate",
    label: C.nicheRealEstateLabel,
    template: C.nicheRealEstateTemplate,
  },
  {
    id: "wellness",
    label: C.nicheWellnessLabel,
    template: C.nicheWellnessTemplate,
  },
];

type Props = {
  onSelect: (text: string, id?: NicheChipId) => void;
  selectedId?: NicheChipId | null;
  disabled?: boolean;
};

export function ExampleChips({ onSelect, selectedId, disabled }: Props) {
  return (
    <div className="w-full space-y-2 text-right" dir="rtl">
      <p className="text-xs font-medium text-slate-500">{C.tryExampleLabel}</p>
      <div className="-mx-1 flex flex-wrap justify-start gap-2 sm:mx-0">
        {CHIPS.map((chip) => {
          const active = selectedId === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(chip.template, chip.id)}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm transition-all disabled:pointer-events-none disabled:opacity-40 ${
                active
                  ? "border-cyan-500 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
