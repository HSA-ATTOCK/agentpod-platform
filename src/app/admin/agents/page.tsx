import type { Metadata } from "next";
import { AgentModelPicker, AgentToggle, SyncRosterButton } from "@/components/admin/admin-controls";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { listAgents } from "@/lib/platform/admin-data";

export const metadata: Metadata = { title: "Agents" };

async function Content() {
  const ctx = await requirePlatformAdmin();
  const agents = await listAgents(ctx);
  if (agents.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border p-6 text-sm text-muted">
        No agents registered yet. Run <code className="text-foreground">npm run baba:setup</code> on the server: it creates the agents on Claude and
        registers them here.
      </p>
    );
  }
  return (
    <AdminTable head={["Agent", "Role", "Model", "Claude version", "Updated", "On"]}>
      {agents.map((a) => (
        <tr key={a.key}>
          <Td>
            <p className="font-medium">{a.name}</p>
            <p className="max-w-lg text-xs text-muted">{a.description}</p>
          </Td>
          <Td>{a.category === "orchestrator" ? <Badge tone="accent">Orchestrator</Badge> : <Badge>Specialist</Badge>}</Td>
          <Td>
            <AgentModelPicker agentKey={a.key} name={a.name} model={a.model} effort={a.effort} />
          </Td>
          <Td className="text-xs">{a.claude_agent_version ? `v${a.claude_agent_version}` : "—"}</Td>
          <Td className="text-xs">
            <LocalTime iso={a.updated_at} />
          </Td>
          <Td>
            <AgentToggle agentKey={a.key} name={a.name} enabled={a.enabled} locked={a.category === "orchestrator"} />
          </Td>
        </tr>
      ))}
    </AdminTable>
  );
}

export default function AgentsAdminPage() {
  return (
    <AdminPage
      title="Agents"
      description="Turning a specialist off removes it from Baba's team on Claude, so new conversations can't use it. Instructions, models and tools live in baba/team.mjs (versioned in git; npm run baba:setup publishes a new version)."
      actions={<SyncRosterButton />}
    >
      <Content />
    </AdminPage>
  );
}
