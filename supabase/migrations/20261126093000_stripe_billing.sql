-- Stripe billing: plans link to a Stripe Price; each workspace has a billing record.
alter table public.subscription_plans add column stripe_price_id text check (stripe_price_id ~ '^price_[A-Za-z0-9]+$');

create table public.workspace_billing (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text,
  plan_id uuid references public.subscription_plans (id) on delete set null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index workspace_billing_plan_idx on public.workspace_billing (plan_id);
alter table public.workspace_billing enable row level security;
create policy "billing: members read" on public.workspace_billing for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));
create policy "mfa: two-step verified" on public.workspace_billing as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- Stripe webhook events already handled (Stripe can send the same event more than once).
-- RLS on with no policies: only the server (secret key) uses it.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
