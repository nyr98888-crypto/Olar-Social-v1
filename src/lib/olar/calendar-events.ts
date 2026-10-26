/** Shared types + helpers for operational calendar (DB + client + ICS). */

export const CALENDAR_EVENT_TYPES = [
  "post",
  "order_delivery",
  "meeting",
  "reminder",
] as const;

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export type CalendarEventRecord = {
  id: string;
  user_id?: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  reminder_minutes: number;
  google_event_id: string | null;
  /** CRM extras (persisted in description envelope for guest / until migration) */
  client_name?: string | null;
  client_phone?: string | null;
  service_type?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string;
  event_type?: CalendarEventType;
  status?: CalendarEventStatus;
  reminder_minutes?: number;
  google_event_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  service_type?: string | null;
};

export const SERVICE_TYPE_OPTIONS = [
  "פחחות וצבע",
  "טיפול תקופתי",
  "פוסט מתוזמן",
  "משלוח",
  "פגישה",
  "אחר",
] as const;

/** Pack CRM fields into description for storage without schema drift. */
export function packCrmDescription(opts: {
  notes?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  service_type?: string | null;
}): string | null {
  const notes = (opts.notes || "").trim();
  const client = (opts.client_name || "").trim();
  const phone = (opts.client_phone || "").trim();
  const service = (opts.service_type || "").trim();
  if (!notes && !client && !phone && !service) return null;
  const lines = [
    notes,
    client ? `לקוח: ${client}` : "",
    phone ? `טלפון: ${phone}` : "",
    service ? `שירות: ${service}` : "",
  ].filter(Boolean);
  return lines.join("\n") || null;
}

export function unpackCrmDescription(description: string | null | undefined): {
  notes: string;
  client_name: string;
  client_phone: string;
  service_type: string;
} {
  const raw = description || "";
  const lines = raw.split("\n");
  let client_name = "";
  let client_phone = "";
  let service_type = "";
  const notesLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("לקוח:")) client_name = line.replace(/^לקוח:\s*/, "");
    else if (line.startsWith("טלפון:"))
      client_phone = line.replace(/^טלפון:\s*/, "");
    else if (line.startsWith("שירות:"))
      service_type = line.replace(/^שירות:\s*/, "");
    else notesLines.push(line);
  }
  return {
    notes: notesLines.join("\n").trim(),
    client_name,
    client_phone,
    service_type,
  };
}

export function isCalendarEventType(v: unknown): v is CalendarEventType {
  return (
    typeof v === "string" &&
    (CALENDAR_EVENT_TYPES as readonly string[]).includes(v)
  );
}

export function isCalendarEventStatus(v: unknown): v is CalendarEventStatus {
  return (
    typeof v === "string" &&
    (CALENDAR_EVENT_STATUSES as readonly string[]).includes(v)
  );
}

/** Default 1-hour duration when end_time omitted. */
export function defaultEndTime(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString();
  }
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/** Combine local date (YYYY-MM-DD) + time (HH:mm) → ISO UTC string. */
export function localDateTimeToIso(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  const local = new Date(`${date}T${t}`);
  if (Number.isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}

export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "10:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

export function buildIcsCalendar(
  events: CalendarEventRecord[],
  calendarName = "One Loop Social"
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//One Loop Social//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const uid = `${ev.id}@olarsocial.local`;
    const dtStart = toIcsUtc(ev.start_time);
    const dtEnd = toIcsUtc(ev.end_time);
    if (!dtStart || !dtEnd) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toIcsUtc(new Date().toISOString())}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    }
    lines.push(`CATEGORIES:${ev.event_type}`);
    if (ev.reminder_minutes > 0) {
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-PT" + ev.reminder_minutes + "M");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${icsEscape(ev.title)}`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Google Calendar template URL for a single event. */
export function googleCalendarUrl(ev: CalendarEventRecord): string {
  const start = toIcsUtc(ev.start_time).replace(/Z$/, "");
  const end = toIcsUtc(ev.end_time).replace(/Z$/, "");
  const text = encodeURIComponent(ev.title);
  const details = encodeURIComponent(
    [ev.event_type, ev.description].filter(Boolean).join(" · ")
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}

export function downloadIcsBlob(ics: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const EVENT_TYPE_LABELS_HE: Record<CalendarEventType, string> = {
  post: "פוסט",
  order_delivery: "הזמנה / משלוח",
  meeting: "פגישה",
  reminder: "תזכורת",
};
