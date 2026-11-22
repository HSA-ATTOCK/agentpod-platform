# AgentPod

An AI agent platform that helps businesses automate workflows, reduce manual work, and manage intelligent AI agents.

**Current phase:** Phase 1 — Frontend foundation and authentication UI.

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- lucide-react icons · Geist font
- Later: Supabase (auth + Postgres), Claude API (server-side only), Vercel

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

1. **Frontend foundation** — landing, auth UI, app layout, dashboard, agents, workflows, integrations, activity, settings
2. **Authentication & workspaces** — Supabase auth (email + Google), profiles, workspaces, protected routes
3. **AI agent foundation** — Claude API (server-side), agent configuration, task storage
4. **Tools & integrations** — tool calling, workflow execution, logs
5. **Business automation** — templates, approvals, scheduling, team collaboration
6. **SaaS & production** — billing, usage limits, permissions, monitoring
