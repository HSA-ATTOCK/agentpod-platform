-- Search by meaning for the knowledge base (pgvector). Embeddings are 1024 numbers per passage,
-- made by the configured provider (src/lib/ai/embeddings.ts); without one, keyword search is used.
create extension if not exists vector with schema extensions;

alter table public.knowledge_chunks add column embedding extensions.vector(1024);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Nearest passages by meaning. SECURITY INVOKER: Row Level Security still decides what the caller can see.
create or replace function public.match_knowledge_chunks(ws uuid, query_embedding extensions.vector(1024), match_count int default 8)
returns table (id bigint, document_id uuid, chunk_position int, content text, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.document_id, c.position, c.content, 1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge_chunks c
  where c.workspace_id = ws and c.embedding is not null
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_knowledge_chunks(uuid, extensions.vector, int) from public, anon;
grant execute on function public.match_knowledge_chunks(uuid, extensions.vector, int) to authenticated, service_role;
