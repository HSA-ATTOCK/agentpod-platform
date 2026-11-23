-- Scheduled workflow runs: remember which scheduled time was last handled,
-- so each slot runs exactly once even if several servers check at the same moment.
alter table public.workflows add column last_run_slot timestamptz;
comment on column public.workflows.last_run_slot is 'The scheduled time (UTC) the runner last handled, so each slot runs once.';
create index workflows_due_idx on public.workflows (enabled, frequency) where enabled and frequency <> 'manual';
