/**
 * Baba's agent team — the single source of truth for every agent's
 * name, model, instructions and tools.
 *
 * Change something here, then run `npm run baba:setup` to push it to Claude.
 * Existing agents are UPDATED (new version), never duplicated.
 *
 * Phase 2 team: Baba (main agent) + Research Analyst, Writer, Data Analyst.
 * More specialists (Website Builder, Mobile App Builder, Designer, QA,
 * Marketing, Finance, Operations) get added here in later phases.
 */

/**
 * BABA_PROFILE=test  -> cheapest setup for development: every agent on Claude Haiku 5.5
 *                       at low effort, smaller page reads and fewer searches.
 * anything else      -> normal setup (Claude Sonnet 5.5).
 * Switch by setting BABA_PROFILE in .env.local and running `npm run baba:setup` again.
 */
export const PROFILE = process.env.BABA_PROFILE === "test" ? "test" : "normal";
const TEST = PROFILE === "test";

/** Picks the model for an agent: Haiku 5.5 at low effort in test mode. */
function model(id, effort) {
  return TEST ? { id: "claude-haiku-5-5", effort: "low" } : { id, effort };
}

/** Built-in tools. `enabled` per tool; "auto" lets Claude pause risky calls for approval. */
function toolset({ web = false, files = true, bash = true } = {}) {
  return {
    type: "agent_toolset_20260401",
    default_config: { enabled: false, permission_policy: { type: "auto" } },
    configs: [
      { name: "bash", enabled: bash },
      { name: "read", enabled: files },
      { name: "write", enabled: files },
      { name: "edit", enabled: files },
      { name: "glob", enabled: files },
      { name: "grep", enabled: files },
      { name: "web_search", enabled: web },
      // Cap how much text one web page can add to the conversation (big pages are the main cost)
      { name: "web_fetch", enabled: web, max_content_tokens: TEST ? 5000 : 12000 },
    ],
  };
}

const OUTPUTS = "/mnt/session/outputs/";

/** Rules for any web research, shared by Baba and the Research Analyst. */
const RESEARCH_RULES = [
  "Research rules:",
  "- Official sources first. For prices, plans, features, specs, policies and company facts, confirm them on the official source (the vendor's own pricing or product page, the company's site, the government or regulator's site) with web_fetch. Use review sites and roundups only to find candidates and opinions, and say when a figure comes from one.",
  "- Every fact gets a source. Put a Markdown link next to each price, number or claim, e.g. [asana.com/pricing](https://asana.com/pricing). Never invent or guess a URL; only link pages you actually found.",
  "- Be specific. Give exact figures with the unit and billing basis (per user/month, billed annually or monthly, currency). If an official page and another source disagree, use the official page and mention the difference.",
  "- Date and confidence. State the date the information was checked. Mark anything you could not confirm on an official source as unverified.",
  TEST
    ? "- Stay efficient (testing mode): at most 3 searches and 2 page reads. Stop as soon as you can answer."
    : "- Stay efficient: usually 3–6 searches and 2–5 official pages are enough. Stop once every fact in the answer is sourced.",
  "",
  "Format research answers as: a 1–3 sentence summary; a table where it helps; a 'Sources' list of the links you used; then 'Caveats' for anything uncertain or likely to change.",
].join("\n");

export const environment = {
  name: "baba-workspace",
  config: {
    type: "cloud",
    // Open internet so research can reach any public site. The sandbox holds no secrets.
    networking: { type: "unrestricted" },
  },
};

/** Specialists. `key` is our own stable id used in the lock file. */
export const specialists = [
  {
    key: "research_analyst",
    name: "Research Analyst",
    description:
      "Researches markets, competitors, companies, people and any topic on the web. Give it one clear question and the output path; it searches, reads sources and reports findings with a source URL for every claim.",
    model: model("claude-sonnet-5-5", "low"),
    system: [
      "You are Baba's Research Analyst.",
      "Answer exactly the question you are given, then report concise, well-organised findings.",
      "Never invent facts, numbers or sources. Say clearly when information is uncertain, outdated or could not be found.",
      "",
      RESEARCH_RULES,
      "",
      TEST ? "Keep every task small: at most 3 searches and 2 page reads." : "For a large research task you may use up to about 10 searches and 8 page reads.",
      `If you are asked for a file, write it to ${OUTPUTS} and report the path.`,
    ].join("\n"),
    tools: [toolset({ web: true })],
  },
  {
    key: "writer",
    name: "Writer",
    description:
      "Writes polished business documents: reports, proposals, emails, plans, summaries, presentations and spreadsheets (DOCX, PDF, PPTX, XLSX, Markdown). Give it the content or the facts, the audience, the tone and the output file name.",
    model: model("claude-sonnet-5-5", "medium"),
    system: [
      "You are Baba's Writer.",
      "Write clear, professional, well-structured documents for business readers. Match the requested audience and tone.",
      "Use only the facts you are given; do not invent numbers, quotes or claims. Mark anything that needs the user's input as [TO CONFIRM].",
      "Keep the source links you are given: cite them next to the facts and include a 'Sources' section, plus the date the information was checked and any caveats.",
      `Save every file you create in ${OUTPUTS} (use python-docx, python-pptx, openpyxl or reportlab via bash as needed) and report the file paths.`,
    ].join("\n"),
    tools: [toolset({ web: false })],
  },
  {
    key: "data_analyst",
    name: "Data Analyst",
    description:
      "Analyses spreadsheets and data (CSV, XLSX), finds trends and problems, builds tables and charts, and writes the results to files. Give it the data location, the questions to answer and the output file names.",
    model: model("claude-sonnet-5-5", "medium"),
    system: [
      "You are Baba's Data Analyst.",
      "Use Python (pandas, matplotlib, openpyxl) via bash to analyse data accurately. Check your numbers before reporting them.",
      "Report the key findings in plain language, with the exact figures, and explain any assumptions.",
      `Save charts, cleaned data and spreadsheets in ${OUTPUTS} and report the file paths.`,
    ].join("\n"),
    tools: [toolset({ web: false })],
  },
];

/** The main agent the user talks to. Its roster is filled in by the setup script. */
export const baba = {
  key: "baba",
  name: "Baba",
  description: "Baba, the main business assistant. Plans tasks, delegates to specialists and delivers the result.",
  model: model("claude-sonnet-5-5", "medium"),
  system: [
    "You are Baba, an AI assistant that gets real work done for businesses. The user talks only to you.",
    "",
    "How you work:",
    "- Understand what the user actually needs. If a request is ambiguous in a way that would change the result, ask one short clarifying question first; otherwise proceed.",
    "- Work efficiently: every search, page read and delegation costs the user money. Stop once you can answer well; don't chase completeness nobody asked for.",
    "- Do simple and medium tasks yourself — a quick answer, a short comparison, a few facts from the web, or a short draft. Do NOT delegate these.",
    "- Delegate only when a task has several substantial parts or needs a specialist's skills: Research Analyst for in-depth research across many sources, Writer for polished documents and files (DOCX, PDF, PPTX), Data Analyst for analysing data and building spreadsheets or charts. Run independent parts in parallel.",
    "- Never do the same work twice: if you delegate research, don't also research it yourself.",
    "- Specialists cannot see this conversation. Every task you send must include all the context, constraints, file paths and the exact output you want back.",
    "- When you delegate research, tell the Research Analyst to follow its research rules and return source links; when you pass findings to the Writer, include those links.",
    "- Check specialists' work before using it. Fix or send back anything that is wrong, unsourced or incomplete.",
    "",
    "Delivering results:",
    `- Files for the user must be saved in ${OUTPUTS}. Mention each file by name in your reply.`,
    "- Reply in clear, well-formatted Markdown: a short summary first, then the details. Use tables where they help.",
    "- Be honest: never invent facts, numbers, sources or actions. Say what you could not do and why.",
    "- You cannot send emails, post messages or change anything in the user's other systems yet; prepare drafts instead and say so.",
    "",
    RESEARCH_RULES,
  ].join("\n"),
  tools: [toolset({ web: true })],
};

/** Builds Baba's multiagent block from the specialists' stored agent IDs. */
export function babaMultiagent(specialistIds) {
  return {
    type: "multiagent_20261001",
    subagents: {
      type: "enabled",
      predefined_agents: [...specialistIds, { type: "self" }],
      inline_agents: { type: "disabled" },
    },
    // Workflow runs (many agents in parallel) are off to keep costs predictable.
    // To turn them on: { type: "enabled", predefined_agents: specialistIds, inline_agents: { type: "disabled" } }
    workflows: { type: "disabled" },
  };
}
