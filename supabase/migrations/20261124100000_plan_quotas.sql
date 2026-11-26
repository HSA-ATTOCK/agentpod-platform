-- Plan quotas enforced in the database (they can't be bypassed through the API).
create or replace function private.plan_quota(ws uuid, kind text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case kind
    when 'workflows' then p.max_workflows
    when 'integrations' then p.max_integrations
  end
  from public.workspace_limits l
  join public.subscription_plans p on p.id = l.plan_id
  where l.workspace_id = ws;
$$;
revoke execute on function private.plan_quota(uuid, text) from public, anon;

create or replace function private.enforce_workflow_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare quota int := private.plan_quota(new.workspace_id, 'workflows');
begin
  if quota is not null and (select count(*) from public.workflows w where w.workspace_id = new.workspace_id) >= quota then
    raise exception 'Your plan allows % workflows. Delete one or ask an administrator to upgrade the plan.', quota using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger workflows_quota before insert on public.workflows
  for each row execute function private.enforce_workflow_quota();

create or replace function private.enforce_integration_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare quota int;
begin
  -- The workspace's own Google app is configuration, not a connection
  if new.provider = 'google_app' then return new; end if;
  quota := private.plan_quota(new.workspace_id, 'integrations');
  if quota is not null and (select count(*) from public.integrations i where i.workspace_id = new.workspace_id and i.provider <> 'google_app') >= quota then
    raise exception 'Your plan allows % connections. Remove one or ask an administrator to upgrade the plan.', quota using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger integrations_quota before insert on public.integrations
  for each row execute function private.enforce_integration_quota();

-- Spending warnings: remember which ones were sent this month (80% and 100%)
alter table public.workspaces add column spend_alert_month text, add column spend_alert_level int not null default 0;

-- Search inside chat messages
create index if not exists conversation_items_text_search_idx on public.conversation_items
  using gin (to_tsvector('simple', coalesce(data ->> 'text', '')));
