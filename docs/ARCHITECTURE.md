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
| AI Agents | Baba's specialist team, what each one does, and their instructions |
| Projects | Websites, apps and files the agents produced, with live previews and downloads |
| Workflows | Saved and scheduled jobs ("every Monday, send me a sales report") |
| Integrations | Business tools Baba is allowed to use (Gmail, Slack, HubSpot, Sheets, Notion…) |
| Activity | Full history of everything Baba and its helpers did |
| Settings / Profile | Workspace, team, permissions, usage and billing |

## The agent team

Baba is the **main agent**. The user only ever talks to Baba. For each task, Baba makes a
plan, hands each part to the right **specialist agent**, checks what comes back, and
assembles the final result. Specialists can work in parallel and share one workspace
(files, code, data), so one specialist can build on another's work.

| Agent | What it does | Model (starting point) |
|---|---|---|
| **Baba (main agent)** | Understands the request, plans, delegates, reviews quality, asks for approvals, delivers the result | Claude Sonnet 5.5 |
| **Website Builder** | Builds complete websites (Next.js / React / Tailwind): pages, components, content, SEO basics; runs the build and fixes errors | Claude Opus 5.5 |
| **Mobile App Builder** | Builds mobile apps (React Native / Expo) for iOS and Android, with a web preview | Claude Opus 5.5 |
| **UI/UX Designer** | Brand, layout, design system and copy for websites and apps, before building starts | Claude Sonnet 5.5 |
| **QA Reviewer** | Tests and reviews what the builders made: runs it, checks pages, reports bugs back | Claude Sonnet 5.5 |
| **Research Analyst** | Market, competitor and topic research on the web, with sources | Claude Sonnet 5.5 (+ a low-cost Claude Haiku 5.5 reader for bulk reading) |
| **Marketing Strategist** | Campaign plans, content, SEO, social posts, email sequences | Claude Sonnet 5.5 |
| **Finance & Accounts Analyst** | Bookkeeping categorisation, financial reports, budgets and forecasts from spreadsheets | Claude Opus 5.5 |
| **Data Analyst** | Spreadsheet analysis, charts, dashboards, insights | Claude Sonnet 5.5 |
| **Writer** | Proposals, reports, documents, presentations (Word, PDF, PowerPoint, Excel) | Claude Sonnet 5.5 |
| **Operations Agent** | Inbox triage, CRM updates, scheduling, admin work through connected tools (sensitive actions need approval) | Claude Sonnet 5.5 |

Models are a starting point; each agent's model and effort level will be tuned by
measuring quality and cost on real tasks.

### How it runs (Claude Managed Agents)

- Each agent is a stored, versioned agent config (instructions, model, tools).
- Baba's config lists the specialists as its team. In one session, Baba delegates to
  them; each runs in its own thread with its own context, and only its report returns
  to Baba, so Baba stays focused on the whole task.
- For work with many independent pieces (e.g. research across dozens of sources),
  Baba can start a workflow run that fans the pieces out in parallel.
- All agents share the session's sandbox: code, files and data one agent creates are
  available to the others.
- Every session gets a spending cap so one task can't run up an unexpected bill.

### Example: "Build me a website for my bakery"

1. Baba asks a few key questions (pages, style, ordering?) and writes a plan.
2. UI/UX Designer proposes the look, sitemap and copy.
3. Website Builder builds the site and runs it.
4. QA Reviewer tests every page on phone and desktop and reports issues.
5. Website Builder fixes them; Baba checks the result.
6. The user gets a live preview and a downloadable project. Publishing it to the
   user's own domain/hosting is a separate step that needs their approval.

### Honest limits

- **Websites and apps:** the agents write and run complete projects, but complex
  products (payments, user accounts, large backends) need several rounds of feedback
  and a human review before going live.
- **Live previews and publishing:** we need preview hosting for generated sites, and a
  deploy integration (e.g. the user's Vercel or Netlify account) to publish.
- **Mobile apps:** Baba can build the app and a preview; publishing to the App Store /
  Google Play needs the user's developer accounts and their store review.
- **Finance & accounts:** analysis and reports, not certified accounting or tax advice.
- **Cost and time:** building a website or app is a long task (often many minutes) and
  costs more than a chat answer; plans and usage limits must reflect that.

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
- **Default model:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) for Baba and the current specialists, chosen for cost. Claude Opus 5.5 remains an option for agents that need more depth (e.g. the future Website and Mobile App Builders).
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

**Supabase** (Postgres + Supabase Auth). Schema lives in `supabase/migrations/`;
generated types in `src/types/database.ts` (regenerate after every migration).

- **Workspaces = businesses.** Every signed-up user gets a profile and their own
  workspace (as Owner) from the `on_auth_user_created` trigger. Roles: owner, admin,
  member, viewer (`workspace_members`).
- **Isolation is enforced by Row Level Security** on every table, using the helper
  functions `private.is_workspace_member` / `private.has_workspace_role` (kept in a
  schema the API doesn't expose). One business can never read or write another's data,
  even with a hand-crafted request. Verified with a two-account test in the database.
- **Tables:** profiles, workspaces, workspace_members, workspace_invites, conversations
  (linked to a Claude session), conversation_items (each chat item as JSON), tasks
  (one per request → Activity), files (what Baba created → Projects), workflows,
  integrations, notification_preferences.
- **Access:** the app only uses the publishable key plus the signed-in user's session,
  so RLS always applies. There is no service-role key in the app.
- **Ask Baba:** the browser creates the conversation row and saves chat items; the API
  routes look up the Claude session from the conversation (the browser never sends a
  session id) and record each task's cost, agents, files and outcome.
- `src/proxy.ts` refreshes the session and keeps signed-out visitors out of the app.

Every app page now runs on this data:
- **Dashboard / Activity / Projects** — tasks (with saved steps, cost, agents) and files.
- **Agents** — the team from `src/config/team.ts` with real usage; "Business instructions"
  (`workspaces.business_context`) are sent to Baba with the first message of each conversation.
- **Workflows** — saved tasks with Run now (opens Ask Baba pre-filled, linked via
  `tasks.workflow_id`, using the workflow's own cap). Automatic scheduled runs: not yet.
- **Settings** — workspace details, team (roles, remove, transfer ownership, invites),
  spending (per-conversation cap + monthly limit, both enforced by the API), notification
  choices (saved; sending not yet), sessions, delete workspace.
- **Profile** — details, email change, password, usage, sign out everywhere, delete account.
- **Invites** — the invitee signs up with the invited email and joins automatically, or
  accepts from the workspace switcher if they already have an account. Invite emails are
  not sent yet (share the sign-up link).
- **Integrations** — catalogue only; connecting tools comes with the agent phase.

## Phases

1. **Frontend** — landing, auth pages, app layout, dashboard ✅;
   **Ask Baba chat screen** (next); Agents, Workflows, Integrations, Activity,
   Settings, Profile pages.
2. **Connect Claude** ✅ (first version) — Ask Baba streams real work from Baba plus
   Research Analyst, Writer and Data Analyst. Agent definitions live in `baba/team.mjs`
   and are synced with `npm run baba:setup`; the server routes are in `src/app/api/baba/`.
   Not yet: file uploads, resuming a stream after a dropped connection, saved history.
3. **Integrations & approvals** — connect Gmail, Slack, CRM, etc.; approval cards
   for sensitive actions.
4. **Full agent team, schedules, memory** — Website Builder, Mobile App Builder,
   designer, QA and the other specialists; preview hosting for generated sites;
   scheduled jobs; business knowledge.
5. **Database, accounts & workspaces** — Supabase ✅ schema + RLS, sign-up/sign-in
   (email + Google), saved conversations, task/file records. Next: the other pages on
   real data, team invites.
6. **SaaS & production** — billing, usage limits, permissions, monitoring, security.

The order of the remaining phases can still change.
