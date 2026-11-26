import type { Metadata } from "next";
import Link from "next/link";
import { AccountActions } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, StatusBadge, Td } from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { routes } from "@/config/routes";
import { formatCents } from "@/lib/format";
import type { AccountStatus } from "@/lib/platform/account";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAdminUsers } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Users" };

const FILTERS: { label: string; value?: AccountStatus }[] = [
  { label: "All" },
  { label: "Approved", value: "approved" },
  { label: "Waiting", value: "pending_approval" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

async function Content({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const [ctx, params] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const status = FILTERS.find((f) => f.value === params.status)?.value;
  const q = (params.q ?? "").toLowerCase().slice(0, 100);
  const users = (await listAdminUsers(ctx, status)).filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `${routes.admin}/users?status=${f.value}` : `${routes.admin}/users`}
            className={`rounded-full border px-3 py-1 text-xs ${f.value === status ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto" action={`${routes.admin}/users`}>
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={params.q} placeholder="Search name or email" aria-label="Search users" className="h-9 rounded-control border border-border bg-surface px-3 text-sm" />
        </form>
      </div>
      <AdminTable head={["Person", "Status", "Workspaces", "Last 30 days", "Last sign-in", "Actions"]} empty={users.length ? undefined : "No accounts match."}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td>
              <p className="font-medium">
                {u.name} {u.isAdmin && <Badge tone="warning">Admin</Badge>}
              </p>
              <p className="text-xs text-muted">{u.email}</p>
              <p className="text-[11px] text-subtle">
                Joined <LocalTime iso={u.createdAt} format="date" />
              </p>
            </Td>
            <Td>
              <StatusBadge status={u.status} />
              {u.reason && <p className="mt-1 max-w-[14rem] text-xs text-muted">{u.reason}</p>}
            </Td>
            <Td className="text-xs">
              {u.workspaces.map((w) => (
                <p key={w.id}>
                  {w.name} <span className="text-subtle">({w.role})</span>
                </p>
              ))}
            </Td>
            <Td className="text-xs">
              {u.tasks30d} tasks
              <br />
              {formatCents(u.spend30dCents)}
            </Td>
            <Td className="text-xs">{u.lastSignIn ? <LocalTime iso={u.lastSignIn} /> : "Never"}</Td>
            <Td>
              <AccountActions userId={u.id} email={u.email} status={u.status} isAdmin={u.isAdmin} isSelf={u.id === ctx.user.id} />
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

export default function UsersPage(props: { searchParams: Promise<{ status?: string; q?: string }> }) {
  return (
    <AdminPage title="Users" description="Every account on the platform. Suspending someone blocks all their data access immediately.">
      <Content searchParams={props.searchParams} />
    </AdminPage>
  );
}
