/**
 * Runs once when the server starts. Starts the workflow scheduler, which checks every
 * minute for workflows that are due (see src/lib/workflows/runner.ts).
 * Turn it off with BABA_SCHEDULER=off (e.g. when an external cron calls /api/cron/workflows).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.BABA_SCHEDULER === "off") return;
  // Don't run during `next build`
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startScheduler } = await import("./lib/workflows/scheduler");
  startScheduler();
}

/**
 * Server errors: one structured log line each (picked up by CloudWatch or any log service),
 * and, if ALERT_WEBHOOK_URL is set (e.g. a Slack or Teams incoming webhook), a short alert.
 * No user data or secrets are sent: only the route, the error message and its digest.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  console.error(
    JSON.stringify({ level: "error", at: new Date().toISOString(), route: context.routePath, type: context.routeType, method: request.method, message: message.slice(0, 500), digest }),
  );
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Baba server error on ${request.method} ${context.routePath}: ${message.slice(0, 300)}${digest ? ` (digest ${digest})` : ""}` }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Alerting must never break a request
  }
}
