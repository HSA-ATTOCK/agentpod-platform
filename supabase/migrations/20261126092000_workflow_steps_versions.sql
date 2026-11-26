-- Multi-step workflows: an ordered list of steps (do / check / ask me / notify me)
alter table public.workflows add column steps jsonb not null default '[]'
  check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20);

-- Every saved change keeps a version (restore from the workflow editor)
create table public.workflow_versions (
  id bigint generated always as identity primary key,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version int not null,
  name text not null,
  instruction text not null,
  steps jsonb not null default '[]',
  frequency text not null,
  day_of_week smallint,
  time_of_day time,
  cap_usd numeric(10, 2) not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);
create index workflow_versions_workspace_idx on public.workflow_versions (workspace_id);
create index workflow_versions_changed_by_idx on public.workflow_versions (changed_by);
alter table public.workflow_versions enable row level security;
create policy "workflow versions: members read" on public.workflow_versions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "mfa: two-step verified" on public.workflow_versions as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

create or replace function private.record_workflow_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only real edits (not the scheduler marking a run or a webhook link change)
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.instruction is not distinct from old.instruction
     and new.steps is not distinct from old.steps and new.frequency is not distinct from old.frequency
     and new.day_of_week is not distinct from old.day_of_week and new.time_of_day is not distinct from old.time_of_day
     and new.cap_usd is not distinct from old.cap_usd then
    return new;
  end if;
  insert into public.workflow_versions (workflow_id, workspace_id, version, name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, changed_by)
  values (new.id, new.workspace_id,
          coalesce((select max(v.version) from public.workflow_versions v where v.workflow_id = new.id), 0) + 1,
          new.name, new.instruction, new.steps, new.frequency, new.day_of_week, new.time_of_day, new.cap_usd, (select auth.uid()));
  return new;
end;
$$;
create trigger workflows_versions after insert or update on public.workflows
  for each row execute function private.record_workflow_version();

-- Versions for existing workflows
insert into public.workflow_versions (workflow_id, workspace_id, version, name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, changed_by)
select id, workspace_id, 1, name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, created_by from public.workflows;
