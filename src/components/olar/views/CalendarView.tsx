"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import {
  EVENT_TYPE_LABELS_HE,
  defaultEndTime,
  isoToLocalDate,
  isoToLocalTime,
  localDateTimeToIso,
  type CalendarEventRecord,
  type CalendarEventType,
} from "@/lib/olar/calendar-events";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  exportCalendarIcs,
  fetchCalendarEvents,
  openGoogleCalendar,
} from "@/lib/olar/calendar-client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00–20:00

type CalMode = "week" | "month";

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function kindClass(type: CalendarEventType) {
  if (type === "post") return "border-sky-200 bg-sky-50 text-sky-900";
  if (type === "meeting") return "border-violet-200 bg-violet-50 text-violet-900";
  if (type === "reminder") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function CalendarView({
  onNavigate,
}: {
  onNavigate?: (view: OlarView) => void;
}) {
  const [mode, setMode] = useState<CalMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: isoDate(new Date()),
    time: "10:00",
    event_type: "post" as CalendarEventType,
    reminder_minutes: 30,
  });

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date()), weekOffset * 7),
    [weekOffset]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const monthDays = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const start = startOfWeek(new Date(base.getFullYear(), base.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthOffset]);

  const monthFocus = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d.getMonth();
  }, [monthOffset]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const from = addDays(startOfWeek(new Date()), -14);
      const to = addDays(startOfWeek(new Date()), 120);
      const { events: list } = await fetchCalendarEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setEvents(list.filter((e) => e.status !== "cancelled"));
    } catch (err) {
      console.error("[CalendarView] refresh", err);
      setToast("לא הצלחתי לטעון את היומן");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    for (const ev of events) {
      const key = isoToLocalDate(ev.start_time);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  function openModalForSlot(date: string, time: string) {
    setForm((f) => ({ ...f, date, time, title: "", description: "" }));
    setModalOpen(true);
  }

  async function submitEvent() {
    if (!form.title.trim() || !form.date || !form.time) return;
    setSaving(true);
    setToast(null);
    try {
      const start_time = localDateTimeToIso(form.date, form.time);
      const created = await createCalendarEvent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_time,
        end_time: defaultEndTime(start_time),
        event_type: form.event_type,
        reminder_minutes: form.reminder_minutes,
      });
      if (!created) {
        setToast("שמירת האירוע נכשלה — נסו שוב");
        return;
      }
      setEvents((prev) =>
        [...prev, created].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        )
      );
      setModalOpen(false);
      setForm({
        title: "",
        description: "",
        date: isoDate(new Date()),
        time: "10:00",
        event_type: "post",
        reminder_minutes: 30,
      });
      setToast("האירוע נשמר ביומן");
    } catch {
      setToast("שמירת האירוע נכשלה — נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    const ok = await deleteCalendarEvent(id);
    if (ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  }

  async function handleExport() {
    if (events.length === 0) {
      setModalOpen(true);
      return;
    }
    await exportCalendarIcs(events);
    const last = events[events.length - 1];
    if (last) openGoogleCalendar(last);
    setToast("קובץ .ics הורד — ניתן לייבא ל-Apple / Google Calendar");
  }

  const rangeLabel =
    mode === "week"
      ? `${fmtDate(weekDays[0]!)} – ${fmtDate(weekDays[6]!)}`
      : monthDays[15]!.toLocaleDateString("he-IL", {
          month: "long",
          year: "numeric",
        });

  return (
    <div className="w-full animate-rise space-y-6" dir="rtl">
      <header className="flex flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold text-slate-950"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {C.calendarTitle}
          </h1>
          <p className="mt-1 text-lg text-slate-800">{C.calendarLegend}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-bold text-white shadow-md"
          >
            <Plus className="h-5 w-5" />
            {C.calendarAddEvent}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Smartphone className="h-4 w-4" />
            {C.calendarSyncPhone}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("week")}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
            mode === "week"
              ? "bg-accent text-white"
              : "border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {C.calendarWeekTab}
        </button>
        <button
          type="button"
          onClick={() => setMode("month")}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
            mode === "month"
              ? "bg-accent text-white"
              : "border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {C.calendarMonthTab}
        </button>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען יומן...
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            mode === "week"
              ? setWeekOffset((w) => w + 1)
              : setMonthOffset((m) => m + 1)
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          aria-label={C.next}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-cyan-600" />
          <span className="text-base font-semibold text-slate-900">
            {rangeLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            mode === "week"
              ? setWeekOffset((w) => w - 1)
              : setMonthOffset((m) => m - 1)
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          aria-label={C.prev}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {toast ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900">
          {toast}
        </p>
      ) : null}

      {mode === "week" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="grid min-w-[720px]"
            style={{
              gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))",
            }}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 p-2" />
            {weekDays.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={`hdr-${isoDate(day)}`}
                  className={`sticky top-0 z-10 border-b border-s border-slate-200 bg-slate-50 p-2 text-center ${
                    today ? "bg-cyan-50" : ""
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      today ? "text-cyan-700" : "text-slate-500"
                    }`}
                  >
                    {DAY_LABELS[day.getDay()]}
                  </div>
                  <div
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      today ? "bg-cyan-600 text-white" : "text-slate-800"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}

            {HOURS.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-b border-slate-100 bg-slate-50/80 px-1 py-2 text-center text-[11px] font-semibold text-slate-500">
                  {hourLabel(hour)}
                </div>
                {weekDays.map((day) => {
                  const key = isoDate(day);
                  const today = isToday(day);
                  const slotEvs = (byDate.get(key) || []).filter((ev) => {
                    const h = Number(isoToLocalTime(ev.start_time).slice(0, 2));
                    return h === hour;
                  });

                  return (
                    <button
                      key={`${key}-${hour}`}
                      type="button"
                      onClick={() => openModalForSlot(key, hourLabel(hour))}
                      className={`min-h-[52px] border-b border-s border-slate-100 p-1 text-right transition hover:bg-accent-soft/40 ${
                        today ? "bg-cyan-50/30" : "bg-white"
                      }`}
                    >
                      <div className="flex h-full flex-col gap-1 overflow-hidden">
                        {slotEvs.map((ev) => (
                          <div
                            key={ev.id}
                            className={`group relative rounded-lg border px-1.5 py-1 text-[10px] font-medium ${kindClass(ev.event_type)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openGoogleCalendar(ev);
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              <span className="line-clamp-1">{ev.title}</span>
                            </div>
                            <button
                              type="button"
                              className="absolute left-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-slate-500 group-hover:block"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeEvent(ev.id);
                              }}
                              aria-label="מחק"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid w-full grid-cols-7 gap-2">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-xs font-bold text-slate-500"
            >
              {label}
            </div>
          ))}
          {monthDays.map((day, i) => {
            const key = isoDate(day);
            const dayEvs = byDate.get(key) || [];
            const today = isToday(day);
            const inMonth = day.getMonth() === monthFocus;

            return (
              <button
                key={`${key}-${i}`}
                type="button"
                onClick={() => openModalForSlot(key, "10:00")}
                className={`flex min-h-[100px] flex-col rounded-2xl border p-2 text-right transition sm:min-h-[120px] sm:p-3 ${
                  today
                    ? "border-cyan-400 bg-cyan-50/40 shadow-sm"
                    : "border-slate-200 bg-white hover:border-accent"
                } ${!inMonth ? "opacity-40" : ""}`}
              >
                <span
                  className={`mb-1 inline-flex h-7 w-7 items-center justify-center self-end rounded-full text-xs font-semibold ${
                    today ? "bg-cyan-600 text-white" : "text-slate-700"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                  {dayEvs.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-medium ${kindClass(ev.event_type)}`}
                    >
                      <span className="line-clamp-1">
                        {isoToLocalTime(ev.start_time)} · {ev.title}
                      </span>
                    </div>
                  ))}
                  {dayEvs.length === 0 ? (
                    <span className="mt-auto flex items-center justify-center gap-1 text-[10px] text-slate-400">
                      <Plus className="h-3 w-3" />
                      הוסף
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {events.length === 0 && !loading ? (
        <div className="space-y-2 text-center">
          <p className="text-base text-slate-600">{C.emptyDashboardStats}</p>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("yona")}
              className="text-sm font-semibold text-accent underline"
            >
              + הוסף פוסט עם יונה
            </button>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xl font-bold text-slate-950">
                {C.calendarAddEvent}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                {C.calendarEventTitle}
                <input
                  dir="rtl"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder='למשל: "משלוח ג׳חנון למשפחת לוי"'
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {C.calendarEventType}
                <select
                  value={form.event_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      event_type: e.target.value as CalendarEventType,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-accent"
                >
                  {(
                    Object.keys(EVENT_TYPE_LABELS_HE) as CalendarEventType[]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {EVENT_TYPE_LABELS_HE[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-800">
                תיאור (אופציונלי)
                <textarea
                  dir="rtl"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-accent"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-800">
                  {C.appointmentDate}
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-800">
                  {C.appointmentTime}
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, time: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              disabled={saving || !form.title.trim()}
              onClick={() => void submitEvent()}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {C.appointmentSave}
            </button>
            {events.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const last = events[events.length - 1]!;
                  openGoogleCalendar(last);
                  void exportCalendarIcs([last]);
                }}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800"
              >
                <Smartphone className="h-4 w-4" />
                {C.calendarSyncPhone}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
