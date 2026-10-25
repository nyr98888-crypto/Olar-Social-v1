-- Brand DNA: niche lock + visual guardrails per profile (Anti-Hallucination)

alter table public.profiles
  add column if not exists brand_dna jsonb not null default '{}'::jsonb;

comment on column public.profiles.brand_dna is
  'Niche lock JSON: { business_type, allowed_visual_style, forbidden_elements[] }. Authoritative for image prompts.';

-- Optional denormalized copy on conversation for session restore / guest-like flows
alter table public.conversations
  add column if not exists brand_dna jsonb default null;

comment on column public.conversations.brand_dna is
  'Optional session override of niche Brand DNA; profile.brand_dna is source of truth when null.';
