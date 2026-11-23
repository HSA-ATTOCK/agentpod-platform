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

export function babaConfig() {
  return {
    agentId: process.env.BABA_AGENT_ID,
    environmentId: process.env.BABA_ENVIRONMENT_ID,
  };
}

/**
 * Returns an error Response if Baba can't be used right now, otherwise null.
 * Every route also requires a signed-in user (see conversations.ts). On a production
 * deployment Baba stays OFF unless BABA_ALLOW_PUBLIC=true, because anyone who signs up
 * would be spending your API credit (there's no billing yet).
 */
export function babaUnavailable(): Response | null {
  if (process.env.NODE_ENV === "production" && process.env.BABA_ALLOW_PUBLIC !== "true") {
    return Response.json(
      { error: "Baba is switched off on this deployment. Set BABA_ALLOW_PUBLIC=true to let signed-in users use it." },
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
