"use client";

import { useClientAuth } from "@/lib/olar/auth-client";
import { useCurrentPost } from "@/lib/olar/current-post";
import { C } from "@/lib/olar/ui-copy";
import { FooterBrand } from "@/components/olar/FooterBrand";
import { BarChart3 } from "lucide-react";

/**
 * Analytics — guests / no real data → zeros + empty state.
 * Never show mock CAMPAIGNS / 47 / 12 numbers.
 */
export function AnalyticsView() {
  const { isGuest, ready: authReady } = useClientAuth();
  const { post, ready: postReady } = useCurrentPost();
  const hasRealData = Boolean(
    !isGuest && post && (post.headline || post.body || post.image_url)
  );

  if (!authReady || !postReady) {
    return <div className="min-h-[40vh] w-full" />;
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="space-y-2 text-right">
        <h1
          className="text-3xl font-bold text-slate-950 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.whatWorked}
        </h1>
        <p className="text-lg text-slate-800">{C.whatWorkedSub}</p>
      </header>

      <section className="olar-card w-full p-5 shadow-md">
        <h2 className="mb-4 text-xl font-bold text-slate-950">
          {C.simpleSummary}
        </h2>
        <div className="grid w-full gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: C.howManySaw, value: "0" },
            { label: C.howManyCalled, value: "0" },
            { label: C.howManyWa, value: "0" },
            { label: C.howManyMaps, value: "0" },
            { label: C.pageVisitsWeek || C.quickPulseVisits, value: "0" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-right"
            >
              <p className="text-base text-slate-800">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!hasRealData ? (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <BarChart3 className="h-10 w-10 text-slate-400" />
          <p className="text-lg leading-relaxed text-slate-800">
            {C.emptyDashboardStats}
          </p>
        </div>
      ) : null}

      <FooterBrand />
    </div>
  );
}
