-- Automated custom domains for live websites (ACM certificate + CloudFront distribution per domain)
alter table public.sites
  add column domain_status text check (domain_status in ('validating', 'deploying', 'live', 'failed')),
  add column domain_cert_arn text,
  add column domain_distribution_id text,
  add column domain_target text,
  add column domain_records jsonb;
