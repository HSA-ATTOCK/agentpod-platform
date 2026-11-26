import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { LocalTime } from "@/components/ui/local-time";
import { routes } from "@/config/routes";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAudit } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Audit log" };

async function Content({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const [ctx, params] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const rows = await listAudit(ctx, { action: params.action?.slice(0, 60), limit: 300 });
  return (
    <div className="space-y-4">
      <form action={`${routes.admin}/audit`} className="flex gap-2">
        <input name="action" defaultValue={params.action} placeholder="Filter by action, e.g. account. or integration." aria-label="Filter by action" className="h-9 w-80 max-w-full rounded-control border border-border bg-surface px-3 text-sm" />
      </form>
      <AdminTable head={["When", "Who", "Action", "Target", "Details"]} empty={rows.length ? undefined : "Nothing recorded yet."}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap text-xs">
              <LocalTime iso={r.created_at} />
            </Td>
            <Td className="text-xs">{r.actor_email ?? r.actor_id ?? "system"}</Td>
            <Td className="font-mono text-xs">{r.action}</Td>
            <Td className="text-xs">
              {r.target_type} {r.target_id && <span className="text-subtle">{r.target_id.slice(0, 13)}</span>}
            </Td>
            <Td>
              <code className="block max-w-md truncate text-[11px] text-muted" title={JSON.stringify(r.details)}>
                {JSON.stringify(r.details)}
              </code>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

export default function AuditPage(props: { searchParams: Promise<{ action?: string }> }) {
  return (
    <AdminPage title="Audit log" description="Append-only record of approvals, permission changes, connections, approvals of Baba's actions and admin changes. Entries can't be edited or deleted.">
      <Content searchParams={props.searchParams} />
    </AdminPage>
  );
}
