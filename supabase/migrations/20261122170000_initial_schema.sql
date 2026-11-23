-- Baba — initial database schema
-- Multi-tenant: every business is a workspace. Row Level Security (RLS) ensures
-- people only ever see data from workspaces they belong to.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per signed-up user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  job_title text,
  phone text,
  avatar_url text,
  language text not null default 'en-GB',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  industry text,
  company_size text,
  timezone text not null default 'UTC',
  logo_url text,
  -- AI & spending settings
  task_cap_usd numeric(10, 2) not null default 1.00 check (task_cap_usd > 0 and task_cap_usd <= 1000),
  monthly_limit_usd numeric(10, 2) not null default 50.00 check (monthly_limit_usd > 0),
  quality text not null default 'balanced' check (quality in ('economy', 'balanced', 'best')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

create index workspace_invites_workspace_idx on public.workspace_invites (workspace_id);
create unique index workspace_invites_pending_unique
  on public.workspace_invites (workspace_id, lower(email)) where status = 'pending';

-- Membership checks used by the RLS policies. SECURITY DEFINER avoids
-- policies on workspace_members recursively checking themselves.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(ws uuid, allowed public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any (allowed)
  );
$$;

-- ---------------------------------------------------------------------------
-- Ask Baba: conversations, their items, tasks (activity) and files (projects)
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null default 'New chat',
  -- Claude Managed Agents session behind this conversation
  claude_session_id text unique,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  cap_cents integer check (cap_cents > 0),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_workspace_idx on public.conversations (workspace_id, updated_at desc);
create index conversations_created_by_idx on public.conversations (created_by);

create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- One row per thing shown in the chat (user message, progress, answer, file, approval…).
-- `data` holds the item exactly as the UI renders it (see src/types/chat.ts).
create table public.conversation_items (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id text not null,
  type text not null,
  data jsonb not null,
  position bigint generated always as identity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, client_id)
);

create index conversation_items_conversation_idx on public.conversation_items (conversation_id, position);
create index conversation_items_workspace_idx on public.conversation_items (workspace_id);

create trigger conversation_items_updated_at before update on public.conversation_items
  for each row execute function public.set_updated_at();

create type public.task_status as enum ('running', 'succeeded', 'failed', 'paused');

-- One row per request to Baba (what the Activity page lists).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  workflow_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  request text not null,
  status public.task_status not null default 'running',
  agents text[] not null default '{}',
  error text,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  cap_cents integer check (cap_cents > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index tasks_workspace_idx on public.tasks (workspace_id, started_at desc);
create index tasks_conversation_idx on public.tasks (conversation_id);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_workflow_idx on public.tasks (workflow_id);

-- Files Baba created (what the Projects page lists).
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  claude_file_id text not null,
  name text not null,
  kind text not null default 'other' check (kind in ('document', 'spreadsheet', 'presentation', 'website', 'app', 'other')),
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, claude_file_id)
);

create index files_workspace_idx on public.files (workspace_id, created_at desc);
create index files_conversation_idx on public.files (conversation_id);
create index files_task_idx on public.files (task_id);

-- ---------------------------------------------------------------------------
-- Workflows, integrations, notification preferences
-- ---------------------------------------------------------------------------

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  instruction text not null check (char_length(instruction) between 1 and 20000),
  frequency text not null default 'manual' check (frequency in ('manual', 'daily', 'weekly', 'monthly')),
  day_of_week smallint check (day_of_week between 0 and 6),
  time_of_day time,
  cap_usd numeric(10, 2) not null default 1.00 check (cap_usd > 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_workspace_idx on public.workflows (workspace_id);
create index workflows_created_by_idx on public.workflows (created_by);

create trigger workflows_updated_at before update on public.workflows
  for each row execute function public.set_updated_at();

alter table public.tasks
  add constraint tasks_workflow_fk foreign key (workflow_id) references public.workflows (id) on delete set null;

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index integrations_connected_by_idx on public.integrations (connected_by);

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create index notification_preferences_workspace_idx on public.notification_preferences (workspace_id);

-- ---------------------------------------------------------------------------
-- New user: profile + their own workspace (as owner)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  ws_id uuid;
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_items enable row level security;
alter table public.tasks enable row level security;
alter table public.files enable row level security;
alter table public.workflows enable row level security;
alter table public.integrations enable row level security;
alter table public.notification_preferences enable row level security;

-- Profiles: see yourself and people in your workspaces; edit only yourself
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Workspaces: members read; owners/admins update; owners delete
create policy "workspaces: members read" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces: admins update" on public.workspaces
  for update to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));
create policy "workspaces: owners delete" on public.workspaces
  for delete to authenticated using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

-- Members: members see the team; owners/admins manage it (owners can't be removed by admins)
create policy "members: members read" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members: admins update" on public.workspace_members
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]) and role <> 'owner')
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]) and role <> 'owner');
create policy "members: admins remove, anyone leaves" on public.workspace_members
  for delete to authenticated
  using (
    (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]) and role <> 'owner')
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- Invites: owners/admins manage
create policy "invites: admins read" on public.workspace_invites
  for select to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "invites: admins create" on public.workspace_invites
  for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "invites: admins update" on public.workspace_invites
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Conversations: members read; non-viewers create; creators or admins update/delete
create policy "conversations: members read" on public.conversations
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "conversations: contributors create" on public.conversations
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
  );
create policy "conversations: creator or admin update" on public.conversations
  for update to authenticated
  using (created_by = (select auth.uid()) or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.is_workspace_member(workspace_id));
create policy "conversations: creator or admin delete" on public.conversations
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Conversation items: follow the parent conversation's workspace
create policy "items: members read" on public.conversation_items
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "items: contributors write" on public.conversation_items
  for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.workspace_id = conversation_items.workspace_id)
  );
create policy "items: contributors update" on public.conversation_items
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));

-- Tasks and files: members read; contributors record their own work
create policy "tasks: members read" on public.tasks
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "tasks: contributors create" on public.tasks
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
  );
create policy "tasks: creator or admin update" on public.tasks
  for update to authenticated
  using (created_by = (select auth.uid()) or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.is_workspace_member(workspace_id));

create policy "files: members read" on public.files
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "files: contributors create" on public.files
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[]));
create policy "files: admins delete" on public.files
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Workflows: members read; contributors create; creator or admin change
create policy "workflows: members read" on public.workflows
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workflows: contributors create" on public.workflows
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']::public.workspace_role[])
  );
create policy "workflows: creator or admin update" on public.workflows
  for update to authenticated
  using (created_by = (select auth.uid()) or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.is_workspace_member(workspace_id));
create policy "workflows: creator or admin delete" on public.workflows
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Integrations: members read; owners/admins manage
create policy "integrations: members read" on public.integrations
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "integrations: admins create" on public.integrations
  for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "integrations: admins update" on public.integrations
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));
create policy "integrations: admins delete" on public.integrations
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']::public.workspace_role[]));

-- Notification preferences: only your own
create policy "notifications: own read" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: own insert" on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy "notifications: own update" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

-- The helper functions are only for RLS and signed-in users
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
