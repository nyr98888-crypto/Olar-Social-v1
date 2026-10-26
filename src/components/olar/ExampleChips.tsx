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
  nails_beauty: C.nicheNailsTemplate,
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
  events_photo: C.nicheEventsTemplate,
  pets: C.nichePetsTemplate,
  cleaning_moving: C.nicheCleaningTemplate,
  courses_workshops: C.nicheCoursesTemplate,
  fashion_jewelry: C.nicheFashionTemplate,
  custom: C.nicheCustomTemplate,
};

const CHIPS: { id: BusinessCategoryId; label: string; template: string }[] =
  BUSINESS_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.labelHe,
    template: TEMPLATES[c.id],
  }));

type Props = {
  /** Pass id=null when the same chip is toggled off. */
  onSelect: (text: string, id?: BusinessCategoryId | null) => void;
  selectedId?: BusinessCategoryId | null;
  disabled?: boolean;
};

export function ExampleChips({ onSelect, selectedId, disabled }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-1.5 text-center" dir="rtl">
      <p className="text-xs font-medium text-slate-500">
        {C.landChipsHeading || C.tryExampleLabel}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {CHIPS.map((chip) => {
          const active = selectedId === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (active) {
                  onSelect("", null);
                } else {
                  onSelect(chip.template, chip.id);
                }
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-all disabled:pointer-events-none disabled:opacity-40 ${
                active
                  ? "border-cyan-500 bg-cyan-50/70 font-bold text-cyan-950 ring-1 ring-cyan-500/20"
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
