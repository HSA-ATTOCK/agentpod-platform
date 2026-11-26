-- Form submissions from Baba-built websites (inserted by the server through /api/forms/<slug>)
create table public.site_form_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  form_name text not null default 'form' check (char_length(form_name) <= 80),
  data jsonb not null check (pg_column_size(data) <= 20000),
  page text check (char_length(page) <= 300),
  created_at timestamptz not null default now()
);
create index site_form_submissions_site_idx on public.site_form_submissions (site_id, created_at desc);
create index site_form_submissions_workspace_idx on public.site_form_submissions (workspace_id);
alter table public.site_form_submissions enable row level security;
create policy "form submissions: members read" on public.site_form_submissions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "form submissions: admins delete" on public.site_form_submissions for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "mfa: two-step verified" on public.site_form_submissions as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
