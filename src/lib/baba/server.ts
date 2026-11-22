import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only helpers for talking to Claude. The API key is read from the
 * environment here and never sent to the browser.
 */

let client: Anthropic | null = null;

export function getClaude() {
  client ??= new Anthropic();
  return client;
}

/** Spending cap per conversation, in US dollars. Change BABA_SESSION_BUDGET_USD to adjust. */
export function sessionBudgetCents() {
  const dollars = Number(process.env.BABA_SESSION_BUDGET_USD ?? "1");
  const safeDollars = Number.isFinite(dollars) && dollars > 0 ? dollars : 1;
  return String(Math.round(safeDollars * 100));
}

export function babaConfig() {
  return {
    agentId: process.env.BABA_AGENT_ID,
    environmentId: process.env.BABA_ENVIRONMENT_ID,
  };
}

/**
 * Returns an error Response if Baba can't be used right now, otherwise null.
 * There is no login yet, so in production these routes stay OFF unless
 * BABA_ALLOW_PUBLIC=true — otherwise anyone could spend your API credit.
 */
export function babaUnavailable(): Response | null {
  if (process.env.NODE_ENV === "production" && process.env.BABA_ALLOW_PUBLIC !== "true") {
    return Response.json(
      { error: "Baba is disabled on this deployment until login is added." },
      { status: 403 },
    );
  }
  const { agentId, environmentId } = babaConfig();
  if (!process.env.ANTHROPIC_API_KEY || !agentId || !environmentId) {
    return Response.json(
      { error: "Baba isn't set up yet. Add ANTHROPIC_API_KEY to .env.local and run `npm run baba:setup`." },
      { status: 503 },
    );
  }
  return null;
}

/** Turns any thrown error into a short message that's safe to show users. */
export function errorMessage(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "The Anthropic API key is invalid.";
  if (error instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use Managed Agents.";
  if (error instanceof Anthropic.RateLimitError) return "Claude is busy right now (rate limit). Please try again shortly.";
  if (error instanceof Anthropic.NotFoundError) return "Baba's agent or session wasn't found. Try `npm run baba:setup` or start a new chat.";
  if (error instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Claude API error (${error.status ?? "unknown"}).`;
  return "Something went wrong talking to Claude.";
}
