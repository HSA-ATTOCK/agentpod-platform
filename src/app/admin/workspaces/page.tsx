import type { Metadata } from "next";
import { WorkspaceLimitsButton } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { LocalTime } from "@/components/ui/local-time";
import { formatCents } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAdminWorkspaces, listAgents, listPlans } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Workspaces" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const [workspaces, plans, agents] = await Promise.all([listAdminWorkspaces(ctx), listPlans(ctx), listAgents(ctx)]);
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const specialists = agents.filter((a) => a.category === "specialist").map((a) => ({ key: a.key, name: a.name }));
  return (
    <AdminTable head={["Workspace", "Plan & limits", "This month", "Members", "Usage", ""]} empty={workspaces.length ? undefined : "No workspaces."}>
      {workspaces.map((w) => {
        const plan = w.limits?.planId ? plans.find((p) => p.id === w.limits!.planId) : undefined;
        const cap = w.limits?.monthlyLimitUsd ?? (plan ? Number(plan.monthly_limit_usd) : null);
        return (
          <tr key={w.id}>
            <Td>
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-muted">{w.ownerEmail ?? "No owner"}</p>
              <p className="text-[11px] text-subtle">
                Created <LocalTime iso={w.createdAt} format="date" />
              </p>
            </Td>
            <Td className="text-xs">
              <p>{w.limits?.planId ? planName.get(w.limits.planId) : "No plan"}</p>
              <p className="text-muted">Platform cap: {cap ? `$${cap}/month` : "none"}{w.limits?.dailyLimitUsd ? ` · $${w.limits.dailyLimitUsd}/day` : ""}</p>
              <p className="text-muted">Their own limit: ${w.ownMonthlyLimitUsd}/month</p>
              {w.limits?.allowedAgents && <p className="text-warning">Agents limited: {w.limits.allowedAgents.join(", ") || "none"}</p>}
              {w.limits?.note && <p className="text-subtle">{w.limits.note}</p>}
            </Td>
            <Td>{formatCents(w.spendMonthCents)}</Td>
            <Td>{w.members}</Td>
            <Td className="text-xs">
              {w.integrations} connections
              <br />
              {w.workflows} workflows
            </Td>
            <Td>
              <WorkspaceLimitsButton
                workspaceId={w.id}
                workspaceName={w.name}
                plans={plans.map((p) => ({ id: p.id, name: p.name }))}
                agents={specialists}
                limits={w.limits}
              />
            </Td>
          </tr>
        );
      })}
    </AdminTable>
  );
}

export default function WorkspacesPage() {
  return (
    <AdminPage title="Workspaces" description="Customer organisations. Set a plan, spending caps (enforced before every task) and which agents they may use.">
      <Content />
    </AdminPage>
  );
}
