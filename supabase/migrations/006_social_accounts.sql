-- Dual-track publishing credentials (Meta Graph tokens stay server-side)

alter table public.profiles
  add column if not exists social_accounts jsonb not null default '{}'::jsonb;

comment on column public.profiles.social_accounts is
  'Per-platform publish config: { facebook|instagram: { mode, profileUrl, pageId, accessToken?, isConnected } }. Tokens never returned to client in full.';
