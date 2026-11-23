-- Connected tools (Google first): encrypted tokens, approvals for sensitive tool calls.

-- Shown on the Integrations page (readable by members through the existing RLS policies)
alter table public.integrations
  add column account_email text,
  add column scopes text[] not null default '{}';

-- OAuth tokens, encrypted by the app. RLS is on with NO policies: only the server
-- (secret key) can read or write this table; browsers can never see tokens.
create table public.integration_credentials (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);
alter table public.integration_credentials enable row level security;

-- Sensitive tool calls (send email, create event…) waiting for a person's OK
create table public.tool_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  tool_use_id text not null unique,
  tool_name text not null,
  input jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index tool_approvals_conversation_idx on public.tool_approvals (conversation_id);
create index tool_approvals_workspace_idx on public.tool_approvals (workspace_id);
create index tool_approvals_decided_by_idx on public.tool_approvals (decided_by);
alter table public.tool_approvals enable row level security;
create policy "approvals: members read" on public.tool_approvals
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "mfa: two-step verified" on public.tool_approvals
  as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- A task waiting for someone to approve a sensitive action
alter type public.task_status add value if not exists 'needs_approval';
