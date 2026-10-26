"use client";

import { useMemo, useState } from "react";
import {
  ANALYTICS_NETWORKS,
  CAMPAIGNS,
  NETWORK_COMPARE,
} from "@/lib/olar/mock-data";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import type { IntegrationId } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph, BRAND } from "../NetworkBrand";

export function AnalyticsView() {
  const { page } = useResolvedMyPage();
  const [network, setNetwork] = useState<IntegrationId | "all">("all");

  const filtered = useMemo(
    () =>
      network === "all"
        ? CAMPAIGNS
        : CAMPAIGNS.filter((c) => c.networkId === network),
    [network]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => ({
        reach: acc.reach + c.reach,
        calls: acc.calls + c.calls,
        wa: acc.wa + c.waClicks,
        maps: acc.maps + c.maps,
        used: acc.used + c.postsUsed,
        pot: acc.pot + c.postsPotential,
      }),
      { reach: 0, calls: 0, wa: 0, maps: 0, used: 0, pot: 0 }
    );
  }, [filtered]);

  const compare =
    network === "all"
      ? NETWORK_COMPARE[0]
      : NETWORK_COMPARE.find((n) => n.networkId === network) ??
        NETWORK_COMPARE[0];

  const utilPct =
    totals.pot > 0 ? Math.round((totals.used / totals.pot) * 100) : 0;

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

      <div className="flex w-full flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setNetwork("all")}
          className={`min-h-12 rounded-xl px-5 text-base font-medium ${
            network === "all"
              ? "bg-accent text-white shadow-md shadow-sky-600/20"
              : "olar-card text-slate-950 hover:border-accent"
          }`}
        >
          {C.all}
        </button>
        {ANALYTICS_NETWORKS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setNetwork(id)}
            className={`flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-medium ${
              network === id
                ? "bg-accent text-white shadow-md shadow-sky-600/20"
                : "olar-card text-slate-950 hover:border-accent"
            }`}
          >
            <BrandGlyph id={id} size={18} />
            {id === "easy" ? C.easy : BRAND[id].label}
          </button>
        ))}
      </div>

      <section className="olar-card w-full p-5 shadow-md">
        <h2 className="mb-4 text-xl font-bold text-slate-950">
          {C.simpleSummary}
        </h2>
        <div className="grid w-full gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: C.howManySaw, value: totals.reach.toLocaleString("he-IL") },
            { label: C.howManyCalled, value: String(totals.calls) },
            { label: C.howManyWa, value: String(totals.wa) },
            { label: C.howManyMaps, value: String(totals.maps) },
            {
              label: C.pageVisitsWeek,
              value: page.weekVisits.toLocaleString("he-IL"),
            },
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

      <section className="olar-card w-full p-5 shadow-md">
        <h2 className="text-xl font-bold text-slate-950">{C.utilLabel}</h2>
        <p className="mt-2 text-base text-slate-800">
          {totals.used} {C.postsOutOf} {totals.pot} {C.couldPost}
        </p>
        <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${utilPct}%` }}
          />
        </div>
        <p className="mt-2 text-lg font-bold text-slate-950">{utilPct}%</p>
      </section>

      <section className="grid w-full gap-6 md:grid-cols-2">
        <div className="olar-card p-5 shadow-md">
          <h3 className="text-lg font-bold text-accent">{C.strongPost}</h3>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {compare.strongest.title}
          </p>
          <p className="mt-2 text-base text-slate-800">
            {C.saw} {compare.strongest.reach.toLocaleString("he-IL")} � {C.reacted}{" "}
            {compare.strongest.engagement}
          </p>
        </div>
        <div className="olar-card p-5 shadow-md">
          <h3 className="text-lg font-bold text-danger">{C.weakPost}</h3>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {compare.weakest.title}
          </p>
          <p className="mt-2 text-base text-slate-800">
            {C.saw} {compare.weakest.reach.toLocaleString("he-IL")} � {C.reacted}{" "}
            {compare.weakest.engagement}
          </p>
        </div>
      </section>
    </div>
  );
}
