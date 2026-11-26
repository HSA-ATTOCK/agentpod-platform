# Platform admin guide

For the platform owner. Open **/admin** (a "Platform admin" link appears in the sidebar once you're an admin).

## First time

```bash
npm run admin:bootstrap -- you@example.com
```

Run it on the server (it needs `SUPABASE_SECRET_KEY`), after signing up with that email. Use `--remove` to take admin rights away.

## Daily work

| Page | What you do there |
|---|---|
| **Overview** | Users by status, active users, tasks and success rate, AI spend (today, month, 30-day chart), agent use, most expensive tasks, connections in use. |
| **Registrations** | Approve or reject new sign-ups. They get an email either way. You get a bell notification and an email for each new one. |
| **Users** | Search and filter all accounts. Approve, reject, suspend, reactivate, make admin, send a password reset, delete. Suspending blocks all data access at once. |
| **Workspaces** | Each customer organisation: owner, members, spend this month, connections, workflows. **Plan & limits**: choose a plan, override the monthly/daily AI spend caps, restrict which specialists they may use, add a note. |
| **Agents** | Turn specialists on or off for everyone (changes Baba's team on Claude for new conversations). Choose each agent's model (Opus, Sonnet, Haiku) and effort. "Re-apply team to Claude" fixes drift. |
| **Plans** | Create and edit plans: price label, Stripe Price ID, monthly/daily caps, per-task cap, quotas (workflows, connections, website previews), allowed agents, features. Prices are never in code. |
| **Usage & costs** | Spend by user, workspace and agent. |
| **Audit log** | Every important action (append-only). Filter by action prefix, e.g. `account.`, `tool.`, `billing.`. |
| **System health** | Database, Claude, email, encryption key, Google, scheduler, public access, recent failed tasks. |
| **Settings** | Approval on/off, maintenance mode (only admins can use the app), announcement banner, default limits. |

## How limits work

The stricter of the workspace's own settings and your limits always applies, checked on the server before every task:

- per-conversation cap (plan's per-task cap),
- monthly and daily AI spend,
- plan quotas (workflows and connections are enforced by the database; previews on publish),
- allowed specialists (Baba is told, and a disallowed specialist stops the task).

Owners and admins get a warning at 80% and 100% of the monthly limit.

## Payments (when Stripe is set up)

Put each plan's Stripe Price ID in Plans. Customers pick a plan on **Usage & billing**; the Stripe webhook sets their plan automatically, and failed payments notify their owners. Without Stripe, assign plans by hand in Workspaces.

## Custom domains for live websites

When a customer asks for their own domain, it's recorded on the site (audit: `site.custom_domain_requested`). To finish: request an ACM certificate in us-east-1 for that domain, add the domain as an alternate name on the sites CloudFront distribution, and add a small routing rule (or a dedicated distribution) mapping the domain to the site's folder. The customer has already been told which CNAME to create.

## Agent changes

Instructions, tools and default models are in `baba/team.mjs` (versioned in git). After changing it run `npm run baba:setup`: it publishes new versions, keeps your on/off and model choices, and registers the agents here.
