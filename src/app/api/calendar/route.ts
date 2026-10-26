/**
 * Operational calendar CRUD (list + create).
 * Auth users → Supabase calendar_events.
 * Guests → acknowledged; client keeps sessionStorage mirror.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  defaultEndTime,
  isCalendarEventStatus,
  isCalendarEventType,
  type CalendarEventInput,
  type CalendarEventRecord,
} from "@/lib/olar/calendar-events";

export const runtime = "nodejs";

const SELECT_COLS =
  "id, user_id, title, description, start_time, end_time, event_type, status, reminder_minutes, google_event_id, created_at, updated_at";

function normalizeInput(body: CalendarEventInput & Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const start_time =
    typeof body.start_time === "string" ? body.start_time.trim() : "";
  if (!title || !start_time) {
    return { error: "title and start_time are required" as const };
  }
  const end_time =
    typeof body.end_time === "string" && body.end_time.trim()
      ? body.end_time.trim()
      : defaultEndTime(start_time);

  const event_type = isCalendarEventType(body.event_type)
    ? body.event_type
    : "post";
  const status = isCalendarEventStatus(body.status)
    ? body.status
    : "scheduled";
  const reminder_minutes =
    typeof body.reminder_minutes === "number" &&
    Number.isFinite(body.reminder_minutes)
      ? Math.max(0, Math.floor(body.reminder_minutes))
      : 30;
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const google_event_id =
    typeof body.google_event_id === "string"
      ? body.google_event_id.trim() || null
      : null;

  return {
    row: {
      title,
      description,
      start_time,
      end_time,
      event_type,
      status,
      reminder_minutes,
      google_event_id,
    },
  };
}

/** GET /api/calendar?from=&to= — list events in range (defaults: ±60 days). */
export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const now = new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const to = toParam
    ? new Date(toParam)
    : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if (session.mode === "guest") {
    return NextResponse.json({
      ok: true,
      guestMode: true,
      events: [] as CalendarEventRecord[],
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(SELECT_COLS)
    .eq("user_id", session.user.id)
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[api/calendar] GET", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    events: (data || []) as CalendarEventRecord[],
  });
}

/** POST /api/calendar — create event. */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CalendarEventInput &
    Record<string, unknown>;
  const normalized = normalizeInput(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  if (session.mode === "guest") {
    const guestEvent: CalendarEventRecord = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: normalized.row.title,
      description: normalized.row.description,
      start_time: normalized.row.start_time,
      end_time: normalized.row.end_time,
      event_type: normalized.row.event_type,
      status: normalized.row.status,
      reminder_minutes: normalized.row.reminder_minutes,
      google_event_id: normalized.row.google_event_id,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({
      ok: true,
      guestMode: true,
      event: guestEvent,
    });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: session.user.id,
      ...normalized.row,
      updated_at: now,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[api/calendar] POST", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    event: data as CalendarEventRecord,
  });
}
