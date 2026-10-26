import { OlarApp } from "@/components/olar/OlarApp";

/** Full-stack operational calendar — week/month grid + Supabase + .ics sync. */
export default function CalendarPage() {
  return <OlarApp initialView="calendar" />;
}
