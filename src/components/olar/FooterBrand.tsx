"use client";

import { C } from "@/lib/olar/ui-copy";

/** Clean brand footer — shared across dashboard, studio, settings, home. */
export function FooterBrand() {
  return (
    <footer className="mt-auto flex w-full flex-col items-center justify-center gap-1 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="One Loop Social"
        className="block h-10 w-auto object-contain drop-shadow-sm md:h-12"
      />
      <p className="text-xs font-semibold tracking-wide text-slate-500">
        {C.footerTagline || "המערכת האוטומטית שלך לפרסום בעסק"}
      </p>
    </footer>
  );
}
