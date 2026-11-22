Design and build the first screens for a web app called Baba. Give me the result as HTML pages.

ABOUT THE PRODUCT
Baba is a platform where businesses create AI agents that do their work for them: researching leads, answering customer questions, processing documents, planning marketing, and doing research. Businesses can also chain agents into workflows, connect tools like Gmail and Slack, and review everything the agents did. It is a serious business product for small and medium companies, and it should look like a premium modern SaaS dashboard. It must NOT look like a simple chatbot website.

LOOK AND FEEL
- Dark design: near-black page background, charcoal cards, thin subtle borders, rounded corners.
- One bright accent colour: neon lime green. Use it sparingly, only for main buttons, the active menu item, important numbers and focus outlines.
- Clean modern font (Geist or Inter), lots of breathing room, very little clutter.
- Use exactly these colours:
  - Page background #0a0a0b
  - Cards #111113, raised cards #18181b, hover #1f1f23
  - Borders #27272a, stronger borders #3f3f46
  - Main text #fafafa, secondary text #a1a1aa, faint text #71717a
  - Accent lime #a3e635 (hover #bef264), with dark text #0a0a0b on lime buttons
  - Green for success #4ade80, yellow for warnings #fbbf24, red for errors #f87171, blue for info #60a5fa. Use soft see-through versions of these as badge backgrounds.
- Corner radius: about 16px for cards and about 10px for buttons and inputs.
- Use Lucide icons.

TECHNICAL RULES FOR THE HTML
- Use Tailwind CSS via the CDN for all styling. Do not write separate CSS files.
- Make one separate, complete HTML file per page.
- Use only a little plain JavaScript, and only for interactions (menus, show/hide password, form checks). No frameworks.
- Every page must work on phones, tablets, laptops and big screens, with no sideways scrolling. Design the phone version properly; don't just squeeze the desktop version.
- Make it accessible: real labels on form fields, buttons usable with the keyboard, visible focus outlines, good contrast, and status shown with text and not only colour.
- Give me the full code of every page. Don't skip or shorten any part.

THE PAGES I NEED

1. Landing page (the public homepage)
- Top bar: Baba logo (a simple icon in a lime-tinted rounded square plus the word "Baba"), links to Features, Use cases and How it works, a "Sign in" button and a lime "Get started" button. On phones these go into a menu that opens from a menu button.
- Big hero section: a headline like "Put AI agents to work across your business", a short subheading, a lime "Start free" button and a "See how it works" button. Next to it, a preview of the app built in HTML (not an image). It shows a small workspace panel with a few agents and their status badges, and a workflow chain: New lead → Research → Qualify → Draft follow-up → Approve → Send.
- Features: six cards. Custom AI agents, Multi-step workflows, Business integrations, Human approval for sensitive actions, Activity and audit history, Team workspaces.
- Use cases: Sales and lead generation, Customer support, Business operations, Marketing, Research and analysis. Each has three short example tasks.
- How it works: three steps. Create your workspace, configure your agents, then automate and review.
- A short trust section: each business gets its own private workspace, sensitive actions need your approval, and you choose which tools agents can use. Don't add fake customer logos, testimonials, awards or user counts.
- A final call-to-action section, then a footer with the logo, a short description, link columns and the copyright.

2. Sign in page
- Big screens: two halves. The left side has the logo, a short value message and a subtle lime-tinted background decoration. The right side has the form card. Phones: just the logo and the form card.
- The form has a "Continue with Google" button, an "or" divider, email, password with a show/hide eye button, a "Forgot password?" link, a lime "Sign in" button, and "Don't have an account? Sign up".
- Show red error messages under fields when they are empty or the email is invalid.
- When submitted, the button shows a loading spinner. Then show a message box saying: "Authentication isn't connected yet. It will be enabled in the next phase." Never pretend the login worked.

3. Sign up page
- Same layout as sign in.
- Fields: Google button, divider, full name, work email, password, confirm password, and a checkbox to agree to the Terms and Privacy Policy.
- Under the password, a live checklist that ticks off as you type: at least 8 characters, contains a letter, contains a number.
- Errors for empty fields, an invalid email, passwords that don't match, or the box not ticked.
- Same loading state and the same "isn't connected yet" message on submit. Link to sign in.

4. Forgot password page
- Same layout. One email field and a "Send reset link" button.
- After submitting, show a loading state, then a green success message: "If an account exists for that email, we've sent a reset link." Add a link back to sign in.

5. Check your email page (email verification)
- Same layout. A mail icon, "Check your inbox", and a short explanation that we sent a verification link.
- A "Resend email" button with a loading state and then a success message. A "Back to sign in" link.

6. Dashboard (the main app screen after logging in)
This page also defines the app frame that every logged-in page will share.
- Big screens: a fixed left sidebar containing:
  - the logo
  - a workspace switcher showing the company name "Acme Corp" with an up/down arrows icon
  - menu items: Dashboard, AI Agents, Workflows, Integrations, Activity. Dashboard is shown as active with a lime tint.
  - Settings and Profile at the bottom
  - the user's avatar, name and email at the very bottom
- A top bar above the content with a search box (showing a "⌘K" hint), a notifications bell and a lime "Create agent" button.
- Phones: no sidebar. A slim top bar with the logo, the bell and an avatar button that opens a small menu (workspace name, Settings, Profile, Sign out). A fixed bottom tab bar with the five main menu items as icon plus short label, the active one in lime. Make sure content never hides behind the tab bar.
- Dashboard content:
  - "Welcome back, Sarah", the workspace name, and a small blue "Sample data" badge.
  - Stat cards (2 per row on phones, 4 per row on desktop): Total agents, Active agents, Total workflows, Executions this week, Successful tasks, Failed tasks.
  - Quick actions: Create agent, Create workflow, Connect an integration, View activity.
  - Recent executions: a table on desktop with task name, agent, status, start time and duration. On phones show the same thing as stacked cards. Add a "View all" link.
  - Agents overview: a short list of agents with their category, a status badge and the time they were last active. Add a "View all" link.
  - Recent activity: a timeline of events, for example "Lead Research Agent finished a task", "Support Triage Agent was paused", "Approval requested for a follow-up email".
  - Use realistic sample data. Six agents: Lead Research Agent (Sales, Active), Support Triage Agent (Support, Active), Invoice Processing Agent (Operations, Paused), Campaign Planner (Marketing, Draft), Market Research Agent (Research, Active), Follow-up Email Agent (Sales, Error). Also about ten recent executions with statuses Succeeded, Failed, Running and Queued.
  - Status badge colours: Active and Succeeded green, Paused and Queued yellow, Draft grey, Error and Failed red, Running blue.
  - Also design the empty version of each list. For agents: an icon, "You haven't created any AI agents yet." and a lime "Create your first agent" button. Do the same for workflows and executions. Put these empty versions at the bottom of the page, or in a second copy of the dashboard, so I can see them.

Give me all six pages, each as its own complete HTML file.
