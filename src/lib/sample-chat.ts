// SAMPLE CONVERSATIONS — Phase 1 only. Shows every kind of chat item.
// Company names and websites are fictional (".example" domains).
import type { Conversation } from "@/types/chat";

export const sampleConversations: Conversation[] = [
  {
    id: "conv_competitors",
    title: "Competitor pricing & sales email",
    updatedAt: "2026-11-22T10:42:00Z",
    isSample: true,
    tools: ["web_search", "code", "gmail"],
    items: [
      {
        id: "i1",
        type: "user",
        text: "Research our top 3 competitors (Northwind, Contoso, Globex), compare pricing and key features in a spreadsheet, then draft an email to the sales team with the highlights.",
        attachments: [{ id: "a1", name: "our-pricing-2026.pdf", sizeLabel: "1.2 MB" }],
      },
      {
        id: "i2",
        type: "progress",
        title: "Working on it",
        steps: [
          { id: "s1", label: "Planned the task", status: "done", detail: "Split the request into web research, reading your PDF, building a spreadsheet and drafting an email." },
          { id: "s2", label: "Searched the web for competitor pricing, 12 sources", status: "done", detail: "Looked at each competitor's pricing page and recent product announcements." },
          { id: "s3", label: "Read 6 pages and your pricing PDF", status: "done", detail: "Pulled out Acme Corp's 2026 plans and each competitor's tiers." },
          { id: "s4", label: "Building comparison spreadsheet", status: "running", detail: "Adding pricing tiers, free plans and a feature matrix." },
          { id: "s5", label: "Drafting email to the sales team", status: "pending", detail: "Starts once the spreadsheet is ready." },
        ],
      },
      {
        id: "i3",
        type: "sources",
        totalCount: 12,
        sources: [
          { id: "src1", title: "Northwind pricing", domain: "northwind.example", url: "https://northwind.example/pricing" },
          { id: "src2", title: "Contoso enterprise plans", domain: "contoso.example", url: "https://contoso.example/enterprise" },
          { id: "src3", title: "Globex cloud tiers", domain: "globex.example", url: "https://globex.example/plans" },
        ],
      },
      {
        id: "i4",
        type: "answer",
        blocks: [
          { type: "paragraph", text: "I compared your 2026 pricing PDF with the public pricing of Northwind, Contoso and Globex. Here's how Acme Corp stacks up:" },
          { type: "heading", text: "Key findings" },
          {
            type: "list",
            items: [
              { lead: "Lower entry point:", text: "Acme Corp's $29 per seat undercuts Contoso ($35) and Globex ($39), and includes SSO." },
              { lead: "Free plan advantage:", text: "Northwind has no free plan; our 5-seat free plan is a clear differentiator." },
              { lead: "Enterprise gap:", text: "Globex includes dedicated onboarding from 50 seats. Sales should lead with our 24/7 support." },
            ],
          },
          {
            type: "table",
            columns: ["Company", "Starting price", "Free plan", "Key strength"],
            highlightRowIndex: 0,
            rows: [
              ["Acme Corp (us)", "$29 / seat", "Yes (5 seats)", "SSO included, fastest setup"],
              ["Northwind", "$25 / seat", "No (14-day trial)", "Lowest base price"],
              ["Contoso", "$35 / seat", "Yes (3 seats)", "Deep ERP integrations"],
              ["Globex", "$39 / seat", "No", "Dedicated enterprise manager"],
            ],
          },
        ],
      },
      {
        id: "i5",
        type: "file",
        file: { id: "f1", name: "Competitor-comparison.xlsx", kind: "spreadsheet", sizeLabel: "24 KB" },
      },
      {
        id: "i6",
        type: "approval",
        action: "send_email",
        to: "sales-team@acme.example",
        subject: "Competitor highlights for this quarter",
        status: "pending",
        body: `Hi team,

Here are the key takeaways from this quarter's competitor pricing review:

1. Our $29 per seat plan beats Contoso ($35) and Globex ($39), and includes SSO.
2. Northwind has no free plan, so our 5-seat free plan is a strong opener.
3. The full Competitor-comparison.xlsx is attached for your deals.

Best,
Sarah`,
      },
      {
        id: "i7",
        type: "error",
        text: "I couldn't post to Slack because Slack isn't connected to your workspace yet.",
        action: { label: "Connect Slack", href: "/integrations" },
      },
    ],
  },
  {
    id: "conv_pipeline",
    title: "Q4 pipeline forecast analysis",
    updatedAt: "2026-11-22T09:15:00Z",
    isSample: true,
    tools: ["code"],
    items: [
      { id: "p1", type: "user", text: "Look at our Q4 pipeline export and tell me which deals are most at risk.", attachments: [{ id: "pa1", name: "pipeline-q4.csv", sizeLabel: "86 KB" }] },
      { id: "p2", type: "text", text: "Sample conversation: this is where Baba's analysis of the pipeline would appear." },
    ],
  },
  {
    id: "conv_onboarding",
    title: "Summarize enterprise onboarding calls",
    updatedAt: "2026-11-21T16:30:00Z",
    isSample: true,
    tools: ["files"],
    items: [
      { id: "o1", type: "user", text: "Summarize the main problems customers raised in last week's onboarding calls.", attachments: [] },
      { id: "o2", type: "text", text: "Sample conversation: this is where Baba's summary would appear." },
    ],
  },
  {
    id: "conv_faq",
    title: "Draft security FAQ for customers",
    updatedAt: "2026-11-21T11:20:00Z",
    isSample: true,
    tools: [],
    items: [
      { id: "q1", type: "user", text: "Draft a short security FAQ we can share with new customers.", attachments: [] },
      { id: "q2", type: "text", text: "Sample conversation: this is where Baba's draft FAQ would appear." },
    ],
  },
  {
    id: "conv_triage",
    title: "Weekly support ticket triage",
    updatedAt: "2026-11-17T08:05:00Z",
    isSample: true,
    tools: ["gmail"],
    items: [
      { id: "t1", type: "user", text: "Sort this week's support emails by urgency and draft replies for the urgent ones.", attachments: [] },
      { id: "t2", type: "text", text: "Sample conversation: this is where Baba's triage results would appear." },
    ],
  },
];
