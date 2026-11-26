import "server-only";
import { runDueWorkflows, schedulerReady } from "./runner";

const EVERY_MS = 60_000;

// Survives hot reloads in development, so there's only ever one timer per server
const state = globalThis as unknown as { __babaScheduler?: ReturnType<typeof setInterval> };

/** Checks for due workflows every minute (and daily briefings every 5 minutes) while the server is running. */
export function startScheduler() {
  if (state.__babaScheduler) return;
  if (!schedulerReady()) {
    console.log(
      "[workflows] Scheduled runs are off: add SUPABASE_SECRET_KEY (and the Baba settings) to .env.local to turn them on.",
    );
    return;
  }
  let lastBriefingCheck = 0;
  const tick = () => {
    void runDueWorkflows().catch((error) => console.error("[workflows] check failed:", error));
    // Daily briefings: every 5 minutes is plenty (each goes out once a day)
    if (Date.now() - lastBriefingCheck >= 5 * 60_000) {
      lastBriefingCheck = Date.now();
      void import("@/lib/briefing/briefing")
        .then(({ runDueBriefings }) => runDueBriefings())
        .catch((error) => console.error("[briefing] check failed:", error));
    }
  };
  // First check shortly after start-up (catches runs missed while the app was off)
  setTimeout(tick, 10_000);
  state.__babaScheduler = setInterval(tick, EVERY_MS);
  console.log("[workflows] Scheduler on: checking for due workflows every minute.");
}
