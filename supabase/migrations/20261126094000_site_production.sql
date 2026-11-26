-- Production publishing of website previews (AWS S3 + CloudFront; see src/lib/sites/production.ts)
alter table public.sites
  add column production_version int,
  add column production_url text,
  add column published_at timestamptz,
  add column custom_domain text check (custom_domain ~ '^([a-z0-9-]+\.)+[a-z]{2,}$');
