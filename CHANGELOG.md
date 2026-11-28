# Changelog

## 2026-11-28
- Getting-started checklist on the Ask screen (ticks off steps by itself; can be hidden).
- One-click task ideas that match the workspace's connected tools.
- Daily briefing: calendar, unread email, overdue invoices, shop orders and Baba's activity, in the bell menu and by email. Switch it on or off and pick the hour in Settings → Notifications.
- Profile: no password form for accounts that sign in only with Google.

## 2026-11-26 (later)
- Knowledge base accepts PDF and Word files.
- Forms on Baba-built websites: stored, emailed to owners, CSV download, spam protection.
- QuickBooks, Xero and Shopify connections (read-only).
- Provider-independent AI gateway: custom agents on OpenAI or Google Gemini, with admin-set prices and fallback models.
- Visual workflow editor (drag and drop, flow diagram); voice dictation in the chat; five more custom agent templates.
- Automated custom domains for live websites (certificate + CloudFront).
- Internal security review: 38 findings fixed. Highlights:
  - Every API-key request now needs approval, and approval cards show the full message.
  - Database connections have encryption modes (verify / require / off) and stricter query checks.
  - The agents' sandbox network is limited to package registries. **Run `npm run baba:setup` again.**
  - Stored secrets use a new encryption format; old values still work.
  - Sign-in links to other services expire after 10 minutes.
  - Website previews show a warning banner.
  - `x-forwarded-host` is only trusted in production with `TRUST_FORWARDED_HOST=1`.

## 2026-11-26
- Custom agents can use read-only connected tools (knowledge, memory, databases, Drive, Gmail, Calendar).
- Admin chooses each agent's model and effort.
- Mobile App Builder specialist (Expo source + web preview link).
- Multi-step workflows (do / only continue if / ask me first / notify me) with version history.
- Stripe billing: checkout, customer portal, signed webhook, invoices.
- Native Slack, HubSpot and Microsoft 365 connections (12 tools; writes need approval).
- Publish websites live on AWS (S3 + CloudFront) with approval, rollback and custom-domain requests.
- Knowledge base search by meaning (pgvector) when an embeddings key is set.
- Docker image, docker-compose, Terraform for AWS, deploy workflow, health endpoint, error alerts, load test, deployment/backup/security/admin/user/troubleshooting guides.

## 2026-11-24 – 2026-11-25
- Account approval enforced by the database; master admin; admin area (users, workspaces, agents, plans, usage, audit log, health, settings).
- Specialists: QA Reviewer, Website Builder, UI/UX Designer, Marketing & SEO, Finance Analyst; plan-first and QA rules.
- Business memory and knowledge base; website previews with versions; read-only database connections; workflow webhooks.
- Usage & billing page, plan quotas, spending warnings, message search, edit last message, data export, security headers, rate limits, unit tests and CI.
- Custom agent builder.
- Public website pages: Features, AI Agents, Integrations, Use cases, Pricing, About, Contact.

## Earlier
- Ask Baba on Claude Managed Agents, Supabase database and auth, Google (Gmail, Drive, Calendar), scheduled workflows, everything manageable from the chat.
