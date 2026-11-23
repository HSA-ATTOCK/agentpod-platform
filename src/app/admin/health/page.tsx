import { CircleCheck, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Section, Td } from "@/components/admin/admin-table";
import { LocalTime } from "@/components/ui/local-time";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { healthChecks, listFailedTasks } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "System health" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const [checks, failed] = await Promise.all([healthChecks(ctx), listFailedTasks(ctx)]);
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.name} className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
            {c.ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-5 text-success" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-warning" />}
            <div>
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <p className="text-xs text-muted">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <Section title="Recent failed executions">
        <AdminTable head={["When", "Request", "Error"]} empty={failed.length ? undefined : "No failed tasks. 🎉"}>
          {failed.map((t) => (
            <tr key={t.id}>
              <Td className="whitespace-nowrap text-xs">
                <LocalTime iso={t.started_at} />
              </Td>
              <Td className="max-w-xs truncate text-xs">{t.request}</Td>
              <Td className="max-w-sm text-xs text-danger">{t.error ?? "—"}</Td>
            </tr>
          ))}
        </AdminTable>
      </Section>
    </div>
  );
}

export default function HealthPage() {
  return (
    <AdminPage title="System health" description="Live checks of the services Baba depends on. Secret values are never shown.">
      <Content />
    </AdminPage>
  );
}
