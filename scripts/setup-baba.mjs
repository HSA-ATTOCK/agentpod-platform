/**
 * One-time (and re-runnable) setup for Baba's agent team on Claude Managed Agents.
 *
 *   npm run baba:setup
 *
 * - First run: creates the cloud environment and every agent, saves their IDs in
 *   baba.lock.json and adds BABA_AGENT_ID / BABA_ENVIRONMENT_ID to .env.local.
 * - Later runs: UPDATES the existing agents from baba/team.mjs (new versions),
 *   so agents are never duplicated.
 *
 * Needs ANTHROPIC_API_KEY in .env.local. The key is only read here, never printed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { PROFILE, baba, babaMultiagent, environment, specialists } from "../baba/team.mjs";

const LOCK_FILE = "baba.lock.json";
const ENV_FILE = ".env.local";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is missing. Add it to .env.local first.");
  process.exit(1);
}

const client = new Anthropic();

// The agent registry in Supabase (admin page → Agents). Optional: skipped without the secret key.
const db =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
    : null;

/** Models the platform admin chose on the admin page (they win over baba/team.mjs). */
async function modelOverrides() {
  if (!db) return new Map();
  const { data } = await db.from("agent_registry").select("key, model, effort").not("model", "is", null);
  return new Map((data ?? []).map((r) => [r.key, { id: r.model, effort: r.effort ?? "medium" }]));
}

/** Which agents the platform admin switched off (they are left out of Baba's team). */
async function disabledAgentKeys() {
  if (!db) return new Set();
  const { data, error } = await db.from("agent_registry").select("key").eq("enabled", false);
  if (error) {
    console.warn(`  (Couldn't read the agent registry: ${error.message})`);
    return new Set();
  }
  return new Set(data.map((r) => r.key));
}

async function registerAgent(key, config, agent, category, sort) {
  if (!db) return;
  const { error } = await db.from("agent_registry").upsert(
    { key, name: config.name, description: config.description ?? "", category, claude_agent_id: agent.id, claude_agent_version: agent.version, sort },
    { onConflict: "key", ignoreDuplicates: false },
  );
  if (error) console.warn(`  (Couldn't register ${config.name}: ${error.message})`);
}
const lock = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, "utf8")) : { agents: {} };

function saveLock() {
  writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
}

/** Create the agent, or update it if we already have its ID. */
async function syncAgent(key, config) {
  const existingId = lock.agents[key]?.id;
  const agent = existingId
    ? await client.beta.agents.update(existingId, config)
    : await client.beta.agents.create(config);
  lock.agents[key] = { id: agent.id, version: agent.version, name: config.name };
  saveLock();
  console.log(`${existingId ? "Updated" : "Created"} ${config.name}: ${agent.id} (v${agent.version})`);
  return agent;
}

function setEnvVar(name, value) {
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const line = `${name}=${value}`;
  if (new RegExp(`^${name}=`, "m").test(current)) {
    writeFileSync(ENV_FILE, current.replace(new RegExp(`^${name}=.*$`, "m"), line));
  } else {
    appendFileSync(ENV_FILE, `${current.endsWith("\n") || current === "" ? "" : "\n"}${line}\n`);
  }
}

async function main() {
  console.log(
    PROFILE === "test"
      ? "Profile: TEST (cheapest: Claude Haiku 5.5, low effort, small limits)\n"
      : "Profile: normal (Claude Sonnet 5.5)\n",
  );
  // 1. Environment (the cloud sandbox the agents work in)
  if (!lock.environmentId) {
    const env = await client.beta.environments.create(environment);
    lock.environmentId = env.id;
    saveLock();
    console.log(`Created environment: ${env.id}`);
  } else {
    // Keep its settings (e.g. the sandbox's network rules) in line with baba/team.mjs
    await client.beta.environments.update(lock.environmentId, { config: environment.config });
    console.log(`Updated environment: ${lock.environmentId}`);
  }

  // 2. Specialists first (Baba's roster refers to their IDs)
  const disabled = await disabledAgentKeys();
  const models = await modelOverrides();
  const withModel = (key, config) => (models.has(key) ? { ...config, model: models.get(key) } : config);
  const specialistIds = [];
  for (const [index, { key, ...config }] of specialists.entries()) {
    const agent = await syncAgent(key, withModel(key, config));
    await registerAgent(key, config, agent, "specialist", index + 1);
    if (disabled.has(key)) console.log(`  ${config.name} is switched off in the admin page: not added to Baba's team.`);
    else specialistIds.push(agent.id);
  }

  // 3. Baba, the main agent
  const { key, ...babaConfig } = baba;
  const main = await syncAgent(key, withModel(key, { ...babaConfig, multiagent: babaMultiagent(specialistIds) }));
  await registerAgent(key, babaConfig, main, "orchestrator", 0);
  if (!db) console.log("  (Add SUPABASE_SECRET_KEY to .env.local to list the agents on the admin page.)");

  // 4. IDs the Next.js server needs
  setEnvVar("BABA_AGENT_ID", main.id);
  setEnvVar("BABA_ENVIRONMENT_ID", lock.environmentId);

  console.log("\nDone. Saved IDs to baba.lock.json and .env.local.");
  console.log("For Vercel, add these environment variables too:");
  console.log(`  BABA_AGENT_ID=${main.id}`);
  console.log(`  BABA_ENVIRONMENT_ID=${lock.environmentId}`);
}

main().catch((error) => {
  console.error("\nSetup failed:", error?.message ?? error);
  process.exit(1);
});
