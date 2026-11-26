import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Section, Stat, Td } from "@/components/admin/admin-table";
import { formatCents } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAdminUsers, listAdminWorkspaces, overview } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Usage & costs" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const [o, users, workspaces] = await Promise.all([overview(ctx), listAdminUsers(ctx), listAdminWorkspaces(ctx)]);
  const topUsers = users.filter((u) => u.spend30dCents > 0).sort((a, b) => b.spend30dCents - a.spend30dCents).slice(0, 20);
  const topWs = workspaces.filter((w) => w.spendMonthCents > 0).sort((a, b) => b.spendMonthCents - a.spendMonthCents).slice(0, 20);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={formatCents(o.spend.todayCents)} />
        <Stat label="This month" value={formatCents(o.spend.monthCents)} />
        <Stat label="Last 30 days" value={formatCents(o.spend.days30Cents)} />
        <Stat label="Average per task (30d)" value={formatCents(o.tasks30d.total ? Math.round(o.spend.days30Cents / o.tasks30d.total) : 0)} />
      </div>
      <p className="text-xs text-muted">
        Costs are what Claude reports for each task (model usage). Model provider: Anthropic (Claude). Infrastructure and integration costs aren&apos;t
        measured yet.
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="By user (30 days)">
          <AdminTable head={["User", "Tasks", "Cost"]} empty={topUsers.length ? undefined : "No usage yet."}>
            {topUsers.map((u) => (
              <tr key={u.id}>
                <Td>{u.email}</Td>
                <Td>{u.tasks30d}</Td>
                <Td>{formatCents(u.spend30dCents)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Section>
        <Section title="By workspace (this month)">
          <AdminTable head={["Workspace", "Cost"]} empty={topWs.length ? undefined : "No usage yet."}>
            {topWs.map((w) => (
              <tr key={w.id}>
                <Td>{w.name}</Td>
                <Td>{formatCents(w.spendMonthCents)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Section>
        <Section title="By agent (30 days, estimate)">
          <AdminTable head={["Agent", "Tasks", "Cost"]} empty={o.byAgent.length ? undefined : "No usage yet."}>
            {o.byAgent.map((a) => (
              <tr key={a.name}>
                <Td>{a.name}</Td>
                <Td>{a.tasks}</Td>
                <Td>{formatCents(a.cents)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Section>
      </div>
    </div>
  );
}

export default function UsagePage() {
  return (
    <AdminPage title="Usage & costs" description="Where the AI spend goes. Limits are set per workspace (Workspaces) and per plan (Plans).">
      <Content />
    </AdminPage>
  );
}
