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
| **Baba (main agent)** | Understands the request, plans, delegates, reviews quality, asks for approvals, delivers the result | Claude Opus 5.5 |
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
2. **Connect Claude** ✅ (first version) — Ask Baba streams real work from Baba plus
   Research Analyst, Writer and Data Analyst. Agent definitions live in `baba/team.mjs`
   and are synced with `npm run baba:setup`; the server routes are in `src/app/api/baba/`.
   Not yet: file uploads, resuming a stream after a dropped connection, saved history.
3. **Integrations & approvals** — connect Gmail, Slack, CRM, etc.; approval cards
   for sensitive actions.
4. **Full agent team, schedules, memory** — Website Builder, Mobile App Builder,
   designer, QA and the other specialists; preview hosting for generated sites;
   scheduled jobs; business knowledge.
5. **Database, accounts & workspaces** — choose the database and auth provider;
   sign-up/sign-in, saved conversations, teams, per-business isolation.
6. **SaaS & production** — billing, usage limits, permissions, monitoring, security.

The order of phases 2–5 can change once the database is chosen.
