-- Account management: keep profile email in sync, delete own account, transfer ownership.

-- When someone confirms a new email address, update their profile too
create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.sync_profile_email();

-- Make another member the owner (the current owner becomes an admin)
create or replace function public.transfer_ownership(ws uuid, new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
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
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- Delete the caller's account. Workspaces they alone use are deleted with it;
-- if they own a workspace other people use, they must transfer ownership first.
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
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
