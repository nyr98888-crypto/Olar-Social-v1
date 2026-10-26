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
    <div className="w-full space-y-1.5 text-right" dir="rtl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs font-medium text-slate-600 sm:text-sm">
          {C.landChipsHeading || C.tryExampleLabel}
        </p>
        <p className="text-[11px] font-medium text-slate-400 md:hidden">
          {C.landChipsSwipeHint}
        </p>
      </div>
      <div
        className="no-scrollbar flex snap-x snap-mandatory flex-nowrap gap-1.5 overflow-x-auto scroll-smooth pb-2 md:flex-wrap md:gap-2 md:overflow-visible md:pb-0 md:snap-none"
        role="list"
      >
        {CHIPS.map((chip) => {
          const active = selectedId === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => {
                if (active) {
                  onSelect("", null);
                } else {
                  onSelect(chip.template, chip.id);
                }
              }}
              className={`flex-shrink-0 snap-start whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs transition-all disabled:pointer-events-none disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-sm ${
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
