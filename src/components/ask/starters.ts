/** Icon names; the screen maps them to pictures (kept out of here so this file has no UI code). */
export type StarterIcon = "calendar" | "database" | "file" | "globe" | "inbox" | "mail" | "megaphone" | "message" | "receipt" | "search" | "shop" | "users";
export type Starter = { icon: StarterIcon; title: string; prompt: string };

/** Ideas that use the tools this workspace has connected. */
const CONNECTED: { needs: string[]; starter: Starter }[] = [
  {
    needs: ["google", "microsoft"],
    starter: { icon: "inbox", title: "Catch up on email", prompt: "Summarise my unread emails from the last 24 hours and tell me which ones need a reply." },
  },
  {
    needs: ["google", "microsoft"],
    starter: { icon: "calendar", title: "Plan my day", prompt: "Look at my calendar for today and tomorrow and tell me what I need to prepare." },
  },
  {
    needs: ["quickbooks", "xero"],
    starter: { icon: "receipt", title: "Unpaid invoices", prompt: "Which invoices are overdue? List them with amounts, and draft polite reminder emails for me to review (don't send them)." },
  },
  {
    needs: ["shopify"],
    starter: { icon: "shop", title: "How's the shop doing?", prompt: "How did my shop do this week compared with last week? Highlight the best sellers." },
  },
  {
    needs: ["hubspot"],
    starter: { icon: "users", title: "Deals to follow up", prompt: "Which HubSpot deals haven't been updated in 2 weeks? Suggest a next step for each." },
  },
  {
    needs: ["slack"],
    starter: { icon: "message", title: "Slack catch-up", prompt: "Summarise the most important Slack messages from today." },
  },
  {
    needs: ["database"],
    starter: { icon: "database", title: "Explore my data", prompt: "Look at my connected database and give me 3 useful insights about the business." },
  },
];

/** Ideas that work without any connection. Prompts ask Baba to ask for the details it needs. */
const GENERAL: Starter[] = [
  { icon: "globe", title: "Build a website", prompt: "Build a simple website for my business. Ask me the questions you need first." },
  { icon: "search", title: "Research competitors", prompt: "Research my top 3 competitors and compare their pricing and features. Ask me who they are if you don't know." },
  { icon: "megaphone", title: "Social media posts", prompt: "Write 5 social media posts for this week about my business. Ask me what to focus on first." },
  { icon: "mail", title: "Write an email", prompt: "Help me write a professional email. Ask me who it's for and what it should say." },
  { icon: "calendar", title: "Plan a campaign", prompt: "Plan a 4-week marketing campaign for my business. Ask me about the product and budget first." },
];

const DOCUMENTS: Starter = { icon: "file", title: "Ask my documents", prompt: "What are the most important points in my knowledge base documents?" };

/** Up to six ideas: ones for connected tools first, then general ones. */
export function startersFor(connected: string[], hasDocuments: boolean): Starter[] {
  const have = new Set(connected);
  const picked = CONNECTED.filter((c) => c.needs.some((n) => have.has(n))).map((c) => c.starter);
  if (hasDocuments) picked.push(DOCUMENTS);
  return [...picked, ...GENERAL].slice(0, 6);
}
