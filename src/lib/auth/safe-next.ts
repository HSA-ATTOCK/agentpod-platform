import { routes } from "@/config/routes";

/**
 * Only allow redirects to our own pages. Parses the value the way browsers do, so tricks like
 * "//evil.example", "/\\evil.example" or "/<tab>/evil.example" (whitespace is stripped) are refused.
 */
export function safeNext(next: string | null | undefined, fallback: string = routes.ask) {
  if (!next || !next.startsWith("/") || /[\s\\]/.test(next) || next.startsWith("//")) return fallback;
  try {
    const url = new URL(next, "http://baba.local");
    if (url.origin !== "http://baba.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
