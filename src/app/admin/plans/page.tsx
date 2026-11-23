import type { Metadata } from "next";
import { PlanEditor, type PlanRow } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listPlans } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Plans" };

const n = (v: number | null) => (v === null ? "∞" : String(v));

async function Content() {
  const ctx = await requirePlatformAdmin();
  const plans = await listPlans(ctx);
  return (
    <AdminTable head={["Plan", "Price", "Limits", "Quotas", "Agents", ""]}>
      {plans.map((p) => (
        <tr key={p.id}>
          <Td>
            <p className="font-medium">
              {p.name} {!p.active && <Badge tone="neutral">Inactive</Badge>} {!p.is_public && <Badge tone="info">Hidden</Badge>}
            </p>
            <p className="text-xs text-muted">{p.description}</p>
            <p className="text-[11px] text-subtle">key: {p.key}</p>
          </Td>
          <Td>{p.price_label || <span className="text-subtle">Not set</span>}</Td>
          <Td className="text-xs">
            ${Number(p.monthly_limit_usd)}/month
            <br />
            {p.daily_limit_usd ? `$${Number(p.daily_limit_usd)}/day` : "no daily limit"}
            <br />${Number(p.task_cap_usd)} per task
          </Td>
          <Td className="text-xs">
            {n(p.max_workflows)} workflows
            <br />
            {n(p.max_integrations)} connections
            <br />
            {n(p.max_previews)} previews
          </Td>
          <Td className="text-xs">{p.allowed_agents?.join(", ") ?? "All"}</Td>
          <Td>
            <PlanEditor
              label="Edit"
              plan={{ ...p, monthly_limit_usd: Number(p.monthly_limit_usd), daily_limit_usd: p.daily_limit_usd === null ? null : Number(p.daily_limit_usd), task_cap_usd: Number(p.task_cap_usd) } as PlanRow}
            />
          </Td>
        </tr>
      ))}
    </AdminTable>
  );
}

export default function PlansPage() {
  return (
    <AdminPage
      title="Plans"
      description="Plan definitions and prices are configured here, never in code. Limits apply to workspaces on the plan. Online payment (Stripe) isn't connected yet."
      actions={<PlanEditor label="New plan" />}
    >
      <Content />
    </AdminPage>
  );
}
