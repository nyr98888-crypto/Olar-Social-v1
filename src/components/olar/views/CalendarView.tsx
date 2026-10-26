"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import {
  EVENT_TYPE_LABELS_HE,
  SERVICE_TYPE_OPTIONS,
  defaultEndTime,
  isoToLocalDate,
  isoToLocalTime,
  localDateTimeToIso,
  packCrmDescription,
  unpackCrmDescription,
  type CalendarEventRecord,
  type CalendarEventType,
} from "@/lib/olar/calendar-events";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  exportCalendarIcs,
  fetchCalendarEvents,
  openGoogleCalendar,
  updateCalendarEvent,
} from "@/lib/olar/calendar-client";
import {
  ONE_LOOP_SCHEDULED_POSTS_KEY,
  removeScheduledPost,
  useCampaignStore,
  type ScheduledPost,
} from "@/lib/store/campaign-store";
import { FooterBrand } from "@/components/olar/FooterBrand";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";

/** Convert a local scheduled post → calendar chip (from `one_loop_scheduled_posts`). */
function scheduledPostToEvent(p: ScheduledPost): CalendarEventRecord {
  const start = new Date(p.scheduledAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const title = `פוסט: ${(p.headline || "מתוזמן").slice(0, 80)}`;
  const description = [p.bodyText, p.imageUrl ? `תמונה: ${p.imageUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    id: p.id,
    title,
    description: description || null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    event_type: "post",
    status: "scheduled",
    reminder_minutes: 30,
    google_event_id: null,
    service_type: "פוסט מתוזמן",
  };
}

/** Direct localStorage read for `one_loop_scheduled_posts` (guest / F5 sync). */
function readScheduledPostsKey(): ScheduledPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("one_loop_scheduled_posts");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ScheduledPost =>
        Boolean(p) &&
        typeof p === "object" &&
        typeof (p as ScheduledPost).id === "string" &&
        typeof (p as ScheduledPost).scheduledAt === "string"
    );
  } catch {
    return [];
  }
}

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const MONTH_LABELS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);
const NOW_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => NOW_YEAR - 1 + i);

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

/** Visual tags: blue booking · green completed · purple scheduled post */
function eventChipClass(ev: CalendarEventRecord): string {
  if (ev.status === "completed") {
    return "border-emerald-400 bg-emerald-100 text-emerald-900";
  }
  if (ev.event_type === "post") {
    return "border-violet-400 bg-violet-100 text-violet-900";
  }
  return "border-sky-400 bg-sky-100 text-sky-900";
}

function eventDot(ev: CalendarEventRecord): string {
  if (ev.status === "completed") return "bg-emerald-500";
  if (ev.event_type === "post") return "bg-violet-500";
  return "bg-sky-500";
}

function phoneHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function waHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("0")
    ? `972${digits.slice(1)}`
    : digits;
  return `https://wa.me/${withCountry}`;
}

export function CalendarView({
  onNavigate,
}: {
  onNavigate?: (view: OlarView) => void;
}) {
  const { scheduledPosts } = useCampaignStore();
  const [mode, setMode] = useState<CalMode>("week");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [localScheduled, setLocalScheduled] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    client_phone: "",
    service_type: "פחחות וצבע",
    notes: "",
    date: isoDate(new Date()),
    time: "10:00",
    event_type: "order_delivery" as CalendarEventType,
    status: "scheduled" as "scheduled" | "completed",
    reminder_minutes: 30,
  });

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  function resetForm() {
    setEditingId(null);
    setForm({
      title: "",
      client_name: "",
      client_phone: "",
      service_type: "פחחות וצבע",
      notes: "",
      date: isoDate(cursor),
      time: "10:00",
      event_type: "order_delivery",
      status: "scheduled",
      reminder_minutes: 30,
    });
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    // Always hydrate from `one_loop_scheduled_posts` (local calendar posts)
    setLocalScheduled(readScheduledPostsKey());
    try {
      const from = addDays(startOfWeek(new Date()), -30);
      const to = addDays(startOfWeek(new Date()), 180);
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

  // Keep in sync when Studio schedules a post into the campaign store
  useEffect(() => {
    setLocalScheduled(scheduledPosts.length ? scheduledPosts : readScheduledPostsKey());
  }, [scheduledPosts]);

  // storage event (other tab) — key must match ONE_LOOP_SCHEDULED_POSTS_KEY
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ONE_LOOP_SCHEDULED_POSTS_KEY || e.key === "one_loop_scheduled_posts") {
        setLocalScheduled(readScheduledPostsKey());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const mergedEvents = useMemo(() => {
    const fromLocal = localScheduled.map(scheduledPostToEvent);
    const localIds = new Set(fromLocal.map((e) => e.id));
    const fromApi = events.filter((e) => !localIds.has(e.id));
    return [...fromApi, ...fromLocal].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
  }, [events, localScheduled]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    for (const ev of mergedEvents) {
      const key = isoToLocalDate(ev.start_time);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [mergedEvents]);

  function openModalForSlot(date: string, time: string) {
    setEditingId(null);
    setForm((f) => ({
      ...f,
      date,
      time,
      title: "",
      client_name: "",
      client_phone: "",
      notes: "",
      service_type: "פחחות וצבע",
      event_type: "order_delivery",
      status: "scheduled",
      reminder_minutes: 30,
    }));
    setModalOpen(true);
  }

  function openEditEvent(ev: CalendarEventRecord) {
    const crm = unpackCrmDescription(ev.description);
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      client_name: ev.client_name || crm.client_name,
      client_phone: ev.client_phone || crm.client_phone,
      service_type: ev.service_type || crm.service_type || "אחר",
      notes: crm.notes,
      date: isoToLocalDate(ev.start_time),
      time: isoToLocalTime(ev.start_time),
      event_type: ev.event_type,
      status: ev.status === "completed" ? "completed" : "scheduled",
      reminder_minutes: ev.reminder_minutes ?? 30,
    });
    setModalOpen(true);
  }

  async function submitEvent() {
    const title =
      form.title.trim() ||
      form.client_name.trim() ||
      form.service_type.trim();
    if (!title || !form.date || !form.time) return;
    setSaving(true);
    setToast(null);
    try {
      const start_time = localDateTimeToIso(form.date, form.time);
      const description = packCrmDescription({
        notes: form.notes,
        client_name: form.client_name,
        client_phone: form.client_phone,
        service_type: form.service_type,
      });
      const payload = {
        title,
        description,
        start_time,
        end_time: defaultEndTime(start_time),
        event_type: form.event_type,
        status: form.status,
        reminder_minutes: form.reminder_minutes,
        client_name: form.client_name.trim() || null,
        client_phone: form.client_phone.trim() || null,
        service_type: form.service_type.trim() || null,
      };

      if (editingId) {
        const updated = await updateCalendarEvent(editingId, payload);
        if (!updated) {
          setToast("עדכון האירוע נכשל — נסו שוב");
          return;
        }
        setEvents((prev) =>
          prev
            .map((e) =>
              e.id === editingId
                ? {
                    ...e,
                    ...updated,
                    client_name: payload.client_name,
                    client_phone: payload.client_phone,
                    service_type: payload.service_type,
                  }
                : e
            )
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        );
        setModalOpen(false);
        resetForm();
        setToast("האירוע עודכן");
        return;
      }

      const created = await createCalendarEvent(payload);
      if (!created) {
        setToast("שמירת האירוע נכשלה — נסו שוב");
        return;
      }
      setEvents((prev) =>
        [
          ...prev,
          {
            ...created,
            client_name: payload.client_name,
            client_phone: payload.client_phone,
            service_type: payload.service_type,
          },
        ].sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
      setModalOpen(false);
      resetForm();
      setToast("האירוע נשמר ביומן");
    } catch {
      setToast("שמירת האירוע נכשלה — נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    const isLocal = localScheduled.some((p) => p.id === id) || id.startsWith("sched_");
    if (isLocal) {
      removeScheduledPost(id);
      setLocalScheduled((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    const ok = await deleteCalendarEvent(id);
    if (ok) setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleExport() {
    if (mergedEvents.length === 0) {
      setModalOpen(true);
      return;
    }
    await exportCalendarIcs(mergedEvents);
    const last = mergedEvents[mergedEvents.length - 1];
    if (last) openGoogleCalendar(last);
    setToast("קובץ .ics הורד — ניתן לייבא ל-Apple / Google Calendar");
  }

  function shiftWeek(delta: number) {
    setCursor((c) => addDays(c, delta * 7));
  }

  function setMonthYear(month: number, year: number) {
    setCursor(new Date(year, month, 1));
  }

  const rangeLabel =
    mode === "week"
      ? `${weekDays[0]!.toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${weekDays[6]!.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`
      : `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="w-full animate-rise space-y-6 rounded-3xl bg-slate-50 p-4 sm:p-6" dir="rtl">
      <header className="flex flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-3xl font-bold text-slate-950 sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {C.calendarTitle}
          </h1>
          <p className="mt-1 text-base font-medium text-slate-700">
            {C.calendarLegend}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> תור / הזמנה
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> הושלם / שולם
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> פוסט מתוזמן
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-base font-bold text-white shadow-md hover:bg-cyan-500"
          >
            <Plus className="h-5 w-5" />
            {C.calendarAddEvent}
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50"
            title="ייצוא .ics + קישור ל-Google Calendar"
          >
            <Smartphone className="h-4 w-4" />
            סנכרון · .ics / Google
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("week")}
          className={`min-h-11 rounded-xl px-4 text-sm font-bold ${
            mode === "week"
              ? "bg-cyan-600 text-white shadow-md"
              : "border border-slate-300 bg-white text-slate-800"
          }`}
        >
          {C.calendarWeekTab}
        </button>
        <button
          type="button"
          onClick={() => setMode("month")}
          className={`min-h-11 rounded-xl px-4 text-sm font-bold ${
            mode === "month"
              ? "bg-cyan-600 text-white shadow-md"
              : "border border-slate-300 bg-white text-slate-800"
          }`}
        >
          {C.calendarMonthTab}
        </button>

        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900">
          חודש
          <select
            value={cursor.getMonth()}
            onChange={(e) =>
              setMonthYear(Number(e.target.value), cursor.getFullYear())
            }
            className="bg-transparent text-base font-bold outline-none"
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900">
          שנה
          <select
            value={cursor.getFullYear()}
            onChange={(e) =>
              setMonthYear(cursor.getMonth(), Number(e.target.value))
            }
            className="bg-transparent text-base font-bold outline-none"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען יומן...
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() =>
            mode === "week"
              ? shiftWeek(1)
              : setMonthYear(
                  cursor.getMonth() === 11 ? 0 : cursor.getMonth() + 1,
                  cursor.getMonth() === 11
                    ? cursor.getFullYear() + 1
                    : cursor.getFullYear()
                )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50"
          aria-label={C.next}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-cyan-600" />
          <span className="text-lg font-bold text-slate-900">{rangeLabel}</span>
        </div>
        <button
          type="button"
          onClick={() =>
            mode === "week"
              ? shiftWeek(-1)
              : setMonthYear(
                  cursor.getMonth() === 0 ? 11 : cursor.getMonth() - 1,
                  cursor.getMonth() === 0
                    ? cursor.getFullYear() - 1
                    : cursor.getFullYear()
                )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50"
          aria-label={C.prev}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {toast ? (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-900">
          {toast}
        </p>
      ) : null}

      {mode === "week" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div
            className="grid min-w-[760px]"
            style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))" }}
          >
            <div className="border-b border-slate-300 bg-slate-100 p-2" />
            {weekDays.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={`hdr-${isoDate(day)}`}
                  className={`border-b border-s border-slate-300 p-2 text-center ${
                    today ? "bg-cyan-50" : "bg-slate-100"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      today ? "text-cyan-700" : "text-slate-600"
                    }`}
                  >
                    {DAY_LABELS[day.getDay()]}
                  </div>
                  <div
                    className={`mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-xl border-2 text-xl font-black tabular-nums ${
                      today
                        ? "border-cyan-600 bg-cyan-600 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-950"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}

            {HOURS.map((hour) => (
              <div key={`row-${hour}`} className="contents">
                <div className="border-b border-slate-300 bg-slate-50 px-1 py-2 text-center text-xs font-bold text-slate-700">
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
                      className={`min-h-[56px] border-b border-s border-slate-300 p-1 text-right transition hover:bg-cyan-50/60 ${
                        today ? "bg-cyan-50/40" : "bg-white"
                      }`}
                    >
                      <div className="flex h-full flex-col gap-1 overflow-hidden">
                        {slotEvs.map((ev) => (
                          <div
                            key={ev.id}
                            role="button"
                            tabIndex={0}
                            className={`group relative rounded-lg border px-1.5 py-1 text-[11px] font-bold ${eventChipClass(ev)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEvent(ev);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                openEditEvent(ev);
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${eventDot(ev)}`}
                              />
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              <span className="line-clamp-1">{ev.title}</span>
                            </div>
                            <button
                              type="button"
                              className="absolute left-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-slate-600 group-hover:block"
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
              className="py-1 text-center text-sm font-bold text-slate-700"
            >
              {label}
            </div>
          ))}
          {monthDays.map((day, i) => {
            const key = isoDate(day);
            const dayEvs = byDate.get(key) || [];
            const today = isToday(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                onClick={() => openModalForSlot(key, "10:00")}
                className={`flex min-h-[110px] flex-col rounded-2xl border-2 p-2 text-right transition sm:min-h-[130px] sm:p-3 ${
                  today
                    ? "border-cyan-500 bg-cyan-50 shadow-md"
                    : "border-slate-300 bg-white hover:border-cyan-400"
                } ${!inMonth ? "opacity-45" : ""}`}
              >
                <span
                  className={`mb-1 inline-flex h-10 w-10 items-center justify-center self-end rounded-xl border-2 text-2xl font-black tabular-nums ${
                    today
                      ? "border-cyan-600 bg-cyan-600 text-white shadow-md"
                      : "border-slate-200 bg-slate-50 text-slate-950"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                  {dayEvs.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      className={`rounded-lg border px-1.5 py-0.5 text-[11px] font-bold ${eventChipClass(ev)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditEvent(ev);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          openEditEvent(ev);
                        }
                      }}
                    >
                      <span className="line-clamp-1">
                        {isoToLocalTime(ev.start_time)} · {ev.title}
                      </span>
                    </div>
                  ))}
                  {dayEvs.length === 0 ? (
                    <span className="mt-auto flex items-center justify-center gap-1 text-xs font-semibold text-slate-500">
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

      {mergedEvents.length === 0 && !loading ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
          <p className="text-base font-medium text-slate-700">
            {C.emptyDashboardStats}
          </p>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("yona")}
              className="text-sm font-bold text-cyan-700 underline"
            >
              + הוסף פוסט עם יונה
            </button>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xl font-bold text-slate-950">
                {editingId ? "עריכת אירוע / תור" : C.calendarAddEvent}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-bold text-slate-900">
                שם לקוח / עסק
                <input
                  dir="rtl"
                  value={form.client_name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      client_name: e.target.value,
                      title: f.title || e.target.value,
                    }))
                  }
                  placeholder='למשל: "דניאל — ג׳חנון לשבת"'
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                />
              </label>

              <label className="block text-sm font-bold text-slate-900">
                טלפון לקוח
                <div className="mt-1 flex gap-2">
                  <input
                    dir="ltr"
                    value={form.client_phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, client_phone: e.target.value }))
                    }
                    placeholder="050-0000000"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                  />
                  {form.client_phone.trim() ? (
                    <>
                      <a
                        href={phoneHref(form.client_phone)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50"
                        title="חיוג"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <a
                        href={waHref(form.client_phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700"
                        title="וואטסאפ"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </>
                  ) : null}
                </div>
              </label>

              <label className="block text-sm font-bold text-slate-900">
                סוג שירות
                <select
                  value={form.service_type}
                  onChange={(e) => {
                    const service = e.target.value;
                    const mappedType: CalendarEventType =
                      service === "פוסט מתוזמן"
                        ? "post"
                        : service === "משלוח"
                          ? "order_delivery"
                          : service === "פגישה"
                            ? "meeting"
                            : "order_delivery";
                    setForm((f) => ({
                      ...f,
                      service_type: service,
                      event_type: mappedType,
                    }));
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                >
                  {SERVICE_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-900">
                כותרת האירוע
                <input
                  dir="rtl"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                />
              </label>

              <label className="block text-sm font-bold text-slate-900">
                {C.calendarEventType}
                <select
                  value={form.event_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      event_type: e.target.value as CalendarEventType,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                >
                  {(Object.keys(EVENT_TYPE_LABELS_HE) as CalendarEventType[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {EVENT_TYPE_LABELS_HE[k]}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-900">
                סטטוס
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "scheduled" | "completed",
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                >
                  <option value="scheduled">מתוזמן / פתוח</option>
                  <option value="completed">הושלם / תשלום התקבל</option>
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-900">
                הערות / הצעת מחיר
                <textarea
                  dir="rtl"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-cyan-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-bold text-slate-900">
                  {C.appointmentDate}
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-900">
                  {C.appointmentTime}
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, time: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                  />
                </label>
              </div>

              <label className="block text-sm font-bold text-slate-900">
                תזכורת לפני
                <select
                  value={form.reminder_minutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      reminder_minutes: Number(e.target.value),
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-cyan-500"
                >
                  <option value={0}>ללא תזכורת</option>
                  <option value={15}>15 דקות</option>
                  <option value={30}>30 דקות</option>
                  <option value={60}>שעה</option>
                  <option value={1440}>יום לפני</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={
                saving ||
                (!form.title.trim() && !form.client_name.trim())
              }
              onClick={() => void submitEvent()}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "שמור שינויים" : C.appointmentSave}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  void removeEvent(editingId);
                  setModalOpen(false);
                  resetForm();
                }}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 text-sm font-bold text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                מחק אירוע
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (editingId) {
                  const ev = mergedEvents.find((e) => e.id === editingId);
                  if (ev) {
                    openGoogleCalendar(ev);
                    void exportCalendarIcs([ev]);
                  }
                } else {
                  void handleExport();
                }
              }}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
            >
              <Smartphone className="h-4 w-4" />
              {C.calendarSyncPhone}
            </button>
          </div>
        </div>
      ) : null}

      <FooterBrand />
    </div>
  );
}
