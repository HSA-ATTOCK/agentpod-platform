-- Custom agents may use a fixed list of READ-ONLY connected tools (chosen per agent).
alter table public.custom_agents add column tools text[] not null default '{}'
  check (tools <@ array['knowledge_search','memory_list','db_query','drive_search','drive_read','gmail_search','gmail_read','calendar_list_events']::text[]);
