# Security guidelines

How Baba protects data, and the rules to keep when changing it.

## Accounts and access

- New accounts are **pending** until a platform administrator approves them. Every table has a restrictive Row Level Security policy (`private.mfa_ok()`) that requires an **approved** account and, when two-step verification is on, a verified session. A pending, rejected or suspended user gets no rows from the API, whatever they send.
- Workspaces isolate customers: every row carries `workspace_id`, and RLS lets only members read it; owners/admins can change settings.
- The platform admin area (`/admin`) and `/api/admin` check `platform_accounts.is_admin` on the server for every request. The first admin is created with `npm run admin:bootstrap` (needs the server secret key); there is no public route for it.
- Security headers on every page (no framing, no MIME sniffing, HSTS, restricted browser features). Baba requests are rate limited per person.

## Secrets

- Connected-account tokens, API keys, database passwords and each workspace's app secrets are encrypted with AES-256-GCM (`src/lib/integrations/crypto.ts`; format v2 with an HKDF-derived key and a 16-byte tag; older values still decrypt) in `integration_credentials`, a table with RLS and **no policies**: only the server (secret key) can read it.
- Secrets are entered only in secure cards or forms that post straight to the server, never in the chat, never sent to Claude, never logged, never included in data exports.
- An API key is only ever sent to the host it was saved for. The key card shows that host prominently, saving a key under an existing name with a different host is refused, and the key is removed from responses, including its base64 and URL-encoded forms.
- Sign-in links to other services (OAuth state) are signed, tied to the browser by a cookie, and expire after 10 minutes. The callback checks again that the person is an owner or admin of the same workspace.
- On AWS the app uses an IAM role (no AWS keys) that can only write the websites bucket and refresh CloudFront. Server settings live in Secrets Manager.

## The AI

- Claude never receives tokens or passwords: connected tools run on our server and return only results.
- Anything that sends, posts, publishes, deletes, changes permissions or spends needs a person's approval (approval cards; `tool_approvals`). Every request through a saved API key needs approval, reads included, because a read URL can carry data out. The approval card shows the full message (body, cc, event description), not a shortened version. Workflow "ask me first" steps use an approval checkpoint.
- Emails, documents, web pages and API responses are treated as information, not instructions (stated in every agent's rules). Tool results from outside sources are labelled as outside content, and webhook payloads are wrapped in tags with a random name. A custom Claude agent can't have both web access and private tools (Gmail, Drive, Calendar, databases), so a web page can't direct it to leak private data.
- Limits are enforced outside the AI: spending caps (per conversation, monthly, daily), plan quotas (database triggers), allowed agents per workspace (a disallowed specialist stops the task), custom agents' tool lists.
- Database access is read-only twice over: queries are checked (comments, all quoting styles, `INTO`, and dangerous functions such as `dblink`, `lo_*`, `pg_read_file`, `set_config` and `pg_sleep`), then run in a read-only transaction with a time and row limit. Private network addresses are refused, and the connection goes to the IP address that was checked, so DNS can't be switched in between. Encryption modes: **verify** (default, checks the certificate), **require** (encrypted, certificate not checked) and **off**. Ask customers to connect with a read-only database user.
- Website previews are served with a sandboxing Content-Security-Policy, so a generated site can't read the app's cookies or call other servers. Its forms can only post to Baba's form endpoint. Because previews share Baba's address, every preview page shows a banner warning people not to enter their Baba password; for the strongest separation, serve previews from their own domain. Uploaded site archives are checked for size and file count before they are unpacked.
- The agents' sandbox holds no secrets, and its network is limited to package registries (run `npm run baba:setup` after updating to apply this to an existing environment).
- Public endpoints (forms, webhooks, contact) are rate limited by client IP (the proxy's `x-real-ip` or the last `x-forwarded-for` entry), have body size limits and daily caps.
- In production, the `x-forwarded-host` header is not trusted for building links unless `TRUST_FORWARDED_HOST=1`; set `NEXT_PUBLIC_SITE_URL`.

## Audit

`audit_logs` is append-only (updates, deletes and truncation are refused by the database). It records approvals, account changes, admin actions, connections, every tool Baba runs, website publishing, billing changes and data exports. Admins see it in Admin → Audit log; workspace owners can read their workspace's entries.

## Internal security review (2026-11-26)

Three independent reviews (access control; secrets and integrations; public endpoints and XSS) produced 38 findings. All of them were fixed, apart from the separate preview domain, which is still a recommendation. The fixes included:

- the redirect check after sign-in
- images in chat replies (shown as text, never loaded)
- limits on zip archives
- rate limiting by IP
- workflows that could run as the owner
- spending caps
- loading conversations from another workspace
- column-level write permissions in the database
- invite approval before the email is confirmed
- the database query checks
- full approval summaries
- approval for API-key requests
- the sandbox network
- the Stripe event order
- wildcards in name lookups
- the encryption format
- sign-in link expiry
- trust in the forwarded host
- redaction of encoded keys
- the preview banner

Regression tests are in `tests/unit/security.test.ts` and `tests/unit/crypto.test.ts`. This review is not a substitute for an outside penetration test.

## Rules for changes

1. Every new table: `workspace_id`, RLS on, member policies, and the restrictive `mfa: two-step verified` policy.
2. Every new action that changes something outside Baba: add it to an approval list.
3. Never put a secret in a prompt, a log line, an error message or a client component.
4. Server checks first; hiding a button is never the protection.
5. Run `npm test`, `npm run lint`, `npm run typecheck` and the Supabase security advisor after schema changes.

## Compliance

The platform is designed to support GDPR-style rights (export: Profile → Download my data; deletion: Profile → Delete account) and SOC 2-style controls (audit log, least privilege, encryption). It has **not** been independently assessed; don't claim certification without one.
