-- Current business post + profile snapshot (image URL persistence)

alter table public.profiles
  add column if not exists business_profile jsonb default null;

comment on column public.profiles.business_profile is
  'Onboarding business profile snapshot (name, niche, firstPost, services).';

create table if not exists public.business_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  headline text not null default '',
  body text not null default '',
  cta text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  offer text,
  image_url text,
  image_seed integer,
  image_prompt text,
  network text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_posts_user_current_uidx
  on public.business_posts (user_id)
  where is_current = true;

create index if not exists business_posts_user_updated_idx
  on public.business_posts (user_id, updated_at desc);

alter table public.business_posts enable row level security;

drop policy if exists "Users manage own business posts" on public.business_posts;
create policy "Users manage own business posts"
  on public.business_posts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
