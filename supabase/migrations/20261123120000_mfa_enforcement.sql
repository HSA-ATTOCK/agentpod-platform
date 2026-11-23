-- Two-step verification: once someone has a verified authenticator, their data is only
-- reachable from a session that passed the second step (aal2), even through the raw API.

create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    );
$$;
revoke execute on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','workspaces','workspace_members','workspace_invites','conversations','conversation_items','tasks','files','workflows','integrations','notification_preferences']
  loop
    execute format('create policy "mfa: two-step verified" on public.%I as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()))', t);
  end loop;
end $$;
