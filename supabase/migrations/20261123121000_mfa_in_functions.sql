-- Security-definer functions skip RLS, so they check two-step verification themselves.

create or replace function public.transfer_ownership(ws uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not private.mfa_ok() then raise exception 'two-step verification required'; end if;
  if not exists (
    select 1 from public.workspace_members where workspace_id = ws and user_id = uid and role = 'owner'
  ) then
    raise exception 'only the owner can transfer ownership';
  end if;
  if new_owner = uid then raise exception 'you already own this workspace'; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = ws and user_id = new_owner) then
    raise exception 'that person is not a member of this workspace';
  end if;
  update public.workspace_members set role = 'owner' where workspace_id = ws and user_id = new_owner;
  update public.workspace_members set role = 'admin' where workspace_id = ws and user_id = uid;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  blocked text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not private.mfa_ok() then raise exception 'two-step verification required'; end if;

  select w.name into blocked
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid and m.role = 'owner'
    and exists (select 1 from public.workspace_members o where o.workspace_id = m.workspace_id and o.user_id <> uid)
  limit 1;
  if blocked is not null then
    raise exception 'transfer ownership of "%" before deleting your account', blocked;
  end if;

  delete from public.workspaces w
  where exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = uid)
    and not exists (select 1 from public.workspace_members o where o.workspace_id = w.id and o.user_id <> uid);

  delete from auth.users where id = uid;
end;
$$;

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
  if not private.mfa_ok() then raise exception 'two-step verification required'; end if;
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
  if not private.mfa_ok() then raise exception 'two-step verification required'; end if;
  select workspace_id into existing from public.workspace_members where user_id = uid limit 1;
  if existing is not null then return existing; end if;
  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into display_name from public.profiles where id = uid;
  return private.create_personal_workspace(uid, coalesce(display_name, 'My'));
end;
$$;

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
  where private.mfa_ok()
    and i.status = 'pending' and i.expires_at > now()
    and lower(i.email) = lower((select auth.jwt() ->> 'email'));
$$;
