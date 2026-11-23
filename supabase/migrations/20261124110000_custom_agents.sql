-- Custom agents (PRD §28): specialists a workspace creates itself. Each one is a real agent on
-- Claude; Baba runs it in its own session with its own spending cap (see src/lib/custom-agents).
create table public.custom_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  instructions text not null check (char_length(instructions) between 20 and 20000),
  model text not null default 'claude-sonnet-5-5' check (model in ('claude-sonnet-5-5', 'claude-haiku-5-5')),
  web_access boolean not null default false,
  max_cost_usd numeric(10, 2) not null default 0.50 check (max_cost_usd > 0 and max_cost_usd <= 10),
  enabled boolean not null default true,
  claude_agent_id text,
  claude_agent_version int,
  runs int not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index custom_agents_name_unique on public.custom_agents (workspace_id, lower(name));
create index custom_agents_created_by_idx on public.custom_agents (created_by);
create trigger custom_agents_updated_at before update on public.custom_agents
  for each row execute function private.set_updated_at();
alter table public.custom_agents enable row level security;
create policy "custom agents: members read" on public.custom_agents for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "custom agents: admins create" on public.custom_agents for insert to authenticated
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "custom agents: admins update" on public.custom_agents for update to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "custom agents: admins delete" on public.custom_agents for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "mfa: two-step verified" on public.custom_agents as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
