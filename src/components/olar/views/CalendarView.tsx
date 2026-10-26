"use client";

import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/olar/types";
import { CALENDAR_EVENTS, WEEK_DAYS } from "@/lib/olar/mock-data";
import { C } from "@/lib/olar/ui-copy";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type CalMode = "week" | "month";

const TYPE_STYLE = {
  post: { labelKey: "postTag" as const, className: "bg-emerald-600 text-white" },
  holiday: {
    labelKey: "holidayTag" as const,
    className: "bg-red-600 text-white",
  },
  reminder: {
    labelKey: "reminderTag" as const,
    className: "bg-amber-400 text-slate-900",
  },
};

function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function CalendarView() {
  const [mode, setMode] = useState<CalMode>("month");
  const [cursor, setCursor] = useState(() => new Date(2026, 9, 26));
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of CALENDAR_EVENTS) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, []);

  const cells = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor, mode]);

  function shift(dir: -1 | 1) {
    const next = new Date(cursor);
    if (mode === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setCursor(next);
  }

  function openDayPosts(key: string) {
    const events = (byDate.get(key) ?? []).filter((e) => e.type === "post");
    if (events.length === 0) return;
    setModalEvent(events[0] ?? null);
  }

  const title = cursor.toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-right">
          <h1
            className="text-3xl font-semibold text-slate-950"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {C.calendarTitle}
          </h1>
          <p className="mt-1 text-lg text-slate-800">{C.calendarLegend}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: "week" as const, label: C.weekly },
                { id: "month" as const, label: C.monthly },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`min-h-12 rounded-lg px-4 text-base font-medium ${
                  mode === m.id
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white"
            aria-label={C.next}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="min-w-[8rem] text-center text-base font-semibold text-slate-950">
            {title}
          </span>
          <button
            type="button"
            onClick={() => shift(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white"
            aria-label={C.prev}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="w-full overflow-hidden rounded-2xl border border-line bg-white p-2 sm:p-3">
        <div className="mb-2 grid grid-cols-7 gap-2">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-3 text-center text-base font-bold text-slate-950"
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className={`grid grid-cols-7 gap-2 ${
            mode === "week"
              ? "auto-rows-[minmax(7.5rem,1fr)]"
              : "auto-rows-[minmax(6rem,1fr)]"
          }`}
        >
          {cells.map((d) => {
            const key = toKey(d);
            const events = byDate.get(key) ?? [];
            const posts = events.filter((e) => e.type === "post");
            const inMonth = d.getMonth() === cursor.getMonth();
            const hasGap = events.length === 0 && inMonth;
            const clickable = posts.length > 0;
            return (
              <button
                key={key + mode}
                type="button"
                disabled={!clickable}
                onClick={() => openDayPosts(key)}
                className={`min-h-[6rem] rounded-xl border border-slate-200 p-2.5 text-right transition ${
                  clickable
                    ? "cursor-pointer hover:border-accent hover:bg-accent-soft/60"
                    : "cursor-default"
                } ${
                  !inMonth && mode === "month"
                    ? "bg-slate-50/80 opacity-50"
                    : hasGap
                      ? "bg-amber-50"
                      : posts.length
                        ? "bg-emerald-50/40"
                        : "bg-white"
                }`}
              >
                <span className="text-base font-bold text-slate-950">
                  {d.getDate()}
                </span>
                <div className="mt-1.5 flex flex-col gap-1">
                  {events.slice(0, mode === "week" ? 4 : 2).map((e) => (
                    <span
                      key={e.id}
                      className={`truncate rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_STYLE[e.type].className}`}
                    >
                      {e.title}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {modalEvent && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={C.calPostModalTitle}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-accent">
                  {C.calPostModalTitle}
                </p>
                <h2
                  className="mt-1 text-2xl font-bold text-slate-950"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {modalEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalEvent(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-right">
              {modalEvent.network && (
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold text-slate-500">
                    {C.calTargetNetwork}
                  </dt>
                  <dd className="mt-1 text-base font-bold text-slate-950">
                    {modalEvent.network}
                  </dd>
                </div>
              )}
              {modalEvent.publishTime && (
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold text-slate-500">
                    {C.calPublishTime}
                  </dt>
                  <dd className="mt-1 text-base font-bold text-slate-950" dir="ltr">
                    {modalEvent.publishTime}
                  </dd>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold text-slate-500">
                  {C.calPostContent}
                </dt>
                <dd className="mt-1 whitespace-pre-line text-base leading-relaxed text-slate-800">
                  {modalEvent.body ||
                    modalEvent.suggestion ||
                    C.calNoPostDay}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setModalEvent(null)}
              className="olar-cta mt-6 flex min-h-12 w-full items-center justify-center rounded-full text-base font-bold"
            >
              {C.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
