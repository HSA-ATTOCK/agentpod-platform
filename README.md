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

Open http://localhost:3000.

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

**Spending cap:** each conversation stops at `BABA_SESSION_BUDGET_USD` (default `$1`).
Change it in `.env.local` and restart the dev server. If a task reaches the cap, Baba pauses
and shows **Continue task**: that raises the cap by the same amount and the task carries on from
where it stopped, without redoing (or re-paying for) earlier work.

**Safety:** there's no login yet, so the Baba API routes are disabled in production
(`next start` / Vercel) unless `BABA_ALLOW_PUBLIC=true`. Keep it off for public deployments.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types and run TypeScript |
| `npm run lint` | Run ESLint |
| `npm run baba:setup` | Create or update Baba's agent team on Claude |

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
