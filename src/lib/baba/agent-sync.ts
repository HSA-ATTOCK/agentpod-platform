import "server-only";
import type { BetaManagedAgentsSessionAgentUpdate } from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import { babaConfig, getClaude } from "./server";

/**
 * Conversations keep the version of Baba they started with. When Baba gets new tools
 * (after `npm run baba:setup`), older conversations would otherwise never see them.
 * Before each message we give the conversation Baba's current tool list.
 */

type Agent = Awaited<ReturnType<ReturnType<typeof getClaude>["beta"]["agents"]["retrieve"]>>;

const cache = globalThis as unknown as { __babaAgent?: { at: number; agent: Agent } };
const CACHE_MS = 60_000;

async function currentAgent() {
  const { agentId } = babaConfig();
  if (!agentId) return null;
  if (cache.__babaAgent && Date.now() - cache.__babaAgent.at < CACHE_MS) return cache.__babaAgent.agent;
  const agent = await getClaude().beta.agents.retrieve(agentId);
  cache.__babaAgent = { at: Date.now(), agent };
  return agent;
}

const toolKey = (t: { type: string; name?: string }) => `${t.type}:${t.name ?? ""}`;

/** Brings an existing conversation's tools up to date. Never throws (a failure just keeps the old tools). */
export async function syncSessionTools(sessionId: string) {
  try {
    const [session, agent] = await Promise.all([getClaude().beta.sessions.retrieve(sessionId), currentAgent()]);
    if (!agent || session.status === "running" || session.status === "terminated") return;
    const have = new Set(session.agent.tools.map((t) => toolKey(t as { type: string; name?: string })));
    const want = agent.tools.map((t) => toolKey(t as { type: string; name?: string }));
    if (want.length === have.size && want.every((k) => have.has(k))) return;
    await getClaude().beta.sessions.update(sessionId, {
      agent: { tools: agent.tools as unknown as BetaManagedAgentsSessionAgentUpdate["tools"] },
    });
    console.log(`[baba] Updated an older conversation to Baba's current tools (${want.length}).`);
  } catch (error) {
    console.error("[baba] Couldn't update the conversation's tools:", error instanceof Error ? error.message : error);
  }
}
