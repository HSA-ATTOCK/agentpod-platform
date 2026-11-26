# Security guidelines

How Baba protects data, and the rules to keep when changing it.

## Accounts and access

- New accounts are **pending** until a platform administrator approves them. Every table has a restrictive Row Level Security policy (`private.mfa_ok()`) that requires an **approved** account and, when two-step verification is on, a verified session. A pending, rejected or suspended user gets no rows from the API, whatever they send.
- Workspaces isolate customers: every row carries `workspace_id`, and RLS lets only members read it; owners/admins can change settings.
- The platform admin area (`/admin`) and `/api/admin` check `platform_accounts.is_admin` on the server for every request. The first admin is created with `npm run admin:bootstrap` (needs the server secret key); there is no public route for it.
- Security headers on every page (no framing, no MIME sniffing, HSTS, restricted browser features). Baba requests are rate limited per person.

## Secrets

- Connected-account tokens, API keys, database passwords and each workspace's app secrets are encrypted with AES-256-GCM (`src/lib/integrations/crypto.ts`) in `integration_credentials`, a table with RLS and **no policies**: only the server (secret key) can read it.
- Secrets are entered only in secure cards or forms that post straight to the server, never in the chat, never sent to Claude, never logged, never included in data exports.
- On AWS the app uses an IAM role (no AWS keys) that can only write the websites bucket and refresh CloudFront. Server settings live in Secrets Manager.

## The AI

- Claude never receives tokens or passwords: connected tools run on our server and return only results.
- Anything that sends, posts, publishes, deletes, changes permissions or spends needs a person's approval (approval cards; `tool_approvals`). Workflow "ask me first" steps use an approval checkpoint.
- Emails, documents, web pages and API responses are treated as information, not instructions (stated in every agent's rules).
- Limits are enforced outside the AI: spending caps (per conversation, monthly, daily), plan quotas (database triggers), allowed agents per workspace (a disallowed specialist stops the task), custom agents' tool lists.
- Database access is read-only twice over: queries are checked, then run in a read-only transaction with a time and row limit. Private network addresses are refused.
- Website previews are served with a sandboxing Content-Security-Policy, so a generated site can't read the app's cookies or call other servers.
- The agents' sandbox holds no secrets.

## Audit

`audit_logs` is append-only (updates, deletes and truncation are refused by the database). It records approvals, account changes, admin actions, connections, every tool Baba runs, website publishing, billing changes and data exports. Admins see it in Admin → Audit log; workspace owners can read their workspace's entries.

## Rules for changes

1. Every new table: `workspace_id`, RLS on, member policies, and the restrictive `mfa: two-step verified` policy.
2. Every new action that changes something outside Baba: add it to an approval list.
3. Never put a secret in a prompt, a log line, an error message or a client component.
4. Server checks first; hiding a button is never the protection.
5. Run `npm test`, `npm run lint`, `npm run typecheck` and the Supabase security advisor after schema changes.

## Compliance

The platform is designed to support GDPR-style rights (export: Profile → Download my data; deletion: Profile → Delete account) and SOC 2-style controls (audit log, least privilege, encryption). It has **not** been independently assessed; don't claim certification without one.
