-- The platform admin can choose each agent's model without code changes (null = the default in baba/team.mjs)
alter table public.agent_registry
  add column model text check (model in ('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5')),
  add column effort text check (effort in ('low', 'medium', 'high'));
