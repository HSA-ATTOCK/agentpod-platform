-- Profile photos and workspace logos (public images, max 2 MB, PNG/JPEG/WebP).
-- Files live in a folder named after the user id (avatars) or workspace id (logos).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.mfa_ok()));
create policy "avatars: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.mfa_ok()));
create policy "avatars: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.mfa_ok()));

create or replace function private.can_manage_logo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder !~ '^[0-9a-f-]{36}$' then return false; end if;
  return private.mfa_ok() and private.has_workspace_role(folder::uuid, array['owner', 'admin']::public.workspace_role[]);
end;
$$;
revoke execute on function private.can_manage_logo(text) from public, anon;
grant execute on function private.can_manage_logo(text) to authenticated;

create policy "logos: admins insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and private.can_manage_logo(name));
create policy "logos: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and private.can_manage_logo(name));
create policy "logos: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and private.can_manage_logo(name));
