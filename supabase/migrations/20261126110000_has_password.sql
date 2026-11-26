-- Tells the signed-in person whether their own account has a password
-- (accounts made with "Continue with Google" don't). Reveals nothing about anyone else.
create or replace function public.my_account_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.encrypted_password is not null and u.encrypted_password <> '' from auth.users u where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.my_account_has_password() from public, anon;
grant execute on function public.my_account_has_password() to authenticated;
