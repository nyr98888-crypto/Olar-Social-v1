/**
 * PATCH / DELETE single calendar event (owner only).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppSession } from "@/lib/auth/session";
import {
  isCalendarEventStatus,
  isCalendarEventType,
  type CalendarEventRecord,
} from "@/lib/olar/calendar-events";

export const runtime = "nodejs";

const SELECT_COLS =
  "id, user_id, title, description, start_time, end_time, event_type, status, reminder_minutes, google_event_id, created_at, updated_at";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (typeof body.start_time === "string" && body.start_time.trim()) {
    patch.start_time = body.start_time.trim();
  }
  if (typeof body.end_time === "string" && body.end_time.trim()) {
    patch.end_time = body.end_time.trim();
  }
  if (isCalendarEventType(body.event_type)) {
    patch.event_type = body.event_type;
  }
  if (isCalendarEventStatus(body.status)) {
    patch.status = body.status;
  }
  if (
    typeof body.reminder_minutes === "number" &&
    Number.isFinite(body.reminder_minutes)
  ) {
    patch.reminder_minutes = Math.max(0, Math.floor(body.reminder_minutes));
  }
  if (typeof body.google_event_id === "string") {
    patch.google_event_id = body.google_event_id.trim() || null;
  }

  if (session.mode === "guest") {
    return NextResponse.json({
      ok: true,
      guestMode: true,
      event: { id, ...patch } as CalendarEventRecord,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, event: data as CalendarEventRecord });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (session.mode === "guest") {
    return NextResponse.json({ ok: true, guestMode: true, deleted: id });
  }

  const supabase = await createClient();
  // Soft-cancel preferred for audit trail
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: id });
}
