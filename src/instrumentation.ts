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
