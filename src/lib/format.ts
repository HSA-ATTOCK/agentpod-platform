/**
 * Formatting helpers. All dates are formatted in UTC so the server and the
 * browser always produce the same text (no hydration mismatches).
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "3 min ago", "2 hours ago", "yesterday", "5 days ago" */
export function formatRelativeTime(iso: string, now: string): string {
  const diff = new Date(now).getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** 42000 → "42s", 68000 → "1m 08s", null → "—" */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}m ${seconds}s`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** 5 → "$0.05", 1234 → "$12.34" */
export function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

/** Time between two ISO dates, e.g. "1m 05s"; "—" if not finished. */
export function durationBetween(startIso: string, endIso: string | null): string {
  if (!endIso) return "—";
  return formatDuration(new Date(endIso).getTime() - new Date(startIso).getTime());
}

/** "Today, 14:32", "Yesterday, 18:30" or "Nov 20, 09:15" */
export function formatDateTime(iso: string, now: string): string {
  const date = new Date(iso);
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date(now);
  const yesterday = new Date(today.getTime() - DAY);
  const time = timeFormatter.format(date);

  if (dayKey(date) === dayKey(today)) return `Today, ${time}`;
  if (dayKey(date) === dayKey(yesterday)) return `Yesterday, ${time}`;
  return `${dateFormatter.format(date)}, ${time}`;
}
