# Baba — Product & Architecture Plan

## The idea

Baba is one AI assistant a business talks to. You describe any task in plain language;
Baba plans the steps, uses tools, hands parts of the work to specialist helper agents,
asks for your approval before sensitive actions, and returns the finished result
(an answer, a file, an email sent, a record updated).

The main screen of the app is **Ask Baba** — a chat. The other pages support it:

| Page | Role |
|---|---|
| Ask Baba | Chat with the assistant, see live progress, approve actions, download results |
| Dashboard | Overview of recent tasks, approvals and usage |
| AI Agents | Specialist helpers Baba can call on (sales, support, research…) and their instructions |
| Workflows | Saved and scheduled jobs ("every Monday, send me a sales report") |
| Integrations | Business tools Baba is allowed to use (Gmail, Slack, HubSpot, Sheets, Notion…) |
| Activity | Full history of everything Baba and its helpers did |
| Settings / Profile | Workspace, team, permissions, usage and billing |

## What Baba can do, and what it needs

| Capability | Requires |
|---|---|
| Write, plan, analyse, summarise, draft | Nothing extra |
| Web research | Web search / web fetch tools |
| Create files (reports, spreadsheets, slides, charts) | A code-execution sandbox |
| Act in business tools | One integration per tool, connected by the business |
| Recurring jobs | Scheduling |
| Know the business (products, tone, customers) | Memory / knowledge storage |

Limits we design around:
- Baba can only act in systems the business has connected.
- It can make mistakes, so sensitive actions (sending email, changing records,
  payments) always require human approval.
- It declines harmful requests.
- Every task costs tokens and big tasks take minutes, so usage limits and billing
  are part of the product.

## AI engine

- **Claude API**, called **only from the server**. The Anthropic API key never
  reaches the browser.
- **Default model:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Recommended approach: Claude Managed Agents** (beta). Anthropic runs the agent
  loop and gives each conversation its own sandbox. It provides:
  - web search, code execution and file creation
  - MCP connectors for business integrations
  - per-tool permission policies → Baba's approval cards
  - helper agents for splitting large jobs
  - scheduled runs for recurring jobs
  - secure storage for each business's integration credentials
- Trade-offs: beta product, billed for session runtime on top of tokens,
  Anthropic keeps session history until deleted.
- Alternative if we need more control: run the agent loop ourselves with the
  Messages API + tool use (more code to build and host).
- Responses stream into the chat so users see progress live.

## Data storage

**Not decided yet.** The database (and with it the authentication provider) will be
chosen later. Until then:
- the UI runs on typed sample data in `src/lib/sample-data.ts`
- auth forms use honest placeholders in `src/lib/auth/placeholder.ts`
- the types in `src/types/index.ts` describe the data shape any database must store

Whatever we choose must give strict per-business isolation: one business can never
see another's conversations, files, agents, integrations or history.

## Phases

1. **Frontend** — landing, auth pages, app layout, dashboard ✅;
   **Ask Baba chat screen** (next); Agents, Workflows, Integrations, Activity,
   Settings, Profile pages.
2. **Connect Claude** — Ask Baba chat with streaming, web research, file and report
   creation (server-side, no database needed for a first version).
3. **Integrations & approvals** — connect Gmail, Slack, CRM, etc.; approval cards
   for sensitive actions.
4. **Helpers, schedules, memory** — specialist helper agents, scheduled jobs,
   business knowledge.
5. **Database, accounts & workspaces** — choose the database and auth provider;
   sign-up/sign-in, saved conversations, teams, per-business isolation.
6. **SaaS & production** — billing, usage limits, permissions, monitoring, security.

The order of phases 2–5 can change once the database is chosen.
