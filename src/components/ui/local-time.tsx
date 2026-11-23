"use client";

type Format = "datetime" | "date" | "time" | "relative";

const DAY = 86_400_000;

function format(iso: string, kind: Format) {
  const date = new Date(iso);
  const now = new Date();
  if (kind === "relative") {
    const diff = now.getTime() - date.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < DAY) {
      const h = Math.floor(diff / 3_600_000);
      return `${h} ${h === 1 ? "hour" : "hours"} ago`;
    }
    const d = Math.floor(diff / DAY);
    return d === 1 ? "yesterday" : `${d} days ago`;
  }
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (kind === "time") return time;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const day = sameDay(date, now)
    ? "Today"
    : sameDay(date, new Date(now.getTime() - DAY))
      ? "Yesterday"
      : date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
        });
  return kind === "date" ? day : `${day}, ${time}`;
}

/**
 * A date shown in the viewer's own timezone and language.
 * (The server can't know the timezone, so the browser's text replaces the server's.)
 */
export function LocalTime({
  iso,
  format: kind = "datetime",
  className,
}: {
  iso: string;
  format?: Format;
  className?: string;
}) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {format(iso, kind)}
    </time>
  );
}
