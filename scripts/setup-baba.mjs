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
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { baba, babaMultiagent, environment, specialists } from "../baba/team.mjs";

const LOCK_FILE = "baba.lock.json";
const ENV_FILE = ".env.local";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is missing. Add it to .env.local first.");
  process.exit(1);
}

const client = new Anthropic();
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
  // 1. Environment (the cloud sandbox the agents work in)
  if (!lock.environmentId) {
    const env = await client.beta.environments.create(environment);
    lock.environmentId = env.id;
    saveLock();
    console.log(`Created environment: ${env.id}`);
  } else {
    console.log(`Using environment: ${lock.environmentId}`);
  }

  // 2. Specialists first (Baba's roster refers to their IDs)
  const specialistIds = [];
  for (const { key, ...config } of specialists) {
    const agent = await syncAgent(key, config);
    specialistIds.push(agent.id);
  }

  // 3. Baba, the main agent
  const { key, ...babaConfig } = baba;
  const main = await syncAgent(key, { ...babaConfig, multiagent: babaMultiagent(specialistIds) });

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
