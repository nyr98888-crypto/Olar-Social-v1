"use client";

import { C } from "@/lib/olar/ui-copy";
import {
  BUSINESS_CATEGORIES,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";

/** @deprecated Prefer BusinessCategoryId — kept for compat. */
export type NicheChipId = BusinessCategoryId;
export type { BusinessCategoryId };

const TEMPLATES: Record<BusinessCategoryId, string> = {
  architecture: C.nicheInteriorTemplate,
  beauty: C.nicheClinicTemplate,
  food: C.nicheRestaurantTemplate,
  hair_salon: C.nicheSalonTemplate,
  legal_accounting: C.nicheLegalTemplate,
  fitness: C.nicheFitnessTemplate,
  renovation: C.nicheRenovationTemplate,
  automotive: C.nicheGarageTemplate,
  retail: C.nicheShopTemplate,
  bakery: C.nicheBakeryTemplate,
  real_estate: C.nicheRealEstateTemplate,
  wellness: C.nicheWellnessTemplate,
};

const CHIPS: { id: BusinessCategoryId; label: string; template: string }[] =
  BUSINESS_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.labelHe,
    template: TEMPLATES[c.id],
  }));

type Props = {
  onSelect: (text: string, id?: BusinessCategoryId) => void;
  selectedId?: BusinessCategoryId | null;
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
              className={`rounded-full border px-3.5 py-2 text-sm shadow-sm transition-all disabled:pointer-events-none disabled:opacity-40 ${
                active
                  ? "border-cyan-500 bg-cyan-50/70 text-cyan-950 font-bold ring-2 ring-cyan-500/20"
                  : "border-slate-200 bg-white font-medium text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
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
