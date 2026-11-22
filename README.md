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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types and run TypeScript |
| `npm run lint` | Run ESLint |

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
