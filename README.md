# Baba

An AI agent platform that helps businesses automate workflows, reduce manual work, and manage intelligent AI agents.

**Current phase:** Phase 1 — Frontend foundation and authentication UI.

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- lucide-react icons · Geist font
- Later: Claude API (server-side only, see `docs/ARCHITECTURE.md`), Vercel
- Database and auth provider: not decided yet

## Getting started

```bash
npm install
npm run dev
```

Open the app: in Codespaces, use the forwarded **port 3000** link from the Ports tab (on your own computer it's http://localhost:3000).
On a live domain, set `NEXT_PUBLIC_SITE_URL=https://your-domain` so emails and redirects always use it.

## Connecting Baba to Claude

Ask Baba runs on [Claude Managed Agents](docs/ARCHITECTURE.md): a main **Baba** agent that
delegates to specialist agents (Research Analyst, Writer, Data Analyst).

1. Create an API key in the Claude Console and put it in `.env.local`
   (see `.env.example`):
   ```
   ANTHROPIC_API_KEY=...
   ```
2. Create the agent team (run once, and again whenever you change `baba/team.mjs`):
   ```bash
   npm run baba:setup
   ```
   This creates/updates the agents, saves their IDs in `baba.lock.json`, and adds
   `BABA_AGENT_ID` and `BABA_ENVIRONMENT_ID` to `.env.local`.
3. Restart `npm run dev` and open `/ask`.

**Cheap testing mode:** set `BABA_PROFILE=test` in `.env.local` and run `npm run baba:setup`.
Every agent then runs on Claude Haiku 5.5 at low effort with smaller limits. Set it back to
`BABA_PROFILE=normal` (and run setup again) when you're done testing.

**Spending caps:** set in the app under **Settings → AI & spending**: a cap per conversation
(default `$1`) and a monthly limit per workspace (default `$50`; new tasks are blocked once it's reached). If a task reaches the cap, Baba pauses
and shows **Continue task**: that raises the cap by the same amount and the task carries on from
where it stopped, without redoing (or re-paying for) earlier work.

**Safety:** the Baba API routes need a signed-in user, and in production (`next start` /
Vercel) they stay off unless `BABA_ALLOW_PUBLIC=true` — there's no billing yet, so anyone who
signs up would be spending your API credit.

## Database and sign-in (Supabase)

1. Add to `.env.local` (Supabase dashboard → Project Settings → API):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Supabase dashboard → Authentication → URL Configuration: set **Site URL** to your app's
   address and add `<your app address>/auth/callback` to **Redirect URLs**
   (for Codespaces, the forwarded port-3000 address).
3. Optional: Authentication → Providers → Google, to switch on "Continue with Google".

The schema is in `supabase/migrations/` (already applied to the project).

## Email (Gmail)

Baba sends invite emails and task notifications through your Gmail account with Nodemailer.

1. Turn on 2-Step Verification for the Google account, then create an **App password**
   (Google Account → Security → App passwords).
2. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to `.env.local` and restart.
3. Recommended: send Supabase's sign-up and password-reset emails through the same Gmail too
   (Supabase → Authentication → Emails → SMTP Settings: host `smtp.gmail.com`, port `465`,
   username = your Gmail address, password = the app password). Supabase's built-in sender only
   allows a few emails per hour and is meant for testing.

Gmail allows about 500 emails a day, which is fine while you grow; move to a dedicated
sending service later if you need more.

## Scheduled workflows

Workflows with a schedule run by themselves at their time in the **workspace timezone**
(Settings → Workspace).

1. Add `SUPABASE_SECRET_KEY` to `.env.local` (Supabase → Project Settings → API Keys → Secret key).
2. Restart the app. The terminal shows `[workflows] Scheduler on: checking for due workflows every minute.`

While the app runs, it checks every minute. If it was off at a scheduled time, the run is caught up
when the app starts again (up to 3 hours late); older ones show in Activity as "Missed".
Each run creates a conversation (open it from Activity), counts against the workflow's own cap and
the workspace's monthly limit, and emails the person who created the workflow if it fails or pauses.

When the app is hosted (e.g. Vercel), call `GET /api/cron/workflows` every minute with
`Authorization: Bearer <CRON_SECRET>` from a scheduler, and set `BABA_SCHEDULER=off`.

## Everything from the chat

Anything you can do on Baba's pages you can also ask for in Ask Baba: look up workflows, activity, files,
team and settings; create/change/delete workflows; update your profile, workspace details, business
instructions, spending limits and notification emails; invite people, change roles, remove members; manage
connections. Every change shows an **Approve / Reject** card first and runs with the approving person's role.
For safety, password, email, two-step verification, deleting the account/workspace and transferring ownership
stay on their pages (Baba links to them). Tools: `baba/app-tools.mjs`, server code: `src/lib/app-tools/`.

## Connected tools

Customers connect their own tools from the chat ("connect my Gmail") or the Integrations page.
Each workspace can connect **several Google accounts** and any number of **services with an API key**.

- **Google (Gmail, Drive, Sheets, Calendar):** Baba shows a *Connect Google* button in the chat; the
  customer signs in on Google's page in a small window. Sending email and creating events always need approval.
- **Services with an API key:** Baba explains where to create the key and shows a **secure box** in the chat.
  The key goes straight to the server (encrypted), never into the chat or to Claude, and can only be used for
  requests to that service's address. Requests that change data need approval.
- Tokens and keys live in `integration_credentials`, which only the server can read.

### Google: each workspace uses its own Google app (set up from the chat)

Nothing goes in `.env.local`. The first time a workspace says "connect my Gmail", Baba shows a secure
setup card with step-by-step instructions and the exact redirect address. The owner/admin creates an
OAuth client in Google Cloud and pastes its **Client ID and secret into the card** (never into the chat).
They're encrypted and stored for that workspace only. After that, the card becomes a Connect button and
the workspace can connect as many Google accounts as it likes. Replace or remove the app in Integrations.

Optional: set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to offer one shared Google app to every
workspace that hasn't added its own (then customers just click Connect).

Requirement on the server: `SUPABASE_SECRET_KEY` (used to store secrets encrypted). Run `npm run baba:setup`
after updating so Baba has the latest tools.

## Accounts, approval and the admin area

- **New sign-ups wait for approval.** Until a platform administrator approves them they only see a
  "waiting for approval" screen, and the database itself (Row Level Security) gives them no data.
  People invited to a workspace are approved automatically.
- **Make yourself the master administrator** (once, after signing up). It needs `SUPABASE_SECRET_KEY`:

  ```bash
  npm run admin:bootstrap -- you@example.com
  ```

  Then open **/admin** (a "Platform admin" link appears in the sidebar): registrations, users
  (approve, reject, suspend, make admin, reset password, delete), workspaces (plan, monthly and daily
  spend caps, allowed agents), agents (switch specialists on/off), plans, usage and costs, audit log,
  system health and platform settings (approval on/off, maintenance mode, announcement banner).
- Admins get an email and a bell notification for each new registration; people get an email when
  they're approved, rejected or suspended.

## Websites, memory and databases

- **Websites:** ask Baba to build a site. The Designer, Website Builder and QA Reviewer make it, and
  Baba publishes a private preview link (`/preview/<id>`, valid 30 days). Every version is kept;
  restore old versions on the **Websites** page. Publishing to your own domain isn't available yet.
- **Memory:** short facts about the business that Baba reuses in every new chat, and a
  knowledge base of documents Baba searches. Manage both on the **Memory** page or from the chat.
- **Databases:** Baba shows a secure form to connect PostgreSQL or MySQL. Access is read-only
  (checked queries, read-only transaction, 15-second limit); the password is encrypted and never
  reaches the AI.
- **Your own agents:** owners and admins create custom specialists (instructions, model, web access,
  cost limit) on the AI Agents page. Baba hands them work in a separate, budget-capped session.
- **Webhooks:** any workflow can get a secret link (Workflows → ⋯ → Create webhook link). A POST to
  it runs the workflow with the request body as data.

See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for what's done and what's next
against the product requirements.

## Legal pages

`/terms` and `/privacy` are drafts. Fill in your details in `src/config/legal.ts` and have them
reviewed by a lawyer before launch.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types and run TypeScript |
| `npm run lint` | Run ESLint |
| `npm run baba:setup` | Create or update Baba's agent team on Claude (and list them in the admin area) |
| `npm run admin:bootstrap -- you@example.com` | Make an account a platform administrator |
| `npm run email:test -- you@example.com` | Send a test email |

## Project structure

```
src/
  app/
    (marketing)/       Public landing page  →  /
    (auth)/            sign-in, sign-up, forgot-password, verify-email
    (app)/             Logged-in app: dashboard, agents, workflows,
                       integrations, activity, settings, profile
    globals.css        Design tokens (colors, radius, fonts)
    layout.tsx         Root layout
  components/
    ui/                Reusable building blocks (Button, Input, Card…)
    layout/            App sidebar, mobile nav, top bar
    marketing/ auth/ dashboard/ agents/ workflows/
    integrations/ activity/ settings/
  config/              routes, navigation, site info
  lib/                 helpers (utils, formatting, sample data)
  types/               Shared domain types (Agent, Workflow, Execution…)
docs/prompts/          Frontend generation prompts for each milestone
```

## Roadmap

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan. In short:

1. **Frontend** — landing, auth UI, app layout, dashboard, Ask Baba chat, remaining pages
2. **Connect Claude** — Ask Baba chat with streaming, web research, file creation
3. **Integrations & approvals** — Gmail, Slack, CRM…, approval for sensitive actions
4. **Helpers, schedules, memory** — specialist agents, scheduled jobs, business knowledge
5. **Database, accounts & workspaces** — database and auth provider (to be chosen)
6. **SaaS & production** — billing, usage limits, permissions, monitoring
