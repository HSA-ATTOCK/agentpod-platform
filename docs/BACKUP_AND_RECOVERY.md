# Backup and recovery

## What holds data

| Data | Where | Backed up by |
|---|---|---|
| Accounts, workspaces, conversations, tasks, workflows, memory, knowledge, audit log | Supabase Postgres | Supabase daily backups (Pro plan and up); Point-in-Time Recovery as an add-on |
| Avatars, logos, website preview files | Supabase Storage | Same project; download the `sites` bucket for extra safety |
| Live websites | AWS S3 (versioned bucket) | S3 versioning: every overwritten file is kept |
| Files Baba made (DOCX, PDF, XLSX …) | Claude Files API, per conversation | Kept by Anthropic for the session; users download what they need |
| Connected-account secrets | Postgres (`integration_credentials`, AES-256-GCM) | Database backups. Useless without `INTEGRATIONS_ENCRYPTION_KEY` |
| Agent definitions | `baba/team.mjs` in git + Claude | Git; `npm run baba:setup` recreates them |
| Infrastructure | `infrastructure/terraform` in git | Git; Terraform state in an S3 backend |

**Keep `INTEGRATIONS_ENCRYPTION_KEY` safe and separate** (e.g. a password manager). If it's lost, every connected account must be connected again; nothing else is lost.

## Recommended setup

1. Supabase: use a paid plan for daily backups; turn on Point-in-Time Recovery for production.
2. Weekly logical backup kept outside Supabase:
   ```bash
   pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --file baba-$(date +%F).dump
   ```
   Store it encrypted (e.g. S3 with versioning and a 90-day lifecycle rule).
3. Terraform state in a versioned S3 bucket (see `versions.tf`).

## Restoring

- **A mistake in a few rows:** restore a Point-in-Time copy into a new Supabase project, copy the rows back. Never restore over production without a fresh backup first.
- **Whole database:** Supabase dashboard → Database → Backups → Restore; or `pg_restore --clean --no-owner -d "$SUPABASE_DB_URL" baba-YYYY-MM-DD.dump` into a fresh project, then point the app at it.
- **Live website:** publish an older version from the Websites page (rollback); or restore an object version in S3.
- **App deployment:** ECS rolls back unhealthy deployments automatically; to go back on purpose, redeploy an older image tag (`image_tag` in Terraform or the ECS console).
- **Agents:** `npm run baba:setup` recreates or updates them from git.

## Disaster recovery targets (suggested)

| | Target |
|---|---|
| Recovery point (data you might lose) | ≤ 24 h with daily backups; minutes with Point-in-Time Recovery |
| Recovery time (back online) | ≤ 4 h: new Supabase project from backup + `terraform apply` + deploy |

Test a restore at least every quarter into a scratch project and note how long it took.
