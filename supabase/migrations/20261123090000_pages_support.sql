-- Support for the real Activity, Agents, Settings and team pages.

-- What happened in each task (shown on the Activity page)
alter table public.tasks add column steps jsonb not null default '[]'::jsonb;

-- "About your business" instructions Baba reads with every task
alter table public.workspaces
  add column business_context text not null default '' check (char_length(business_context) <= 4000);

-- Invited people can see (and accept) their own pending invites
create policy "invites: invitee reads own" on public.workspace_invites
  for select to authenticated
  using (status = 'pending' and lower(email) = lower((select auth.jwt() ->> 'email')));

-- Creates a personal workspace for the caller (used at sign-up, and if they end up with none)
create or replace function private.create_personal_workspace(uid uuid, display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (name, slug, created_by)
  values (
    left(display_name, 80) || '''s workspace',
    'ws-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    uid
  )
  returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, uid, 'owner');
  return ws_id;
end;
$$;
revoke execute on function private.create_personal_workspace(uuid, text) from public, anon, authenticated;

-- New user: profile, then join any workspaces they were invited to; otherwise their own workspace
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  joined int;
begin
  insert into public.profiles (id, email, full_name) values (new.id, new.email, display_name);

  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, new.id, i.role
  from public.workspace_invites i
  where i.status = 'pending' and i.expires_at > now() and lower(i.email) = lower(new.email)
  on conflict do nothing;
  get diagnostics joined = row_count;

  update public.workspace_invites set status = 'accepted'
  where status = 'pending' and expires_at > now() and lower(email) = lower(new.email);

  if joined = 0 then
    perform private.create_personal_workspace(new.id, display_name);
  end if;
  return new;
end;
$$;

-- Called by the app when a signed-in user has no workspace (e.g. after deleting theirs)
create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing uuid;
  display_name text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select workspace_id into existing from public.workspace_members where user_id = uid limit 1;
  if existing is not null then return existing; end if;
  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into display_name from public.profiles where id = uid;
  return private.create_personal_workspace(uid, coalesce(display_name, 'My'));
end;
$$;
revoke execute on function public.ensure_workspace() from public, anon;
grant execute on function public.ensure_workspace() to authenticated;

-- Accept an invite sent to the caller's email address
create or replace function public.accept_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv record;
begin
  select * into inv from public.workspace_invites
  where id = invite_id and status = 'pending' and expires_at > now()
    and lower(email) = lower((select auth.jwt() ->> 'email'));
  if inv is null then raise exception 'invite not found or expired'; end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set status = 'accepted' where id = invite_id;
  return inv.workspace_id;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Workspace name shown on an invite (the invitee isn't a member yet, so can't read it directly)
create or replace function public.my_invites()
returns table (id uuid, workspace_name text, role public.workspace_role, invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, w.name, i.role, i.created_at
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.status = 'pending' and i.expires_at > now()
    and lower(i.email) = lower((select auth.jwt() ->> 'email'));
$$;
revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
