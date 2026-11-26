-- Business memory and knowledge base (PRD §13), website previews with versions (PRD §9)
-- and workflow webhooks (PRD §12).

-- ---------------------------------------------------------------------------
-- Business memory: short facts Baba reuses (company, brand, audience, policies...)
-- ---------------------------------------------------------------------------

create table public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category text not null default 'fact' check (category in ('company', 'brand', 'products', 'audience', 'policy', 'style', 'fact', 'other')),
  content text not null check (char_length(content) between 1 and 2000),
  -- 'user' = typed or confirmed by a person; 'baba' = suggested by Baba and not yet confirmed
  source text not null default 'user' check (source in ('user', 'baba')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memory_entries_workspace_idx on public.memory_entries (workspace_id, created_at);
create index memory_entries_created_by_idx on public.memory_entries (created_by);
create trigger memory_entries_updated_at before update on public.memory_entries
  for each row execute function private.set_updated_at();
alter table public.memory_entries enable row level security;
create policy "memory: members read" on public.memory_entries for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "memory: contributors write" on public.memory_entries for insert to authenticated
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])));
create policy "memory: contributors update" on public.memory_entries for update to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])));
create policy "memory: contributors delete" on public.memory_entries for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])));
create policy "mfa: two-step verified" on public.memory_entries as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- ---------------------------------------------------------------------------
-- Knowledge base: documents split into chunks, searched with Postgres full-text search
-- ---------------------------------------------------------------------------

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  file_name text,
  mime_type text,
  char_count int not null default 0,
  chunk_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index knowledge_documents_workspace_idx on public.knowledge_documents (workspace_id, created_at desc);
create index knowledge_documents_created_by_idx on public.knowledge_documents (created_by);

create table public.knowledge_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position int not null,
  content text not null,
  search tsvector generated always as (to_tsvector('simple', content)) stored
);
create index knowledge_chunks_document_idx on public.knowledge_chunks (document_id, position);
create index knowledge_chunks_workspace_idx on public.knowledge_chunks (workspace_id);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin (search);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
create policy "knowledge: members read" on public.knowledge_documents for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "knowledge: contributors add" on public.knowledge_documents for insert to authenticated
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])));
create policy "knowledge: creator or admin delete" on public.knowledge_documents for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "chunks: members read" on public.knowledge_chunks for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "chunks: contributors add" on public.knowledge_chunks for insert to authenticated
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])));
create policy "mfa: two-step verified" on public.knowledge_documents as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy "mfa: two-step verified" on public.knowledge_chunks as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- ---------------------------------------------------------------------------
-- Website previews: each site has numbered versions; one is live on its preview link
-- Files are kept in the private "sites" storage bucket and served by the app.
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  -- The public preview address is /preview/<slug>/ (random, unguessable)
  slug text not null unique check (slug ~ '^[a-z0-9]{16,40}$'),
  current_version int,
  status text not null default 'preview' check (status in ('preview', 'production_requested', 'disabled')),
  expires_at timestamptz not null default now() + interval '30 days',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_workspace_idx on public.sites (workspace_id, created_at desc);
create index sites_conversation_idx on public.sites (conversation_id);
create index sites_created_by_idx on public.sites (created_by);
create trigger sites_updated_at before update on public.sites
  for each row execute function private.set_updated_at();

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version int not null,
  file_count int not null default 0,
  total_bytes bigint not null default 0,
  files jsonb not null default '[]',
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, version)
);
create index site_versions_workspace_idx on public.site_versions (workspace_id);
create index site_versions_created_by_idx on public.site_versions (created_by);

alter table public.sites enable row level security;
alter table public.site_versions enable row level security;
create policy "sites: members read" on public.sites for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "sites: admins update" on public.sites for update to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])))
  with check ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "sites: admins delete" on public.sites for delete to authenticated
  using ((select private.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
create policy "site versions: members read" on public.site_versions for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "mfa: two-step verified" on public.sites as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy "mfa: two-step verified" on public.site_versions as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- Private bucket: only the server (service role) reads and writes site files
insert into storage.buckets (id, name, public, file_size_limit)
values ('sites', 'sites', false, 10485760)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Workflow webhooks: POST to /api/hooks/<token> runs the workflow with the request body
-- Only a SHA-256 hash of the token is stored.
-- ---------------------------------------------------------------------------

alter table public.workflows add column webhook_token_hash text unique;
