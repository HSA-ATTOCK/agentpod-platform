import "server-only";

/**
 * A simple sliding-window rate limit kept in this server's memory (per instance).
 * Enough to stop runaway loops and abuse on one server; use a shared store (e.g. Redis)
 * when running several instances.
 */
const store = globalThis as unknown as { __babaRateLimits?: Map<string, number[]> };
const hits = (store.__babaRateLimits ??= new Map());

/** Returns the seconds to wait if `key` made more than `max` calls in `windowMs`, otherwise null (and counts the call). */
export function rateLimited(key: string, max: number, windowMs: number): number | null {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (recent.length >= max) return Math.ceil((recent[0] + windowMs - now) / 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t: number) => now - t < windowMs)) hits.delete(k);
  return null;
}

export function tooManyRequests(waitSeconds: number) {
  return Response.json(
    { error: `You're sending requests too quickly. Please wait ${waitSeconds} seconds.` },
    { status: 429, headers: { "Retry-After": String(waitSeconds) } },
  );
}
