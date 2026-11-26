-- Daily briefing: each person can switch a morning summary on or off per workspace
-- (Settings → Notifications). Off by default. Only the server writes (via /api/briefing).
create table public.daily_briefings (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  enabled boolean not null default false,
  send_hour smallint not null default 8 check (send_hour between 0 and 23),
  last_sent_on date,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create index daily_briefings_due_idx on public.daily_briefings (enabled) where enabled;

alter table public.daily_briefings enable row level security;

create policy "briefings: own read" on public.daily_briefings
  for select to authenticated using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

create policy "mfa: two-step verified" on public.daily_briefings as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

revoke insert, update, delete, truncate on public.daily_briefings from anon, authenticated;
