-- Security review fixes: signed-in users may only change harmless columns.
-- Spending, ownership and server-managed fields are written by the server (service role) only.

-- ---- Spending can't be rewritten by users ----
revoke insert, update on public.tasks from authenticated, anon;
grant insert (workspace_id, conversation_id, created_by, workflow_id, request, cap_cents) on public.tasks to authenticated;

revoke insert, update on public.conversations from authenticated, anon;
grant insert (id, workspace_id, created_by, title) on public.conversations to authenticated;
grant update (title) on public.conversations to authenticated;

-- ---- Workflows: the author can't be changed (scheduled runs act as the author) ----
revoke insert, update on public.workflows from authenticated, anon;
grant insert (workspace_id, created_by, name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, enabled) on public.workflows to authenticated;
grant update (name, instruction, steps, frequency, day_of_week, time_of_day, cap_usd, enabled, last_run_slot, webhook_token_hash) on public.workflows to authenticated;

-- ---- Custom agents and websites: managed by the server only (Claude agent ids, domains, slugs) ----
revoke insert, update, delete on public.custom_agents from authenticated, anon;
revoke update, delete on public.sites from authenticated, anon;
revoke insert, update, delete on public.integrations from authenticated, anon;

-- ---- Profiles: the email comes from the sign-in account, not from the user ----
revoke update on public.profiles from authenticated, anon;
grant update (full_name, job_title, phone, avatar_url, language, timezone) on public.profiles to authenticated;

-- ---- Members: admins change roles, never who a membership belongs to ----
revoke update on public.workspace_members from authenticated, anon;
grant update (role) on public.workspace_members to authenticated;

-- ---- Chat items: only the conversation's creator (or an owner/admin) edits them ----
drop policy if exists "items: contributors update" on public.conversation_items;
create policy "items: creator or admin update" on public.conversation_items
  for update to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.created_by = (select auth.uid()) or (select private.has_workspace_role(c.workspace_id, array['owner', 'admin']::public.workspace_role[])))
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.created_by = (select auth.uid()) or (select private.has_workspace_role(c.workspace_id, array['owner', 'admin']::public.workspace_role[])))
  ));

-- ---- Platform tables: approved, verified sessions only; agent ids stay on the server ----
create policy "mfa: two-step verified" on public.platform_settings as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy "mfa: two-step verified" on public.subscription_plans as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy "mfa: two-step verified" on public.agent_registry as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
revoke select on public.agent_registry from authenticated, anon;
grant select (key, name, description, category, enabled, sort, model, effort, updated_at) on public.agent_registry to authenticated;

-- ---- Invites approve an account only once its email is confirmed ----
create or replace function private.approve_invited(user_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.platform_accounts a
  set status = 'approved', reviewed_at = now(), status_reason = 'Invited to a workspace'
  where a.user_id = approve_invited.user_id
    and a.status = 'pending_approval'
    and exists (
      select 1 from public.workspace_invites i
      where lower(i.email) = lower(user_email) and i.status = 'pending' and i.expires_at > now()
    );
end;
$$;
revoke execute on function private.approve_invited(uuid, text) from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  ws_id uuid;
  open_signup boolean;
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

  select not coalesce((select s.require_approval from public.platform_settings s where s.id = 1), true) into open_signup;
  insert into public.platform_accounts (user_id, status, reviewed_at)
  values (new.id, case when open_signup then 'approved'::public.account_status else 'pending_approval'::public.account_status end,
          case when open_signup then now() end);

  -- Already confirmed (e.g. Google sign-in): an invite can approve straight away
  if new.email_confirmed_at is not null then
    perform private.approve_invited(new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function private.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform private.approve_invited(new.id, new.email);
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_confirmed();

-- Connections: server-only writes (their settings decide where decrypted secrets are sent)
drop policy if exists "integrations: admins create" on public.integrations;
drop policy if exists "integrations: admins update" on public.integrations;
drop policy if exists "integrations: admins delete" on public.integrations;
