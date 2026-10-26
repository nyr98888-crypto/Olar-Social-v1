-- Operational calendar events (posts, deliveries, meetings, reminders)

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  event_type text not null default 'post'
    check (event_type in ('post', 'order_delivery', 'meeting', 'reminder')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  reminder_minutes int not null default 30,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_time_range check (end_time > start_time)
);

create index if not exists calendar_events_user_start_idx
  on public.calendar_events (user_id, start_time asc);

create index if not exists calendar_events_user_status_idx
  on public.calendar_events (user_id, status);

alter table public.calendar_events enable row level security;

drop policy if exists "Users manage own calendar events" on public.calendar_events;
create policy "Users manage own calendar events"
  on public.calendar_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.calendar_events is
  'Operational work calendar: scheduled posts, deliveries, meetings, reminders.';
