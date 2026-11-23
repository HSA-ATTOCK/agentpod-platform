import {
  Bot,
  Calculator,
  ChartColumn,
  CircleCheck,
  Globe,
  LayoutTemplate,
  PenLine,
  Search,
  Smartphone,
  Target,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Baba's agent team as shown in the app. The live definitions (prompts, tools,
 * models) are in baba/team.mjs and are synced to Claude with `npm run baba:setup`.
 * Keep the names here identical to the names there: task records store them.
 */

export type TeamMember = {
  id: string;
  name: string;
  job: string;
  status: "active" | "coming_soon";
  tools: string[];
  icon: LucideIcon;
};

export const mainAgent = {
  name: "Baba",
  description:
    "Understands each request, plans the work, hands larger parts to specialists, checks their results and asks for approval before sensitive actions.",
  tools: ["Web search", "Read web pages", "Run code", "Create files"],
  icon: Bot,
};

export const specialists: TeamMember[] = [
  {
    id: "research_analyst",
    name: "Research Analyst",
    job: "Researches markets, competitors and any topic on the web, with a source for every fact.",
    status: "active",
    tools: ["Web search", "Read web pages", "Run code"],
    icon: Search,
  },
  {
    id: "writer",
    name: "Writer",
    job: "Writes reports, proposals, emails and presentations as Word, PDF and PowerPoint files.",
    status: "active",
    tools: ["Run code", "Create files"],
    icon: PenLine,
  },
  {
    id: "data_analyst",
    name: "Data Analyst",
    job: "Analyses spreadsheets and data, builds tables and charts, and finds trends and problems.",
    status: "active",
    tools: ["Run code", "Create files"],
    icon: ChartColumn,
  },
  { id: "website_builder", name: "Website Builder", job: "Builds complete, responsive websites you can preview and download.", status: "coming_soon", tools: [], icon: Globe },
  { id: "mobile_app_builder", name: "Mobile App Builder", job: "Builds iOS and Android apps with a live preview.", status: "coming_soon", tools: [], icon: Smartphone },
  { id: "designer", name: "UI/UX Designer", job: "Plans the look, layout and wording of websites and apps.", status: "coming_soon", tools: [], icon: LayoutTemplate },
  { id: "qa_reviewer", name: "QA Reviewer", job: "Tests what the builders made and sends bugs back to them.", status: "coming_soon", tools: [], icon: CircleCheck },
  { id: "marketing", name: "Marketing Strategist", job: "Plans campaigns, content, SEO and social posts.", status: "coming_soon", tools: [], icon: Target },
  { id: "finance", name: "Finance & Accounts Analyst", job: "Bookkeeping, financial reports, budgets and forecasts.", status: "coming_soon", tools: [], icon: Calculator },
  { id: "operations", name: "Operations Agent", job: "Inbox, CRM, scheduling and admin work through your connected tools.", status: "coming_soon", tools: [], icon: Workflow },
];

/** Names used in filters: Baba plus the specialists that can work today. */
export const activeAgentNames = [mainAgent.name, ...specialists.filter((s) => s.status === "active").map((s) => s.name)];
