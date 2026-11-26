import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Section, Stat, Td } from "@/components/admin/admin-table";
import { formatCents } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { overview } from "@/lib/platform/admin-data";

async function Content() {
  const ctx = await requirePlatformAdmin();
  const o = await overview(ctx);
  const max = Math.max(1, ...o.daily.map((d) => d.cents));
  const successRate = o.tasks30d.total ? Math.round((o.tasks30d.succeeded / o.tasks30d.total) * 100) : 0;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={o.users.total} hint={`${o.users.approved} approved`} />
        <Stat label="Waiting for approval" value={o.users.pending_approval} />
        <Stat label="Suspended / rejected" value={o.users.suspended + o.users.rejected} />
        <Stat label="Active users (7 days)" value={o.activeUsers7d} />
        <Stat label="Tasks (30 days)" value={o.tasks30d.total} hint={`${successRate}% succeeded · ${o.tasks30d.running} running`} />
        <Stat label="Failed tasks (30 days)" value={o.tasks30d.failed} />
        <Stat label="AI spend this month" value={formatCents(o.spend.monthCents)} hint={`Today ${formatCents(o.spend.todayCents)}`} />
        <Stat label="Workflows" value={o.workflows.total} hint={`${o.workflows.enabled} on · ${o.workflows.failed30d} failed runs (30d)`} />
      </div>

      <Section title="AI spend, last 30 days" description="Claude's reported cost per day (UTC). Platform revenue appears here once billing is connected.">
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex h-32 items-end gap-1" role="img" aria-label="Daily AI spend chart">
            {o.daily.map((d) => (
              <div key={d.day} className="group relative flex-1">
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(2, (d.cents / max) * 120)}px` }} />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-raised px-2 py-1 text-[11px] text-foreground shadow group-hover:block">
                  {d.day.slice(5)}: {formatCents(d.cents)} · {d.tasks} tasks
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-subtle">
            <span>{o.daily[0]?.day}</span>
            <span>{o.daily.at(-1)?.day}</span>
          </div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Agent utilisation (30 days)" description="Cost is split evenly between the agents that worked on a task (estimate).">
          <AdminTable head={["Agent", "Tasks", "Cost"]} empty={o.byAgent.length ? undefined : "No tasks yet."}>
            {o.byAgent.map((a) => (
              <tr key={a.name}>
                <Td>{a.name}</Td>
                <Td>{a.tasks}</Td>
                <Td>{formatCents(a.cents)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Section>
        <Section title="Most expensive tasks (30 days)">
          <AdminTable head={["Request", "Cost"]} empty={o.topRequests.length ? undefined : "No tasks yet."}>
            {o.topRequests.map((t, i) => (
              <tr key={i}>
                <Td className="max-w-md truncate">{t.request}</Td>
                <Td>{formatCents(t.cents)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Section>
      </div>

      <Section title="Connections in use">
        <div className="flex flex-wrap gap-2">
          {Object.entries(o.integrations).length === 0 && <p className="text-sm text-subtle">No connections yet.</p>}
          {Object.entries(o.integrations).map(([provider, n]) => (
            <span key={provider} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {provider}: <span className="text-foreground">{n}</span>
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <AdminPage title="Overview" description="The whole platform at a glance.">
      <Content />
    </AdminPage>
  );
}
