Design and build 3 more pages for a web app called Baba. Give me the result as HTML pages.

ABOUT THE PRODUCT
Baba is an AI assistant for businesses. The user talks to one main AI agent called "Baba", which plans each task and hands parts of it to specialist AI agents (Research Analyst, Writer, Data Analyst and more). Every task has a spending cap, and Baba asks for approval before sensitive actions. It must look like a premium, serious business SaaS dashboard, not a chatbot site.

STRICT DESIGN RULES (follow exactly; do not invent your own colour system or theme)
- Dark design. Use ONLY these colours, written as Tailwind arbitrary values like bg-[#111113]:
  - Page background #0a0a0b
  - Cards #111113, raised cards #18181b, hover #1f1f23
  - Borders #27272a, stronger borders #3f3f46
  - Main text #fafafa, secondary text #a1a1aa, faint text #71717a
  - Accent lime #a3e635 (hover #bef264); text on lime buttons #0a0a0b
  - Success #4ade80, warning #fbbf24, error #f87171, info #60a5fa (use 10–15% opacity versions for soft backgrounds)
- Lime is used sparingly: main buttons, active tab, key highlights, focus outlines.
- Corner radius about 16px for cards, about 10px for buttons and inputs. Thin 1px borders on every card.
- Font: Geist (or Inter). Clean, generous spacing.
- Icons: Lucide icons ONLY (https://unpkg.com/lucide@latest). Do NOT use Material Symbols or any other icon set.
- Status badges always show text, not colour alone.

TECHNICAL RULES
- Tailwind CSS via CDN, one complete HTML file per page, a little plain JavaScript only for interactions.
- Fully responsive at 375px, 768px, 1024px and 1440px with no sideways scrolling. Design the phone layout properly (stacked cards instead of wide tables).
- Accessible: labels on every input and icon button, keyboard usable, visible focus outlines, Escape closes any dialog.
- Give the full code of every page. Never shorten or skip parts.
- Only include the page content. I already have the app frame (sidebar, top bar, mobile tab bar), so do NOT build a sidebar or top navigation. Start inside a <main> area with about 32px padding on desktop and 16px on phones.

USE THIS SAMPLE DATA (and show a small blue "Sample data" badge near each page title)
Workspace: Acme Corp. User: Sarah Connor, sarah@acme.com, role Owner.

THE PAGES

1. ACTIVITY (activity.html)
Title "Activity" with subtitle "Everything Baba and its specialists did, with the cost of each task."
- Summary strip of 4 small stat cards: Tasks this month (48), Succeeded (44), Failed (3), Total spend this month ($6.72).
- Filters: search box, status select (All, Succeeded, Failed, Running, Paused at cap), agent select (All, Baba, Research Analyst, Writer, Data Analyst), and date range select (Last 7 days, Last 30 days, This month).
- Table on desktop / stacked cards on phone with 10 sample rows. Columns: Task (the user's request, truncated), Agents involved (small avatar chips with initials, e.g. "B", "RA", "W"), Status badge, Started (e.g. "Today, 14:32"), Duration (e.g. "2m 14s"), Cost (e.g. "$0.12"), and a chevron.
  Use realistic tasks such as "Research top 3 project management tools", "UK online bakery market report (Word)", "Summarize this week's support tickets", "Competitor pricing spreadsheet". Include one "Paused at cap" row and two "Failed" rows with short reasons.
- Clicking a row opens a right-side detail panel (full screen on phones) showing: the full request, a vertical timeline of steps (e.g. "Searching the web", "Research Analyst finished its sub-task", "Writer created UK_Online_Bakery_Market_Research.docx") with status icons and times, files created (with Download buttons), total cost and spending cap, and a button "Open in Ask Baba".
- Pagination at the bottom (Previous / page numbers / Next).
- Empty state: "No activity yet" with "Tasks you give Baba will show up here."

2. SETTINGS (settings.html)
Title "Settings". A vertical tab list on desktop (horizontal scrolling tabs on phones): Workspace, Team, AI & spending, Notifications, Security, Billing. Show all tab contents in the HTML, switching with JavaScript.
- Workspace: workspace name (Acme Corp), workspace URL slug, industry select, company size select, timezone select, logo upload area (shows the initial "A"), Save button.
- Team: "Invite member" button opening a dialog (email, role select: Owner/Admin/Member/Viewer). Table of members: Sarah Connor (Owner), James Lee (Admin), Priya Shah (Member), one pending invite "tom@acme.com" with "Pending" badge and "Resend"/"Revoke". Role explanations in a small table: what each role can do.
- AI & spending: "Spending cap per task" number input in $ (default 1.00) with helper text "Baba pauses when a task reaches this amount. You can continue it with one click."; "Monthly spending limit" ($50); a usage bar "This month: $6.72 of $50"; "Default quality" radio cards: Economy (Claude Haiku 5.5, cheapest), Balanced (Claude Sonnet 5.5, recommended), Best (Claude Opus 5.5, highest quality); "Always ask before sensitive actions" switch shown ON and locked, with note "Sending emails, posting messages and changing records always need approval."
- Notifications: switches for "Task finished", "Task failed", "Paused at spending cap", "Approval needed", "Weekly summary email", each with a one-line description; channel checkboxes Email / In-app.
- Security: "Sign-in methods" (Email and password: On; Google: Not connected, button "Connect"), "Two-step verification" (Off, button "Set up", disabled with "Coming soon"), "Active sessions" list (2 devices with browser, location, last active, "Sign out" button), and a danger zone card "Delete workspace" with a red outline button that opens a confirmation dialog requiring typing the workspace name.
- Billing: current plan card "Free trial" with "Upgrade" button disabled + "Plans coming soon" badge; "Usage this month" table (Tasks, Web searches, Agent time, Spend); "Invoices" empty state "No invoices yet".
- Every Save button shows a toast "Saved (sample — not connected yet)".

3. PROFILE (profile.html)
Title "Profile".
- Card with large avatar (initials "SC"), name, email, role badge "Owner", "Change photo" button.
- Form: Full name, Email (with note "Changing your email needs verification"), Job title, Phone (optional), Language select, Timezone select, Save button with validation (name required, valid email).
- "Password" card: current password, new password (with show/hide and the live checklist: 8+ characters, a letter, a number), confirm password, "Update password" button.
- "Your usage" card: tasks you ran this month (31), your spend this month ($4.18), favourite specialist (Research Analyst).
- "Sign out of all devices" secondary button, and a small danger link "Delete my account" that opens a confirmation dialog.
- Toast on save: "Saved (sample — not connected yet)".

Give me three complete HTML files: activity.html, settings.html, profile.html.
