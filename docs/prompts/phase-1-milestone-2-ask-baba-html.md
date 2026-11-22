Design and build the main chat screen for a web app called Baba. Give me the result as HTML pages.

ABOUT THE PRODUCT
Baba is an AI assistant for businesses. Instead of clicking through many tools, the user simply tells Baba what they need in plain language, for example "research our top 3 competitors and make a comparison spreadsheet" or "draft a follow-up email to everyone who attended yesterday's webinar". Baba plans the steps, searches the web, reads documents, creates files (reports, spreadsheets, slides), uses connected business tools like Gmail, Slack and HubSpot, and asks the user for approval before doing anything sensitive such as sending an email or changing records. This screen is called "Ask Baba" and is the heart of the product. It must feel like a premium, serious AI workspace for businesses. It must NOT look like a basic chatbot or a copy of any existing chat app.

LOOK AND FEEL (same as the rest of the app)
- Dark design: near-black page background, charcoal cards, thin subtle borders, rounded corners.
- One bright accent colour: neon lime green. Use it sparingly, only for main buttons, the active menu item, the send button, important highlights and focus outlines.
- Clean modern font (Geist or Inter), generous spacing, very little clutter.
- Use exactly these colours:
  - Page background #0a0a0b
  - Cards #111113, raised cards #18181b, hover #1f1f23
  - Borders #27272a, stronger borders #3f3f46
  - Main text #fafafa, secondary text #a1a1aa, faint text #71717a
  - Accent lime #a3e635 (hover #bef264), with dark text #0a0a0b on lime buttons
  - Green for success #4ade80, yellow for warnings and approvals #fbbf24, red for errors #f87171, blue for info and "working" #60a5fa. Use soft see-through versions of these as backgrounds.
- Corner radius: about 16px for cards and about 10px for buttons and inputs.
- Use Lucide icons.
- The logo is a small "cpu" icon in a lime-tinted rounded square plus the word "Baba".

TECHNICAL RULES FOR THE HTML
- Use Tailwind CSS via the CDN for all styling. Do not write separate CSS files.
- Use only a little plain JavaScript, and only for interactions. No frameworks.
- Every page must work on phones, tablets, laptops and big screens, with no sideways scrolling. Design the phone version properly; don't just squeeze the desktop version.
- Make it accessible: labels on all inputs and icon buttons, everything usable with the keyboard, visible focus outlines, good contrast, status shown with text and not only colour, and the message list announced to screen readers when new messages appear (aria-live="polite").
- Give me the full code of every page. Don't skip or shorten any part.

THE APP FRAME
Use the same frame as the dashboard:
- Big screens: a fixed left sidebar with the logo, a workspace switcher showing "Acme Corp", menu items Ask Baba (new, first item, shown as active with a lime tint), Dashboard, AI Agents, Workflows, Integrations, Activity, then Settings and Profile at the bottom, and the user "Sarah Connor, sarah@acme.com" at the very bottom.
- Phones and tablets: no sidebar. A slim top bar with the logo, a bell and an avatar button, and a fixed bottom tab bar with Ask Baba, Home, Agents, Workflows, Activity (icon plus short label, active one in lime).

THE ASK BABA SCREEN LAYOUT
- Big screens, three areas inside the frame:
  1. A narrow conversations column on the left: a lime "New chat" button, a search box, and a list of past conversations grouped under "Today", "Yesterday" and "Previous 7 days". Each shows a title and a time. The current one is highlighted.
  2. The chat in the middle: the conversation title at the top with a small menu button (rename, delete), the messages, and the message box fixed at the bottom.
  3. A "Task details" panel on the right that can be closed. It shows what Baba is doing for the current task: the plan as a checklist of steps (done, in progress, waiting), "Files created" with download buttons, "Sources used" with links, and "Tools used" (for example Web search, Code, Gmail).
- Tablets: hide the conversations column behind a button and open the Task details panel as a slide-over from the right.
- Phones: the chat takes the full screen. A top row inside the chat has a back/menu button that opens the conversation list as a full-screen sheet, the conversation title, and a button that opens Task details as a bottom sheet. The message box sits just above the bottom tab bar and messages never hide behind it.

THE MESSAGE BOX (composer)
- A multi-line text box that grows as you type (up to about 8 lines, then scrolls), with the placeholder "Ask Baba to do anything…".
- A paperclip button to attach files. Attached files appear as small removable chips above the text box (file icon, name, size, an x to remove).
- A lime round send button with an arrow icon. It is disabled when the box is empty. Enter sends, Shift+Enter makes a new line.
- While Baba is working, the send button turns into a "Stop" button.
- Small faint text under the box: "Baba can make mistakes. Sensitive actions always need your approval."

PAGE 1: NEW CHAT (empty state)
- In the middle of the chat area: the Baba logo mark, a large greeting "What can Baba do for you today?" and a short line under it: "Describe a task in plain language. Baba will plan it, do the work and ask before anything sensitive."
- The message box is shown larger, in the middle of the screen, under the greeting.
- Below it, six suggestion cards in a grid (3 columns on desktop, 2 on tablet, 1 on phone, or a horizontal scroll row on phones). Each has an icon, a short title and one line of description:
  - Research competitors: "Compare our top 3 competitors on pricing and features"
  - Draft follow-up emails: "Write follow-ups for everyone who attended yesterday's webinar"
  - Analyze a spreadsheet: "Find trends and problems in this month's sales data"
  - Weekly report: "Summarize this week's support tickets into a short report"
  - Plan a campaign: "Plan a 4-week product launch campaign"
  - Triage the inbox: "Sort new support emails by urgency and draft replies"
- Clicking a card puts its text into the message box and focuses it.

PAGE 2: A CONVERSATION IN PROGRESS
Show a realistic example conversation that includes every type of message below, so I can see how each one looks:
1. The user's message, shown on the right in a raised card, with a small attached-file chip: "Research our top 3 competitors (Northwind, Contoso, Globex), compare pricing and key features in a spreadsheet, then draft an email to the sales team with the highlights." with the file "our-pricing-2026.pdf".
2. Baba's progress block (on the left, with the Baba logo mark as its avatar): a title like "Working on it" with a list of live steps, each with a status icon:
   - "Planned the task" (done, green check)
   - "Searched the web for competitor pricing", 12 sources (done)
   - "Read 6 pages and your pricing PDF" (done)
   - "Building comparison spreadsheet" (in progress, small blue spinner)
   - "Drafting email to the sales team" (waiting, grey circle)
   A "Show details" toggle expands each step to show a short line of what was done.
3. A sources row: small cards for 3 web sources with a letter icon, page title and website name, plus a "+9 more" chip.
4. Baba's written answer on the left (no bubble, just well-formatted text): a short intro, a heading, a bullet list of key findings, and a small comparison table (Company, Starting price, Free plan, Key strength) with 4 rows including "Acme Corp (us)".
5. A file card: a spreadsheet icon, "Competitor-comparison.xlsx", "Spreadsheet · 24 KB", with "Preview" and "Download" buttons.
6. An approval card with a yellow accent: title "Baba wants to send an email", a line "This action needs your approval", then To: sales-team@acme.com, Subject: "Competitor highlights for this quarter", and a preview of the email body in a bordered box (a few lines, then a fade with "Show full email"). Buttons: lime "Approve and send", "Edit", and "Reject". Also design the two finished states of this card: "Approved — email sent at 14:32" (green) and "Rejected — nothing was sent" (grey).
7. An error message from Baba with a red accent: "I couldn't post to Slack because Slack isn't connected to your workspace yet." with a "Connect Slack" button.
8. A "Baba is thinking…" indicator with three animated dots, shown at the end of the conversation.
- Under each of Baba's messages, small icon buttons appear on hover (always visible on phones): Copy, Retry, Helpful, Not helpful. They need text labels for screen readers.
- Show a "Jump to latest" round button at the bottom right of the chat when the user has scrolled up.
- The Task details panel on the right matches this conversation: the 5 plan steps, the spreadsheet under "Files created", the sources, and the tools used (Web search, Code, Gmail).

INTERACTIONS TO MAKE WORK WITH JAVASCRIPT
- Typing in the message box enables the send button; Enter sends, Shift+Enter adds a new line; the box grows with the text.
- Sending a message adds it to the chat as the user's message, shows the thinking indicator for about 1.5 seconds, then adds a reply from Baba saying exactly: "Baba isn't connected to the AI yet. This will be enabled in the next phase." Never fake a real answer.
- The Stop button appears while the thinking indicator is showing and cancels it.
- Attaching files with the paperclip shows file chips; the x removes them (no real upload).
- Approve and Reject switch the approval card to its finished state. Edit turns the email preview into an editable text box with "Save" and "Cancel".
- Suggestion cards fill the message box.
- Opening and closing the conversation list, the Task details panel and the phone sheets, with Escape closing whichever is open and focus returning to the button that opened it.
- "Show details" toggles in the progress block.

Give me two complete HTML files: one for the new chat page and one for the conversation in progress.
