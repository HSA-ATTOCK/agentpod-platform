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

/**
 * The client's IP as seen by OUR proxy: the last X-Forwarded-For entry (the one the load balancer
 * appended), not the first, which the client can set to anything. Prefer x-real-ip when the host sets it.
 */
export function clientIp(request: Request) {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
}

/** Rejects bodies over `max` bytes before reading them (when the client says how big they are). */
export function bodyTooLarge(request: Request, max: number) {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > max;
}
