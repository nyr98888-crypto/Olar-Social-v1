"use client";

import { useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import {
  CONTENT_IDEAS,
  DASHBOARD_STATS,
  OWNER_NAME,
  QUICK_ACTIONS,
  WEEK_DAYS,
  WEEKLY_ACTIVITY,
} from "@/lib/olar/mock-data";
import { stashYonaIdea } from "@/lib/olar/yona-idea";
import { C } from "@/lib/olar/ui-copy";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: OlarView) => void;
}) {
  const max = Math.max(...WEEKLY_ACTIVITY, 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function openIdea(idea: (typeof CONTENT_IDEAS)[number]) {
    setSelectedId(idea.id);
    stashYonaIdea({
      id: idea.id,
      title: idea.title,
      blurb: idea.blurb,
      headline: idea.headline,
      body: idea.body,
    });
    onNavigate("yona");
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="space-y-2 text-right">
        <p className="text-base font-medium text-accent">{C.homeTitle}</p>
        <h1
          className="text-3xl font-bold leading-tight text-slate-950 sm:text-4xl lg:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.helloWhat} {OWNER_NAME}, {C.whatToday}
        </h1>
        <p className="w-full text-lg leading-relaxed text-slate-800">
          {C.pickSimple}
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.view)}
            className="olar-card flex min-h-16 cursor-pointer items-center justify-between px-5 text-right shadow-md transition hover:border-accent hover:shadow-lg active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-lg font-medium text-slate-950">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              {action.label}
            </span>
            <ArrowLeft className="h-5 w-5 text-slate-800" aria-hidden />
          </button>
        ))}
      </div>

      <section className="w-full space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate("yona")}
            className="min-h-12 text-base font-medium text-accent hover:underline"
          >
            {C.allIdeasYona}
          </button>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            {C.nothingToPost}
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </h2>
        </div>
        <div className="grid w-full gap-6 md:grid-cols-3">
          {CONTENT_IDEAS.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => openIdea(idea)}
              className={`olar-card cursor-pointer p-5 text-right shadow-md transition hover:border-accent hover:shadow-lg active:scale-[0.99] ${
                selectedId === idea.id
                  ? "ring-2 ring-sky-600 bg-sky-50"
                  : ""
              }`}
            >
              <p className="text-lg font-bold text-slate-950">{idea.title}</p>
              <p className="mt-2 text-base leading-relaxed text-slate-800">
                {idea.blurb}
              </p>
              <p className="mt-3 text-base font-medium text-accent">
                {C.clickYonaPost}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid w-full gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_STATS.map((stat) => (
          <div key={stat.label} className="olar-card p-5 text-right shadow-md">
            <p className="text-base text-slate-800">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{stat.value}</p>
            <p
              className={`mt-1 text-base font-medium ${
                stat.good ? "text-accent" : "text-danger"
              }`}
            >
              {stat.delta}
            </p>
          </div>
        ))}
      </section>

      <section className="olar-card w-full p-5 shadow-md">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="min-h-12 text-base font-medium text-accent hover:underline"
          >
            {C.whenWePublish}
          </button>
          <h2 className="text-xl font-bold text-slate-950">{C.postsThisWeek}</h2>
        </div>
        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {WEEKLY_ACTIVITY.map((n, i) => (
            <div key={WEEK_DAYS[i]} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-accent/80"
                style={{ height: `${Math.max((n / max) * 100, n ? 12 : 4)}%` }}
                title={String(n)}
              />
              <span className="text-base font-medium text-slate-950">
                {WEEK_DAYS[i]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-base leading-relaxed text-slate-800">
          {C.fiveDaysHint}
        </p>
      </section>
    </div>
  );
}
