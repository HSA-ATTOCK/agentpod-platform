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
