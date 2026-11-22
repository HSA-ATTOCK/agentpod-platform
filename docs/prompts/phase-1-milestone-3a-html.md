Design and build 4 more pages for a web app called Baba. Give me the result as HTML pages.

ABOUT THE PRODUCT
Baba is an AI assistant for businesses. The user talks to one main AI agent called "Baba", which plans each task and hands parts of it to a team of specialist AI agents (Research Analyst, Writer, Data Analyst, and later Website Builder, Mobile App Builder, Designer, QA Reviewer, Marketing Strategist, Finance Analyst, Operations Agent). Baba can research the web, create documents and spreadsheets, and (later) use business tools like Gmail and Slack, always asking for approval before sensitive actions. It must look like a premium, serious business SaaS dashboard, not a chatbot site.

STRICT DESIGN RULES (follow exactly; do not invent your own colour system or theme)
- Dark design. Use ONLY these colours, written as Tailwind arbitrary values like bg-[#111113]:
  - Page background #0a0a0b
  - Cards #111113, raised cards #18181b, hover #1f1f23
  - Borders #27272a, stronger borders #3f3f46
  - Main text #fafafa, secondary text #a1a1aa, faint text #71717a
  - Accent lime #a3e635 (hover #bef264); text on lime buttons #0a0a0b
  - Success #4ade80, warning #fbbf24, error #f87171, info #60a5fa (use 10–15% opacity versions for soft backgrounds)
- Lime is used sparingly: main buttons, active menu item, key highlights, focus outlines.
- Corner radius about 16px for cards, about 10px for buttons and inputs. Thin 1px borders on every card.
- Font: Geist (or Inter). Clean, generous spacing.
- Icons: Lucide icons ONLY (https://unpkg.com/lucide@latest). Do NOT use Material Symbols or any other icon set.
- Status badges always show text, not colour alone.

TECHNICAL RULES
- Tailwind CSS via CDN, one complete HTML file per page, a little plain JavaScript only for interactions.
- Fully responsive at 375px, 768px, 1024px and 1440px with no sideways scrolling. Design the phone layout properly (stacked cards instead of wide tables, full-width buttons where sensible).
- Accessible: labels on every input and icon button, keyboard usable, visible focus outlines, Escape closes any dialog or panel.
- Give the full code of every page. Never shorten or skip parts.
- Only include the page content. I already have the app frame (sidebar, top bar, mobile tab bar), so do NOT build a sidebar or top navigation. Start inside a <main> area with about 32px padding on desktop and 16px on phones.

USE THIS SAMPLE DATA (and show a small blue "Sample data" badge near each page title)
Workspace: Acme Corp. User: Sarah Connor.

THE PAGES

1. AI AGENTS (agents.html)
Title "AI Agents" with subtitle "Baba and its team of specialists. Baba decides who works on each task."
- A highlighted card at the top for "Baba — Main agent": short description, model "Claude Sonnet 5.5", status "Active", stats (tasks this month: 48, average cost per task: $0.14), and buttons "Edit instructions" and "Ask Baba".
- Section "Specialists" as a grid of cards (1 column phone, 2 tablet, 3 desktop). Each card: icon, name, one-line job, model, status badge, "Tasks this month", and a menu button (Edit instructions, View activity, Pause).
  Active: Research Analyst (Claude Sonnet 5.5, 21 tasks), Writer (Claude Sonnet 5.5, 14 tasks), Data Analyst (Claude Sonnet 5.5, 6 tasks).
  Coming soon (greyed, "Coming soon" badge, no menu): Website Builder, Mobile App Builder, UI/UX Designer, QA Reviewer, Marketing Strategist, Finance & Accounts Analyst, Operations Agent.
- Filter tabs above the grid: All, Active, Coming soon.
- Clicking "Edit instructions" opens a right-side panel (full screen on phones) with: agent name, a large textarea "Instructions" pre-filled with 3–4 lines, a "Model" select (Claude Sonnet 5.5, Claude Opus 5.5, Claude Haiku 5.5) with a short helper line "Opus: best quality, higher cost. Haiku: cheapest, for simple work.", a "Tools" list of toggles (Web search, Read web pages, Run code, Create files), and Save / Cancel buttons. Save shows a small toast "Changes saved (sample — not connected yet)".
- Empty state design (show it at the bottom labelled "Empty state preview"): "No specialists yet" with text "Baba works alone until you add specialists."

2. WORKFLOWS (workflows.html)
Title "Workflows" with subtitle "Save tasks you repeat and let Baba run them on a schedule." Primary button "New workflow".
- List of workflow cards (table on desktop, stacked cards on phone). Each: name, the instruction it runs (one line, truncated), schedule ("Every Monday at 09:00", "On the 1st of each month", "Manual"), last run (time + status badge Succeeded/Failed/Running), next run, average cost, a switch to turn it on/off, and a menu (Run now, Edit, Duplicate, Delete).
  Sample: "Weekly competitor pricing check" (Every Monday 09:00, Succeeded, $0.12), "Monthly sales report" (1st of month, Succeeded, $0.31), "Daily support inbox summary" (Weekdays 08:30, Failed, $0.05, failure reason "Gmail isn't connected"), "Quarterly market research" (Manual, never run).
- "New workflow" opens a dialog with: Name, "What should Baba do?" textarea, Schedule (Manual / Daily / Weekly with day picker / Monthly) and time, "Spending cap per run" (number in $, default 1), "Ask for my approval before sensitive actions" (checked, disabled, with note "Always on"), and Create / Cancel. Validate that name and instruction are filled.
- Empty state: "No workflows yet" with "Turn any Ask Baba task into a workflow that runs on its own." and button "Create your first workflow".

3. INTEGRATIONS (integrations.html)
Title "Integrations" with subtitle "Choose which tools Baba is allowed to use. Baba only uses what you connect."
- Search box and category tabs: All, Email, Communication, Files, CRM, Productivity, Developer.
- Grid of integration cards: logo placeholder (a rounded square with the first letter, NOT real brand logos), name, one-line description of what Baba can do with it, status, and a button.
  Status rules: show ALL as "Not connected" with a "Connect" button, EXCEPT mark these as "Coming soon" (disabled button): HubSpot, Salesforce, Notion, Shopify.
  Integrations: Gmail, Google Calendar, Google Drive, Google Sheets, Outlook, Slack, Microsoft Teams, Notion, HubSpot, Salesforce, Shopify, Stripe, GitHub, Webhooks.
- Clicking "Connect" opens a dialog: what Baba will be able to do (3 bullet points), what it will NOT do without approval (2 bullet points), and a button "Continue to Gmail" (for example) which shows the message "Connecting isn't available yet. It will be enabled in a later phase." Never pretend it connected.
- A small info card at the top: "Sensitive actions need your approval" with one line of explanation.

4. PROJECTS (projects.html)
Title "Projects" with subtitle "Everything Baba has made for you: documents, spreadsheets, websites and apps."
- Filter tabs: All, Documents, Spreadsheets, Presentations, Websites, Apps. A search box and a sort select (Newest, Oldest, Name).
- Grid of project cards (or a list on phones). Each: file-type icon, name, type and size, which conversation it came from (link text), date created, and buttons Download and "Open chat".
  Sample: "UK_Online_Bakery_Market_Research.docx" (Document, 37 KB), "Competitor-comparison.xlsx" (Spreadsheet, 24 KB), "Q4 sales summary.pptx" (Presentation, 1.2 MB), "Bakery website" (Website, "Coming soon" badge, preview thumbnail made of simple shapes), "Booking app" (App, "Coming soon").
- Website and App cards show a "Preview" button disabled with the tooltip "Website and app building is coming soon".
- Empty state: "Nothing here yet" with "Files Baba creates in Ask Baba will appear here." and button "Ask Baba".

Give me four complete HTML files: agents.html, workflows.html, integrations.html, projects.html.
