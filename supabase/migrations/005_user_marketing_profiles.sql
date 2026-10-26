-- Wingman personal marketing memory (activity + business continuity)

create table if not exists public.user_marketing_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  owner_name text,
  category text,
  tone_preference text,
  last_activity_at timestamptz,
  last_post_topic text,
  recent_wins jsonb not null default '[]'::jsonb,
  total_posts_created int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_marketing_profiles is
  'Maya Wingman continuity: business facts + recent post activity per authenticated user.';

comment on column public.user_marketing_profiles.tone_preference is
  'Preferred tone: עממי | יוקרתי | ישיר, or free-form Hebrew.';

comment on column public.user_marketing_profiles.recent_wins is
  'JSON array of recent wins (strings or {text, at, postType?} objects), capped client-side (~5).';

create index if not exists user_marketing_profiles_last_activity_idx
  on public.user_marketing_profiles (last_activity_at desc nulls last);

alter table public.user_marketing_profiles enable row level security;

drop policy if exists "Users read own marketing profile" on public.user_marketing_profiles;
create policy "Users read own marketing profile"
  on public.user_marketing_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own marketing profile" on public.user_marketing_profiles;
create policy "Users insert own marketing profile"
  on public.user_marketing_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own marketing profile" on public.user_marketing_profiles;
create policy "Users update own marketing profile"
  on public.user_marketing_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on write
create or replace function public.touch_user_marketing_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_marketing_profiles_set_updated_at
  on public.user_marketing_profiles;
create trigger user_marketing_profiles_set_updated_at
  before update on public.user_marketing_profiles
  for each row execute function public.touch_user_marketing_profiles_updated_at();
