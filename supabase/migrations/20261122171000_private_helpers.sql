-- Keep the RLS helper functions out of the public API (/rest/v1/rpc).
-- Policies reference functions by id, so moving the schema keeps them working.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_workspace_member(uuid) set schema private;
alter function public.has_workspace_role(uuid, public.workspace_role[]) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.set_updated_at() set schema private;

-- Indexes for the remaining foreign keys
create index if not exists workspace_invites_invited_by_idx on public.workspace_invites (invited_by);
create index if not exists workspaces_created_by_idx on public.workspaces (created_by);
