-- Models from other providers that the platform admin allows for custom agents, with their prices
alter table public.platform_settings add column external_models jsonb not null default '[]'
  check (jsonb_typeof(external_models) = 'array' and jsonb_array_length(external_models) <= 20);

alter table public.custom_agents drop constraint if exists custom_agents_model_check;
alter table public.custom_agents
  add column provider text not null default 'anthropic' check (provider in ('anthropic', 'openai', 'google')),
  add constraint custom_agents_model_check check (char_length(model) between 3 and 80);
