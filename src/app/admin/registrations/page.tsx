import type { Metadata } from "next";
import { AccountActions } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { LocalTime } from "@/components/ui/local-time";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAdminUsers } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Registrations" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const users = await listAdminUsers(ctx, "pending_approval");
  return (
    <AdminTable head={["Person", "Signed up", "Email confirmed", "Decision"]} empty={users.length ? undefined : "Nobody is waiting for approval."}>
      {users.map((u) => (
        <tr key={u.id}>
          <Td>
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-muted">{u.email}</p>
          </Td>
          <Td>
            <LocalTime iso={u.createdAt} />
          </Td>
          <Td>{u.emailConfirmed ? "Yes" : <span className="text-warning">Not yet</span>}</Td>
          <Td>
            <AccountActions userId={u.id} email={u.email} status={u.status} isAdmin={u.isAdmin} isSelf={u.id === ctx.user.id} />
          </Td>
        </tr>
      ))}
    </AdminTable>
  );
}

export default function RegistrationsPage() {
  return (
    <AdminPage title="Registration requests" description="New accounts wait here until you approve or reject them. They get an email either way.">
      <Content />
    </AdminPage>
  );
}
