-- Platform administration (PRD §3, §15, §18.5, §22):
-- account approval, master administrator, platform settings, plans, per-workspace limits,
-- agent registry, tamper-resistant audit log and in-app notifications.

-- ---------------------------------------------------------------------------
-- Accounts: every user has a status; only APPROVED users can reach any data
-- ---------------------------------------------------------------------------

create type public.account_status as enum ('pending_approval', 'approved', 'rejected', 'suspended', 'deactivated');

create table public.platform_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status public.account_status not null default 'pending_approval',
  -- The platform's master administrators (separate from workspace owner/admin roles)
  is_admin boolean not null default false,
  status_reason text check (char_length(status_reason) <= 500),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  admins_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_accounts_status_idx on public.platform_accounts (status);
create index platform_accounts_reviewed_by_idx on public.platform_accounts (reviewed_by);
create trigger platform_accounts_updated_at before update on public.platform_accounts
  for each row execute function private.set_updated_at();

alter table public.platform_accounts enable row level security;
-- People can see their own status (for the "waiting for approval" screen). Nobody can change it
-- through the API: only the server (service role) after checking the caller is a platform admin.
create policy "accounts: read own" on public.platform_accounts
  for select to authenticated using (user_id = (select auth.uid()));

-- Everyone who already had an account is approved
insert into public.platform_accounts (user_id, status, reviewed_at)
select id, 'approved', now() from auth.users
on conflict (user_id) do nothing;

create or replace function private.account_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_accounts a
    where a.user_id = (select auth.uid()) and a.status = 'approved'
  );
$$;
revoke execute on function private.account_approved() from public, anon;
grant execute on function private.account_approved() to authenticated;

-- The restrictive policy on every table (and the check in every RPC) already calls mfa_ok().
-- From now on it also requires an approved account, so pending, rejected and suspended
-- users get nothing from the database, whatever they send to the API.
create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_approved() and (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Platform settings (one row), plans and per-workspace limits set by the platform admin
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  require_approval boolean not null default true,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'Baba is down for maintenance. Please try again shortly.',
  announcement text check (char_length(announcement) <= 500),
  default_monthly_limit_usd numeric(10, 2) not null default 50.00 check (default_monthly_limit_usd > 0),
  default_task_cap_usd numeric(10, 2) not null default 1.00 check (default_task_cap_usd > 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1);
create index platform_settings_updated_by_idx on public.platform_settings (updated_by);
alter table public.platform_settings enable row level security;
create policy "settings: signed-in read" on public.platform_settings for select to authenticated using (true);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  -- Shown as-is (e.g. "$49 / month"); prices are configured here, never in code
  price_label text not null default '',
  monthly_limit_usd numeric(10, 2) not null default 50.00 check (monthly_limit_usd > 0),
  daily_limit_usd numeric(10, 2) check (daily_limit_usd > 0),
  task_cap_usd numeric(10, 2) not null default 1.00 check (task_cap_usd > 0),
  max_workflows int check (max_workflows >= 0),
  max_integrations int check (max_integrations >= 0),
  max_previews int check (max_previews >= 0),
  -- null = every enabled agent
  allowed_agents text[],
  features text[] not null default '{}',
  is_public boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function private.set_updated_at();
alter table public.subscription_plans enable row level security;
create policy "plans: signed-in read active" on public.subscription_plans for select to authenticated using (active);

insert into public.subscription_plans (key, name, description, monthly_limit_usd, daily_limit_usd, task_cap_usd, max_workflows, max_integrations, max_previews, features, sort) values
  ('trial', 'Free trial', 'Try Baba with a small allowance.', 5, 2, 0.50, 2, 2, 1, array['Ask Baba chat', 'Research, writing and data analysis', '2 connected tools'], 1),
  ('starter', 'Starter', 'Essential agents for a small business.', 50, 10, 1, 10, 5, 5, array['Everything in the trial', 'Scheduled workflows', 'Gmail, Drive and Calendar'], 2),
  ('professional', 'Professional', 'More agents, websites and automation.', 200, 40, 3, 50, 20, 20, array['Everything in Starter', 'Website builder with previews', 'Database connections', 'Webhooks'], 3),
  ('business', 'Business', 'Teams with higher limits.', 1000, 200, 10, null, null, 100, array['Everything in Professional', 'Team roles and approvals', 'Higher limits'], 4),
  ('enterprise', 'Enterprise', 'Custom limits and support.', 5000, null, 25, null, null, null, array['Custom limits', 'Custom integrations', 'Priority support'], 5);

create table public.workspace_limits (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan_id uuid references public.subscription_plans (id) on delete set null,
  -- Overrides (null = use the plan's value)
  monthly_limit_usd numeric(10, 2) check (monthly_limit_usd > 0),
  daily_limit_usd numeric(10, 2) check (daily_limit_usd > 0),
  -- null = the plan's agents (or all); otherwise only these agent keys
  allowed_agents text[],
  note text check (char_length(note) <= 500),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index workspace_limits_plan_idx on public.workspace_limits (plan_id);
create index workspace_limits_updated_by_idx on public.workspace_limits (updated_by);
alter table public.workspace_limits enable row level security;
create policy "limits: members read" on public.workspace_limits
  for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "mfa: two-step verified" on public.workspace_limits as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- ---------------------------------------------------------------------------
-- Agent registry: which agents exist and whether the platform admin has them on
-- ---------------------------------------------------------------------------

create table public.agent_registry (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text not null default '',
  category text not null default 'specialist',
  enabled boolean not null default true,
  -- The Claude agent id (kept in sync by npm run baba:setup / the admin page)
  claude_agent_id text,
  claude_agent_version int,
  sort int not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index agent_registry_updated_by_idx on public.agent_registry (updated_by);
alter table public.agent_registry enable row level security;
create policy "agents: signed-in read" on public.agent_registry for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Audit log: append-only (updates and deletes are refused, even for the service role)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Plain ids (no foreign keys) so the log outlives deleted users and workspaces
  actor_id uuid,
  actor_email text,
  workspace_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  target_type text,
  target_id text,
  details jsonb not null default '{}'
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function private.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_append_only();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_append_only();

alter table public.audit_logs enable row level security;
-- Workspace owners and admins can read their workspace's log (platform admins read it through the server)
create policy "audit: workspace admins read" on public.audit_logs
  for select to authenticated using (
    workspace_id is not null
    and (select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  );
create policy "mfa: two-step verified" on public.audit_logs as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'danger')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 2000),
  link text check (link ~ '^/[^/]'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_workspace_idx on public.notifications (workspace_id);
alter table public.notifications enable row level security;
create policy "inbox: own read" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "inbox: own mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "inbox: own delete" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy "mfa: two-step verified" on public.notifications as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
-- People may only mark their notifications read, not rewrite them
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- New sign-ups get a status: approved straight away only if approval is switched off
-- or a workspace already invited them (an approved owner vouched for them)
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  ws_id uuid;
  auto_approve boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, display_name);

  insert into public.workspaces (name, slug, created_by)
  values (
    display_name || '''s workspace',
    'ws-' || substr(replace(new.id::text, '-', ''), 1, 12),
    new.id
  )
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  select not coalesce((select s.require_approval from public.platform_settings s where s.id = 1), true)
    or exists (
      select 1 from public.workspace_invites i
      where lower(i.email) = lower(new.email) and i.status = 'pending' and i.expires_at > now()
    )
  into auto_approve;

  insert into public.platform_accounts (user_id, status, reviewed_at)
  values (new.id, case when auto_approve then 'approved'::public.account_status else 'pending_approval'::public.account_status end,
          case when auto_approve then now() end);

  return new;
end;
$$;
