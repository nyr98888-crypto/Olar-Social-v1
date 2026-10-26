"use client";

import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { Star } from "lucide-react";

export function ReviewsView({
  onNavigate,
}: {
  onNavigate?: (view: OlarView) => void;
}) {
  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="text-right">
        <h1
          className="text-3xl font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.reviewsTitle}
        </h1>
        <p className="mt-1 text-lg text-slate-800">{C.reviewsSub}</p>
      </header>

      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-100 text-cyan-600">
          <Star className="h-8 w-8" />
        </span>
        <p className="text-lg leading-relaxed text-slate-800">
          {C.emptyReviews}
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.("settings")}
          className="min-h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 text-lg font-bold text-white shadow-sm transition hover:from-cyan-600 hover:to-blue-700 hover:shadow-md"
        >
          {C.emptyReviewsCta}
        </button>
      </div>
    </div>
  );
}
