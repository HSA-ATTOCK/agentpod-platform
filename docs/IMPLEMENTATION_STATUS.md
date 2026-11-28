# Implementation status

The product measured against the Master PRD ("Project Nexus"). Updated 26 Nov 2026.

**Statuses**
- **VERIFIED**: built and tested end to end (browser tests against the real database, or unit/database tests).
- **IMPLEMENTED**: built, typechecks, lints and builds, but not run against the live outside service from the development container, because that needs your keys or accounts.
- **PARTIAL**: part of the requirement is done (the note says what's missing).
- **NOT_STARTED**: not built.

Everything marked IMPLEMENTED turns on when its settings are added (see `.env.example` and `docs/DEPLOYMENT_GUIDE.md`).

## Architecture decisions

| PRD suggestion | What we use | Why |
|---|---|---|
| Python FastAPI backend | Next.js 16 route handlers (TypeScript) | One codebase; a modular monolith, as the PRD recommends. |
| LangGraph orchestration | Claude Managed Agents (multi-agent sessions) | Hosted, sandboxed execution per conversation with spending caps; no agent servers to run. |
| Postgres on RDS + custom auth | Supabase (Postgres, Auth, Storage, pgvector) | Row Level Security on every table, MFA, email verification. |
| Provider-independent model gateway | `src/lib/ai/gateway.ts`: Anthropic, OpenAI, Google Gemini (retries, backoff, fallback models, admin-set prices) | Baba and its built-in specialists run on Claude Managed Agents (Claude models only: Opus/Sonnet/Haiku per agent). Custom agents can run on any allowed provider. Embeddings: OpenAI or Voyage. |
| Celery/Redis queues | The workflow scheduler claims each slot in the database; Claude runs the work | Never runs a slot twice; no separate queue to operate. No dead-letter queue. |
| AWS (ECS, S3, CloudFront, Secrets Manager, CloudWatch) | Terraform in `infrastructure/terraform` | Validated with `terraform validate`; not applied (no AWS account here). |

## Status by area

### Accounts and administration (PRD §3, §15)
| Feature | Status |
|---|---|
| Registration, email verification, password reset, two-step verification | VERIFIED |
| Approval workflow, enforced by the database (pending users get no data) | VERIFIED |
| Waiting screen; admin notified; approve/reject/suspend emails | VERIFIED (screen, database rules); IMPLEMENTED (emails) |
| Master admin bootstrap (`npm run admin:bootstrap`) | IMPLEMENTED |
| Admin area: overview, registrations, users, workspaces, agents (on/off + model), plans, usage & costs, audit log, system health, settings | IMPLEMENTED (non-admins blocked: VERIFIED) |
| Workspaces, invitations, roles (owner/admin/member/viewer) | VERIFIED |
| Maintenance mode, announcement banner | IMPLEMENTED |

### Chat and tasks (PRD §4, §8)
| Feature | Status |
|---|---|
| Streaming chat, attachments, file deliverables, approvals, progress, background tasks | VERIFIED |
| Plan first for complex work, QA before delivery | IMPLEMENTED (Baba's instructions) |
| Search inside messages; edit and retry the last message | VERIFIED |
| Task statuses, cost per task, Activity | VERIFIED |
| Voice input (dictation in the chat box) | VERIFIED |
| Getting-started checklist; one-click task ideas matched to connected tools | VERIFIED (browser-tested) |
| Daily briefing (on/off and hour in Settings; bell + email) | PARTIAL: settings screen, scheduling and time-zone logic tested; sending needs SUPABASE_SECRET_KEY, not tried here |
| Voice output | NOT_STARTED (PRD: future release) |

### Agents (PRD §5, §6, §28)
| Feature | Status |
|---|---|
| Baba plus 9 specialists: Research Analyst, Writer, Data Analyst, QA Reviewer, Website Builder, Mobile App Builder, UI/UX Designer, Marketing & SEO, Finance Analyst | IMPLEMENTED |
| Agent registry; on/off and model per agent from Admin | IMPLEMENTED |
| Per-workspace allowed agents (a disallowed specialist stops the task) | IMPLEMENTED |
| Custom agent builder (instructions, model, web, read-only connected tools, cost limit, 8 templates) | IMPLEMENTED (screens, templates and validation VERIFIED) |
| Custom agents on OpenAI / Gemini through the gateway, with fallback models | IMPLEMENTED (gateway unit-tested against a fake provider) |
| CRM/Sales, Support, Scheduling, Operations and Social Media agents | IMPLEMENTED as ready-made custom agent templates (with suitable connected tools); Baba also covers these directly with its tools. |

### Integrations (PRD §7)
| Feature | Status |
|---|---|
| Google: Gmail, Drive (long docs read in parts), Calendar; several accounts; per-workspace app | VERIFIED |
| Slack, HubSpot, Microsoft 365 (Outlook mail and calendar): per-workspace app, several accounts, token refresh, 12 tools | IMPLEMENTED (sign-in links and checks unit-tested) |
| Any REST API via an encrypted, host-locked API key | IMPLEMENTED |
| PostgreSQL / MySQL, read-only | IMPLEMENTED (SQL safety unit-tested) |
| Revocation, reconnect state, audit of connections and every tool call | IMPLEMENTED |
| QuickBooks, Xero (reports and records), Shopify (orders, products, customers, inventory, sales totals) — read-only | IMPLEMENTED (Shopify signature check and store addresses unit-tested) |
| Notion, Teams, Search Console, Google Ads, Salesforce | NOT_STARTED as native integrations; usable through API keys where the service offers them |
| MCP servers | NOT_STARTED |

### Websites and apps (PRD §9, §10)
| Feature | Status |
|---|---|
| Build → QA → preview link, versions, rollback, sandboxed previews | IMPLEMENTED (unpacking safety VERIFIED) |
| Publish live on AWS (S3 + CloudFront, `https://<site>.<domain>`), with approval; rollback by republishing | IMPLEMENTED |
| Custom domains: certificate request, DNS records shown, CloudFront distribution created when issued, live status | IMPLEMENTED (Terraform permissions validated) |
| Mobile apps (Expo source + web preview) | IMPLEMENTED |
| App Store / Play Store publishing | NOT_STARTED (needs the customer's developer accounts; never automatic) |
| Forms on generated websites (stored, emailed, CSV export, spam protection) | IMPLEMENTED (unit-tested) |
| Websites with their own custom server code or database | NOT_STARTED (sites are static plus Baba's form backend) |

### Data, memory and knowledge (PRD §11, §13)
| Feature | Status |
|---|---|
| Business memory (Baba's suggestions marked until confirmed) | VERIFIED |
| Knowledge base: keyword search | VERIFIED |
| Knowledge base: search by meaning (pgvector) | IMPLEMENTED (database function and access rules VERIFIED) |
| PDF and Word (.docx) upload into the knowledge base | VERIFIED (text extraction tested; scanned PDFs get a clear message) |

### Workflows (PRD §12, §27)
| Feature | Status |
|---|---|
| Schedules (workspace time zone), run now, results, webhooks | VERIFIED |
| Steps: do / only continue if / ask me first (approval checkpoint) / notify me; version history and restore | VERIFIED |
| Created and edited from chat | VERIFIED |
| Visual editor: drag-and-drop steps with a flow diagram | VERIFIED |

### Billing (PRD §15.4, §16)
| Feature | Status |
|---|---|
| Spend caps (conversation, daily, monthly), plan quotas (enforced by the database), 80%/100% warnings, Usage & billing page | VERIFIED |
| Plans configured by the admin | IMPLEMENTED |
| Stripe Checkout, customer portal, signed de-duplicated webhook, invoices | IMPLEMENTED (signature checks unit-tested) |

### Security, privacy, operations (PRD §18, §24, §30)
| Feature | Status |
|---|---|
| RLS everywhere; encrypted secrets; approvals; append-only audit log | VERIFIED |
| Security headers; rate limit on Baba requests | VERIFIED |
| Data export; account deletion; sign out of all devices | VERIFIED |
| Health endpoint; structured error logs; alert webhook; CloudWatch alarms | VERIFIED (health); IMPLEMENTED (alerts) |
| Docker image (standalone server, non-root, health check) | PARTIAL: the standalone server was built and run and its health check passed; the full image build was blocked here by registry rate limits |
| Terraform for AWS (ECS Fargate, ALB + HTTPS, ECR, Secrets Manager, S3 + CloudFront, IAM, alarms) | IMPLEMENTED (`terraform validate` passes) |
| CI on every push; manual deploy workflow (OIDC, automatic rollback) | VERIFIED (CI); IMPLEMENTED (deploy) |
| Unit tests (`npm test`: 30 tests); load test (`npm run test:load`) | VERIFIED |
| Internal security review (3 reviewers, 38 findings) | VERIFIED: all fixed except the optional separate preview domain; see `docs/SECURITY_GUIDELINES.md` |
| Backup/restore runbook | IMPLEMENTED (`docs/BACKUP_AND_RECOVERY.md`); restores not rehearsed |
| Independent security assessment / SOC 2 | NOT_STARTED (needs an outside auditor) |

## What's needed from you to switch everything on

1. `npm run baba:setup` and `npm run admin:bootstrap -- your@email`. Run `npm run baba:setup` again even if you ran it before: it limits the agents' sandbox network and updates the tool descriptions.
2. Optional keys, as you need them:
   - Stripe (payments)
   - OpenAI or Voyage (search by meaning)
   - `ALERT_WEBHOOK_URL` (error alerts)
3. Developer apps for Slack, HubSpot and Microsoft. Each workspace adds its own through the setup card.
4. For production: an AWS account and a domain, then `docs/DEPLOYMENT_GUIDE.md` part C.
