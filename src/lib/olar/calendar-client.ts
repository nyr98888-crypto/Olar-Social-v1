/**
 * Client helpers: fetch / mutate calendar events.
 * Guest → sessionStorage mirror; auth → /api/calendar.
 */
import {
  buildIcsCalendar,
  downloadIcsBlob,
  googleCalendarUrl,
  type CalendarEventInput,
  type CalendarEventRecord,
} from "@/lib/olar/calendar-events";
import { storageGet, storageSet } from "@/lib/olar/client-storage";

function loadGuestEvents(): CalendarEventRecord[] {
  try {
    const raw = storageGet("calendar-events");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CalendarEventRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestEvents(list: CalendarEventRecord[]) {
  storageSet("calendar-events", JSON.stringify(list));
}

export async function fetchCalendarEvents(opts?: {
  from?: string;
  to?: string;
}): Promise<{ events: CalendarEventRecord[]; guestMode: boolean }> {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set("from", opts.from);
  if (opts?.to) qs.set("to", opts.to);
  const res = await fetch(`/api/calendar?${qs.toString()}`, {
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    guestMode?: boolean;
    events?: CalendarEventRecord[];
    error?: string;
  };

  if (data.guestMode) {
    return { events: loadGuestEvents(), guestMode: true };
  }
  if (!res.ok) {
    console.error("[calendar-client] fetch failed", data.error);
    return { events: loadGuestEvents(), guestMode: false };
  }
  return { events: data.events || [], guestMode: false };
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventRecord | null> {
  const res = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    guestMode?: boolean;
    event?: CalendarEventRecord;
    error?: string;
  };
  if (!res.ok || !data.event) {
    console.error("[calendar-client] create failed", data.error);
    return null;
  }
  if (data.guestMode) {
    const list = [...loadGuestEvents(), data.event];
    saveGuestEvents(list);
  }
  return data.event;
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<CalendarEventInput> & { status?: string }
): Promise<CalendarEventRecord | null> {
  const res = await fetch(`/api/calendar/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    guestMode?: boolean;
    event?: CalendarEventRecord;
  };
  if (!res.ok || !data.event) return null;
  if (data.guestMode || id.startsWith("guest-")) {
    const list = loadGuestEvents().map((e) => {
      if (e.id !== id) return e;
      return {
        ...e,
        ...data.event!,
        id: e.id,
        title: data.event!.title || e.title,
        description:
          data.event!.description !== undefined
            ? data.event!.description
            : e.description,
        start_time: data.event!.start_time || e.start_time,
        end_time: data.event!.end_time || e.end_time,
        event_type: data.event!.event_type || e.event_type,
        reminder_minutes:
          data.event!.reminder_minutes ?? e.reminder_minutes,
        status: (data.event!.status as CalendarEventRecord["status"]) || e.status,
      };
    });
    saveGuestEvents(list);
    return list.find((e) => e.id === id) || data.event;
  }
  return data.event;
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const res = await fetch(`/api/calendar/${id}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return false;
  if (id.startsWith("guest-")) {
    saveGuestEvents(loadGuestEvents().filter((e) => e.id !== id));
  } else {
    const data = (await res.json().catch(() => ({}))) as { guestMode?: boolean };
    if (data.guestMode) {
      saveGuestEvents(loadGuestEvents().filter((e) => e.id !== id));
    }
  }
  return true;
}

export async function exportCalendarIcs(
  events: CalendarEventRecord[]
): Promise<void> {
  try {
    const res = await fetch("/api/calendar/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "olar-calendar.ics";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
  } catch {
    /* fall through to client-side ICS */
  }
  downloadIcsBlob(buildIcsCalendar(events), "olar-calendar.ics");
}

export function openGoogleCalendar(ev: CalendarEventRecord) {
  window.open(googleCalendarUrl(ev), "_blank");
}
