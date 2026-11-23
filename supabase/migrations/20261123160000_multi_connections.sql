-- Several connections per workspace (e.g. two Google accounts) and API-key connections.

alter table public.integrations drop constraint if exists integrations_workspace_id_provider_key;
alter table public.integrations
  add column label text not null default '',
  add column is_default boolean not null default false,
  -- API-key connections: { "host": "api.example.com", "header": "Authorization", "prefix": "Bearer " }
  add column config jsonb not null default '{}'::jsonb;
create unique index integrations_unique_account
  on public.integrations (workspace_id, provider, lower(coalesce(account_email, label)));

-- Secrets now belong to one connection (not one per provider)
drop table if exists public.integration_credentials;
create table public.integration_credentials (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- OAuth refresh token, or the API key
  secret_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create index integration_credentials_workspace_idx on public.integration_credentials (workspace_id);
-- Server only: RLS on with no policies, so browsers can never read secrets
alter table public.integration_credentials enable row level security;
