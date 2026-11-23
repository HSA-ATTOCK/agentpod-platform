/**
 * Workflow schedule maths, in the workspace's timezone (works on server and browser).
 * A schedule is "daily | weekly | monthly at HH:MM", with a weekday (0 = Sunday) for weekly
 * and the 1st of the month for monthly. Daylight-saving changes are handled by Intl.
 */

export type Schedule = {
  frequency: "manual" | "daily" | "weekly" | "monthly";
  dayOfWeek: number | null;
  /** "HH:MM" or "HH:MM:SS" */
  timeOfDay: string | null;
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The wall-clock date and time at `utcMs` in `timeZone`. */
function localParts(utcMs: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")],
  };
}

/** UTC time of a wall-clock moment in `timeZone` (e.g. 13:27 in Asia/Karachi → 08:27Z). */
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = asIfUtc;
  // Two passes settle the offset, including around daylight-saving changes
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess, timeZone);
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += asIfUtc - shownAsUtc;
  }
  return guess;
}

function parseTime(timeOfDay: string | null) {
  const [h, m] = (timeOfDay ?? "09:00").split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
}

/** Calendar date `days` after the given one (pure date maths, no timezone). */
function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/**
 * The most recent scheduled time at or before `nowMs` (UTC ms), or null for manual workflows.
 */
export function lastSlot(schedule: Schedule, timeZone: string, nowMs: number): number | null {
  if (schedule.frequency === "manual") return null;
  const { hour, minute } = parseTime(schedule.timeOfDay);
  const today = localParts(nowMs, timeZone);

  // Walk back day by day (at most ~31 days) to the latest matching date whose time has passed
  for (let back = 0; back <= 31; back++) {
    const d = addDays(today.year, today.month, today.day, -back);
    const matches =
      schedule.frequency === "daily" ||
      (schedule.frequency === "weekly" && d.weekday === (schedule.dayOfWeek ?? 1)) ||
      (schedule.frequency === "monthly" && d.day === 1);
    if (!matches) continue;
    const at = zonedToUtc(d.year, d.month, d.day, hour, minute, timeZone);
    if (at <= nowMs) return at;
  }
  return null;
}

/** The next scheduled time after `nowMs` (UTC ms), or null for manual workflows. */
export function nextSlot(schedule: Schedule, timeZone: string, nowMs: number): number | null {
  if (schedule.frequency === "manual") return null;
  const { hour, minute } = parseTime(schedule.timeOfDay);
  const today = localParts(nowMs, timeZone);
  for (let ahead = 0; ahead <= 62; ahead++) {
    const d = addDays(today.year, today.month, today.day, ahead);
    const matches =
      schedule.frequency === "daily" ||
      (schedule.frequency === "weekly" && d.weekday === (schedule.dayOfWeek ?? 1)) ||
      (schedule.frequency === "monthly" && d.day === 1);
    if (!matches) continue;
    const at = zonedToUtc(d.year, d.month, d.day, hour, minute, timeZone);
    if (at > nowMs) return at;
  }
  return null;
}

/** "Asia/Karachi" → "Karachi" for short labels. */
export function shortZone(timeZone: string) {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}
