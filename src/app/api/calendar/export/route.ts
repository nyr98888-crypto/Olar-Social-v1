/**
 * GET /api/calendar/export — download .ics for Apple / Google / Outlook.
 * Query: ?from=&to= (optional range).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  buildIcsCalendar,
  type CalendarEventRecord,
} from "@/lib/olar/calendar-events";

export const runtime = "nodejs";

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
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam
    ? new Date(toParam)
    : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  let events: CalendarEventRecord[] = [];

  if (session.mode !== "guest") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id, user_id, title, description, start_time, end_time, event_type, status, reminder_minutes, google_event_id, created_at, updated_at"
      )
      .eq("user_id", session.user.id)
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    events = (data || []) as CalendarEventRecord[];
  }

  // Optional client-supplied events for guest export (POST body not used on GET)
  const clientRaw = url.searchParams.get("ids");
  void clientRaw;

  const ics = buildIcsCalendar(events, "One Loop Social Calendar");
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="olar-calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}

/** POST export with explicit event list (guest / bulk). */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    events?: CalendarEventRecord[];
  };
  const events = Array.isArray(body.events) ? body.events : [];
  const ics = buildIcsCalendar(events, "One Loop Social Calendar");
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="olar-calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}
