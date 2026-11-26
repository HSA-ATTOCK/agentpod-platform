import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkText } from "../../src/lib/knowledge/knowledge";
import { stricter } from "../../src/lib/platform/limits";
import { lastSlot, nextSlot } from "../../src/lib/schedule";

test("knowledge: long text is split into overlapping chunks that cover everything", () => {
  const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}. ` + "Returns are accepted within 30 days. ".repeat(5)).join("\n\n");
  const chunks = chunkText(text);
  assert.ok(chunks.length > 5);
  assert.ok(chunks.every((c) => c.length <= 1500));
  assert.ok(chunks[0].startsWith("Paragraph 0."));
  assert.ok(chunks.at(-1)!.includes("Paragraph 59."));
});

test("limits: the stricter limit wins", () => {
  assert.equal(stricter(50, null), 50);
  assert.equal(stricter(50, 20), 20);
  assert.equal(stricter(10, 20), 10);
});

test("schedule: daily slot in the workspace timezone (Karachi, UTC+5)", () => {
  const schedule = { frequency: "daily" as const, dayOfWeek: null, timeOfDay: "13:27" };
  // 08:30 UTC = 13:30 Karachi: the 13:27 slot (08:27 UTC) has just passed
  const now = Date.parse("2026-11-23T08:30:00Z");
  assert.equal(new Date(lastSlot(schedule, "Asia/Karachi", now)!).toISOString(), "2026-11-23T08:27:00.000Z");
  assert.equal(new Date(nextSlot(schedule, "Asia/Karachi", now)!).toISOString(), "2026-11-24T08:27:00.000Z");
});

import { cleanSteps, workflowPrompt } from "../../src/lib/workflows/steps";

test("workflows: steps are cleaned and turned into numbered instructions", () => {
  const steps = cleanSteps([
    { id: "a", type: "do", text: " Find unpaid invoices " },
    { id: "b", type: "check", text: "at least one was found" },
    { id: "c", type: "approve", text: "show me the emails" },
    { id: "d", type: "bogus", text: "notify" },
    { id: "e", type: "notify", text: "" },
  ]);
  assert.equal(steps.length, 4, "empty steps are dropped");
  assert.equal(steps[3].type, "do", "unknown types become 'do'");
  const prompt = workflowPrompt("Chase late payers.", steps);
  assert.match(prompt, /1\. Find unpaid invoices/);
  assert.match(prompt, /2\. CHECK: only continue if at least one was found/);
  assert.match(prompt, /3\. ASK ME FIRST: .*workflow_checkpoint/);
  assert.equal(workflowPrompt("Just this.", []), "Just this.");
});
