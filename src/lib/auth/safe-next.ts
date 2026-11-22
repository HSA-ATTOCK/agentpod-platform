import { routes } from "@/config/routes";

/** Only allow redirects to our own pages (blocks "?next=https://evil.example"). */
export function safeNext(next: string | null | undefined, fallback: string = routes.ask) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
