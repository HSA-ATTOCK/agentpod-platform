# Implementation status

Tracks the product against the Master PRD ("Project Nexus"). Updated 23 Nov 2026.

**Statuses:** VERIFIED = built and tested end to end · IMPLEMENTED = built, typechecks and builds,
but not tested against the live external service from the dev environment · PARTIAL = part of the
requirement is done · BLOCKED = needs something we don't have yet (credentials, accounts, budget) ·
NOT_STARTED.

## Architecture decisions (differences from the PRD's suggested stack)

| PRD suggestion | What we use | Why |
|---|---|---|
| Python FastAPI backend | Next.js 16 route handlers (TypeScript) | One codebase; a modular monolith as the PRD recommends. |
| LangGraph orchestration | Claude Managed Agents (multi-agent sessions) | Hosted, sandboxed execution per conversation with spending caps; no agent servers to run. |
| Custom auth / Postgres on RDS | Supabase (Postgres + Auth + Storage) | Postgres with Row Level Security on every table; MFA; email verification. |
| pgvector RAG | Postgres full-text search | No embeddings provider is configured yet; full-text search is real, tenant-isolated and needs no extra service. pgvector can be added later. |
| AWS S3 / ECS / CloudFront previews | Supabase Storage + sandboxed `/preview/<id>` route | Works today without AWS. AWS deployment is BLOCKED (no AWS account/credentials). |
| Provider-independent model gateway | Claude only | PARTIAL: agents and models are configured in `baba/team.mjs`; a second provider isn't wired. |

## Phase status

### Phase 1 — Authentication, registration, master administration
| Feature | Status | Notes |
|---|---|---|
| Registration, login, email verification, password reset | VERIFIED | Supabase Auth. |
| Two-step verification (TOTP), enforced in the database | VERIFIED | |
| Account states (pending, approved, rejected, suspended, deactivated) | VERIFIED | `platform_accounts`. "Pending email verification" is Supabase's own unconfirmed state. |
| Backend enforcement for unapproved users | VERIFIED | Every table's restrictive RLS policy requires an approved account; tested: pending user sees 0 rows and can't insert. APIs return 401/403. |
| Pending-approval screen | VERIFIED | `/pending` (also shows rejected, suspended and maintenance messages). |
| Admin notified of new registrations | IMPLEMENTED | Bell notification + email (needs Gmail settings and the secret key). |
| Approve / reject / suspend / reactivate, email to the user | IMPLEMENTED | `/admin/registrations`, `/admin/users`. Not clicked end to end here (no secret key in the dev container). |
| Master admin bootstrap (no public route) | IMPLEMENTED | `npm run admin:bootstrap -- email`. |
| Admin dashboard (separate area) | IMPLEMENTED | `/admin`: overview, registrations, users, workspaces, agents, plans, usage & costs, audit log, health, settings. Non-admins get a 404 (tested). |
| RBAC and tenants | VERIFIED | Workspaces with owner/admin/member/viewer. Platform admin is separate from workspace roles. |

### Phase 2 — Core app and conversational workspace
| Feature | Status | Notes |
|---|---|---|
| Public website: Home, Features, AI Agents, Integrations, Use cases, Pricing, About, Contact, Sign up/in, Privacy, Terms | VERIFIED | All return 200. Contact form emails `CONTACT_EMAIL`. Legal pages contain placeholders. |
| Chat with streaming, attachments, files, approvals, task progress, history, rename/delete | VERIFIED | Tasks keep running when you switch chats. |
| Conversation search | VERIFIED | Top-bar search covers titles, tasks, files, workflows and words inside messages. |
| Retry / edit the last message | VERIFIED | Retry re-sends; Edit puts the text back in the box (a Claude session can't be rewound, so it continues the conversation). |
| In-app notifications | VERIFIED | Bell shows task events + `notifications` table. Preferences for emails exist. |
| Responsive layouts | VERIFIED | Checked at 390 px. |

### Phase 3 — AI gateway, agent registry, orchestrator
| Feature | Status | Notes |
|---|---|---|
| Orchestrator (Baba) delegating to specialists | IMPLEMENTED | Managed Agents multi-agent. |
| Specialists | IMPLEMENTED | Research Analyst, Writer, Data Analyst, QA Reviewer, Website Builder, UI/UX Designer, Marketing & SEO, Finance Analyst. Run `npm run baba:setup` to publish. |
| Plan first for complex tasks, QA before delivery | IMPLEMENTED | Instructions in Baba's system prompt (model-followed, not code-enforced). |
| Agent registry + global on/off | IMPLEMENTED | `agent_registry`; switching off rewrites Baba's team on Claude. |
| Per-workspace agent restrictions | IMPLEMENTED | Enforced in code: if Baba starts a blocked specialist, the task is stopped. |
| Agent versioning | PARTIAL | Claude keeps agent versions; source of truth is `baba/team.mjs` in git. No in-app editor for instructions. |
| Task queue / retries | PARTIAL | Claude runs the session; scheduler claims slots so runs never double-run. No dead-letter queue. |
| Execution logs, cost per task | VERIFIED | `tasks` table, Activity page. |
| Second AI provider / model fallback | NOT_STARTED | |

### Custom agent builder (PRD §28)
| Feature | Status | Notes |
|---|---|---|
| Create / edit / switch off / delete custom agents (owners & admins) | IMPLEMENTED | AI Agents page → "Your own agents", with 3 templates. Each is a real Claude agent; saving publishes a new version. Not created end to end here (no Claude key in the dev container). |
| Name, description, instructions, model, web access, cost limit per run | IMPLEMENTED | Platform safety rules are always added above the business's instructions. |
| Baba delegates to them (`run_custom_agent`) | IMPLEMENTED | Runs in a separate session with its own budget (never above the workspace's cap), workspace limits checked first, cost added to the task, files copied back, every run audited. |
| Custom agents use connected tools (Gmail, databases…) | NOT_STARTED | Deliberately no access to secrets or connections for now. |

### Phase 4 — Integrations
| Feature | Status | Notes |
|---|---|---|
| Google (Gmail, Drive, Sheets via Drive, Calendar), several accounts, own Google app per workspace | VERIFIED | Sending email and creating events need approval. Long Google Docs are read in parts. |
| Any REST API by API key (host-locked, encrypted) | IMPLEMENTED | |
| PostgreSQL / MySQL (read-only) | IMPLEMENTED | Secure chat form; SQL checks tested; read-only transaction + timeout + row limit; private networks refused. Not tested against a live customer database here. |
| Encrypted credentials (AES-256-GCM, server-only table) | VERIFIED | |
| Revocation | VERIFIED | Disconnect on the Integrations page. |
| Integration audit log | IMPLEMENTED | Database connections and every tool call are audited. |
| Webhooks (incoming) | IMPLEMENTED | Workflow webhook links, hashed tokens, rate-limited. |
| Slack, GitHub, HubSpot, QuickBooks… native | NOT_STARTED | Usable today through API keys where the service supports them. |
| MCP servers | NOT_STARTED | |

### Phase 5 — Website builder and deployment
| Feature | Status | Notes |
|---|---|---|
| Website generation (Designer → Builder → QA) | IMPLEMENTED | Static sites. |
| Preview links, versions, rollback | IMPLEMENTED | `/preview/<id>`, sandboxed CSP, 30-day expiry, Websites page. Unzip safety tested. |
| Approval before production publishing / custom domains / AWS | BLOCKED | Needs an AWS account (S3, CloudFront, ACM, Route 53) and a preview domain. |
| Dynamic sites with backends/databases | NOT_STARTED | |

### Phase 6 — Data analyst and finance
| Feature | Status | Notes |
|---|---|---|
| Data Analyst, Finance Analyst | IMPLEMENTED | Spreadsheets, charts, XLSX/PDF reports from uploaded files or database queries. |
| Database connection wizard, read-only profiles | IMPLEMENTED | See Phase 4. |
| Accounting integrations (QuickBooks, Xero, Stripe) | NOT_STARTED | |

### Phase 7 — Marketing, SEO, CRM
| Feature | Status | Notes |
|---|---|---|
| Marketing & SEO specialist (audits, plans, copy) | IMPLEMENTED | No paid keyword data; it says so. |
| Search Console, Analytics, Ads, CRM integrations | NOT_STARTED | |

### Phase 8 — Workflow automation
| Feature | Status | Notes |
|---|---|---|
| Saved workflows, schedules in the workspace timezone, run now, results | VERIFIED | |
| Create and edit workflows from chat | VERIFIED | |
| Webhook triggers | IMPLEMENTED | |
| Branching, loops, visual editor | NOT_STARTED | Each workflow is one instruction Baba carries out. |

### Phase 9 — Mobile apps and more agents
NOT_STARTED (mobile builds, app store) except the extra agents listed in Phase 3.

### Phase 10 — Billing and usage
| Feature | Status | Notes |
|---|---|---|
| Usage metering per task | VERIFIED | Claude-reported cost. |
| Per-task cap, monthly limit, daily limit, plan limits | IMPLEMENTED | Checked on the server before every task; the stricter of workspace and platform limits applies. |
| Plans configurable by the admin (no hard-coded prices) | IMPLEMENTED | `subscription_plans`, `/admin/plans`. |
| Admin cost dashboard | IMPLEMENTED | `/admin/usage` (by user, workspace, agent). |
| Workspace Usage & billing page | VERIFIED | Spend vs limits, plan allowances, daily chart, by person. |
| Plan quotas (workflows, connections, previews) | VERIFIED | Enforced by database triggers (workflows, connections) and on publish (previews). |
| Spending warnings at 80% / 100% | IMPLEMENTED | Bell + email to owners/admins, once per month each. |
| Payments, invoices (Stripe) | BLOCKED | Needs a Stripe account; deferred by the owner. |

### Phase 11 — Teams, memory, knowledge
| Feature | Status | Notes |
|---|---|---|
| Invitations, roles, shared integrations | VERIFIED | |
| Business memory (editable, Baba's suggestions marked) | VERIFIED | Memory page tested; added to each new conversation. |
| Knowledge base with search | VERIFIED | Full-text search tested. Text files and pasted text; PDFs/Word via paste or chat attachments. |
| Semantic (vector) search | NOT_STARTED | |

### Phase 12 — Production hardening
| Feature | Status | Notes |
|---|---|---|
| Audit log (append-only, tamper-resistant) | VERIFIED | Updates and deletes refused by the database. |
| Maintenance mode, announcements, system health | IMPLEMENTED | |
| Rate limiting | PARTIAL | Baba requests (20/min, 300/hour per person), contact form, webhooks. In-memory per server instance. |
| Security headers | VERIFIED | nosniff, frame-deny, referrer, permissions and HSTS on every page. |
| Data export / account deletion | VERIFIED | Profile → Download my data (no secrets included); delete account; sign out of all devices. |
| Monitoring, backups, disaster recovery, load tests | NOT_STARTED | Supabase provides daily backups on paid plans. |
| CI | IMPLEMENTED | GitHub Actions: typecheck, lint, unit tests, build on every push. |
| Automated tests | PARTIAL | `npm test`: SQL safety, host blocking, Google links, website unpacking, chunking, limits, schedules. Browser tests run manually. |
| Docker, Terraform | NOT_STARTED | |

## What's needed from the owner to continue

1. Run `npm run baba:setup` (new agents and tools) and `npm run admin:bootstrap -- your@email`.
2. An AWS account and a domain for production website hosting.
3. A Stripe account when you're ready to charge.
4. Developer apps for each native integration you want next (Slack, HubSpot, QuickBooks…).
