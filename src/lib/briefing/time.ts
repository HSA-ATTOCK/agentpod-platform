/** Time-zone helpers for the daily briefing (no external libraries). */

export function safeTimeZone(tz: string | null | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    }
  } catch {
    // fall through
  }
  return "UTC";
}

/** The local date (YYYY-MM-DD) and hour (0–23) in a time zone. */
export function localNow(tz: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** How far the time zone is ahead of UTC at a moment, in milliseconds. */
function offsetMs(tz: string, at: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** Start and end (UTC milliseconds) of a local calendar day. */
export function dayRange(tz: string, date: string) {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  const start = midnightUtc - offsetMs(tz, midnightUtc);
  const nextUtc = midnightUtc + 86_400_000;
  return { start, end: nextUtc - offsetMs(tz, nextUtc) };
}

export function formatTime(tz: string, at: number | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

export function formatDay(tz: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(at);
}
