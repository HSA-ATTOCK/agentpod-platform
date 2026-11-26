import assert from "node:assert/strict";
import { test } from "node:test";
import { dayRange, localNow, safeTimeZone } from "../../src/lib/briefing/time";
import { startersFor } from "../../src/components/ask/starters";

test("briefing: local date and hour follow the time zone", () => {
  const at = new Date("2026-11-26T22:30:00Z");
  assert.deepEqual(localNow("UTC", at), { date: "2026-11-26", hour: 22 });
  assert.deepEqual(localNow("Asia/Karachi", at), { date: "2026-11-27", hour: 3 });
  assert.deepEqual(localNow("America/New_York", at), { date: "2026-11-26", hour: 17 });
});

test("briefing: a local day starts at local midnight", () => {
  const karachi = dayRange("Asia/Karachi", "2026-11-27");
  assert.equal(new Date(karachi.start).toISOString(), "2026-11-26T19:00:00.000Z");
  assert.equal(karachi.end - karachi.start, 86_400_000);
  // The day the clocks go back in New York is 25 hours long
  const ny = dayRange("America/New_York", "2026-11-01");
  assert.equal(new Date(ny.start).toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(ny.end - ny.start, 25 * 3_600_000);
});

test("briefing: unknown time zones fall back to UTC", () => {
  assert.equal(safeTimeZone("Not/AZone"), "UTC");
  assert.equal(safeTimeZone(null), "UTC");
  assert.equal(safeTimeZone("Europe/London"), "Europe/London");
});

test("starters: connected tools come first, six at most", () => {
  const none = startersFor([], false);
  assert.equal(none.length, 5);
  assert.equal(none[0].title, "Build a website");
  const some = startersFor(["google", "shopify"], true);
  assert.equal(some.length, 6);
  assert.deepEqual(some.slice(0, 4).map((s) => s.title), ["Catch up on email", "Plan my day", "How's the shop doing?", "Ask my documents"]);
});
