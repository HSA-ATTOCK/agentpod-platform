import assert from "node:assert/strict";
import { test } from "node:test";
import { chat, costCents, parseExternalModels, type ExternalModel } from "../../src/lib/ai/gateway";

const gpt: ExternalModel = { id: "gpt", provider: "openai", model: "gpt-test", label: "GPT", inputPerMTok: 2, outputPerMTok: 8 };
const gem: ExternalModel = { id: "gem", provider: "google", model: "gemini-test", label: "Gemini", inputPerMTok: 1, outputPerMTok: 4 };
const tool = { name: "knowledge_search", description: "Search", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } };

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return calls;
}

test("gateway: cost from token usage at the admin's prices", () => {
  assert.equal(costCents(gpt, 1_000_000, 100_000), 280); // $2 + $0.80
});

test("gateway: only complete, priced models are accepted", () => {
  const models = parseExternalModels([gpt, { ...gpt, id: "Bad ID" }, { ...gpt, id: "free", inputPerMTok: 0 }, { ...gpt, id: "x", provider: "other" }]);
  assert.deepEqual(models.map((m) => m.id), ["gpt"]);
});

test("gateway: OpenAI tool calls and results round-trip", async () => {
  process.env.OPENAI_API_KEY = "test";
  const calls = fakeFetch([
    { status: 200, body: { choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "knowledge_search", arguments: '{"query":"refunds"}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } } },
  ]);
  const out = await chat(gpt, "sys", [{ role: "user", text: "hi" }, { role: "assistant", text: "", toolCalls: [{ id: "c0", name: "knowledge_search", input: { query: "x" } }] }, { role: "tool", results: [{ id: "c0", name: "knowledge_search", text: "result", isError: false }] }], [tool]);
  assert.deepEqual(out.toolCalls, [{ id: "c1", name: "knowledge_search", input: { query: "refunds" } }]);
  assert.equal(out.inputTokens, 10);
  const msgs = calls[0].body.messages as { role: string; tool_call_id?: string }[];
  assert.deepEqual(msgs.map((m) => m.role), ["system", "user", "assistant", "tool"]);
  assert.equal(msgs[3].tool_call_id, "c0");
});

test("gateway: Gemini replies, schema clean-up and retry after a rate limit", async () => {
  process.env.GEMINI_API_KEY = "test";
  const calls = fakeFetch([
    { status: 429, body: { error: { message: "slow down" } } },
    { status: 200, body: { candidates: [{ content: { parts: [{ text: "Done" }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } } },
  ]);
  const out = await chat(gem, "sys", [{ role: "user", text: "hi" }], [tool]);
  assert.equal(out.text, "Done");
  assert.equal(calls.length, 2, "retried once after 429");
  const decl = (calls[1].body.tools as { functionDeclarations: { parameters: Record<string, unknown> }[] }[])[0].functionDeclarations[0];
  assert.equal("additionalProperties" in decl.parameters, false, "unsupported schema keys removed");
});
