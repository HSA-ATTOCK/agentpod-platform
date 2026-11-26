import "server-only";
import { getClaude } from "@/lib/baba/server";

/**
 * Provider-independent model gateway (PRD §19.3) for agents that run outside Claude Managed Agents
 * (custom agents on other providers). One call shape for Anthropic, OpenAI and Google Gemini:
 * messages + tool definitions in, text or tool calls + token usage out.
 * Retries with backoff on rate limits and outages; the caller decides on fallbacks.
 * Prices are configured by the platform admin (platform_settings.external_models), never in code.
 */

export type Provider = "anthropic" | "openai" | "google";

export type ExternalModel = {
  id: string;
  provider: Provider;
  model: string;
  label: string;
  /** USD per million tokens, set by the admin */
  inputPerMTok: number;
  outputPerMTok: number;
  /** Another entry's id to use when this provider is down */
  fallback?: string;
};

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolCall = { id: string; name: string; input: Record<string, unknown> };
export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; results: { id: string; name: string; text: string; isError: boolean }[] };

export type ChatResult = { text: string; toolCalls: ToolCall[]; inputTokens: number; outputTokens: number };

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export function providerConfigured(provider: Provider) {
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

export const costCents = (m: ExternalModel, input: number, output: number) => ((input * m.inputPerMTok + output * m.outputPerMTok) / 1_000_000) * 100;

// ---------------------------------------------------------------------------

async function anthropic(model: string, system: string, turns: Turn[], tools: ToolSpec[], maxTokens: number): Promise<ChatResult> {
  type Block = { type: string; [k: string]: unknown };
  const messages: { role: "user" | "assistant"; content: Block[] }[] = [];
  for (const t of turns) {
    if (t.role === "user") messages.push({ role: "user", content: [{ type: "text", text: t.text }] });
    else if (t.role === "assistant")
      messages.push({
        role: "assistant",
        content: [...(t.text ? [{ type: "text", text: t.text }] : []), ...t.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.input }))],
      });
    else messages.push({ role: "user", content: t.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.text, is_error: r.isError })) });
  }
  try {
    const res = await getClaude().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages as never,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })) as never,
    });
    return {
      text: res.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
      toolCalls: res.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }] : [])),
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  } catch (error) {
    const status = (error as { status?: number }).status ?? 0;
    throw new ProviderError(error instanceof Error ? error.message : "Anthropic error", status === 429 || status >= 500);
  }
}

async function openai(model: string, system: string, turns: Turn[], tools: ToolSpec[], maxTokens: number): Promise<ChatResult> {
  const messages: Record<string, unknown>[] = [{ role: "system", content: system }];
  for (const t of turns) {
    if (t.role === "user") messages.push({ role: "user", content: t.text });
    else if (t.role === "assistant")
      messages.push({
        role: "assistant",
        content: t.text || null,
        ...(t.toolCalls.length ? { tool_calls: t.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } })) } : {}),
      });
    else for (const r of t.results) messages.push({ role: "tool", tool_call_id: r.id, content: r.text });
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens,
      ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
    error?: { message: string };
  };
  if (!res.ok || !data.choices?.[0]) throw new ProviderError(data.error?.message ?? `OpenAI error ${res.status}`, res.status === 429 || res.status >= 500);
  const msg = data.choices[0].message;
  return {
    text: msg.content ?? "",
    toolCalls: (msg.tool_calls ?? []).map((c) => {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(c.function.arguments) as Record<string, unknown>;
      } catch {
        input = {};
      }
      return { id: c.id, name: c.function.name, input };
    }),
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Gemini accepts a subset of JSON Schema: drop keys it rejects. */
function geminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (["additionalProperties", "$schema", "minimum", "maximum", "maxItems", "minItems"].includes(k)) continue;
    out[k] = geminiSchema(v);
  }
  return out;
}

async function google(model: string, system: string, turns: Turn[], tools: ToolSpec[], maxTokens: number): Promise<ChatResult> {
  const contents: Record<string, unknown>[] = [];
  for (const t of turns) {
    if (t.role === "user") contents.push({ role: "user", parts: [{ text: t.text }] });
    else if (t.role === "assistant")
      contents.push({ role: "model", parts: [...(t.text ? [{ text: t.text }] : []), ...t.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.input } }))] });
    else contents.push({ role: "user", parts: t.results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.text, error: r.isError } } })) });
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
      ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.input_schema) })) }] } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    error?: { message: string };
  };
  if (!res.ok) throw new ProviderError(data.error?.message ?? `Gemini error ${res.status}`, res.status === 429 || res.status >= 500);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return {
    text: parts.map((p) => p.text ?? "").join(""),
    toolCalls: parts.flatMap((p, i) => (p.functionCall ? [{ id: `call_${i}_${p.functionCall.name}`, name: p.functionCall.name, input: p.functionCall.args ?? {} }] : [])),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

const CALLERS = { anthropic, openai, google } as const;

/** One model call, retried up to 3 times with exponential backoff on rate limits and outages. */
export async function chat(m: ExternalModel, system: string, turns: Turn[], tools: ToolSpec[], maxTokens = 4096): Promise<ChatResult> {
  if (!providerConfigured(m.provider)) throw new ProviderError(`${m.provider} isn't configured on this server (missing API key).`, false);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await CALLERS[m.provider](m.model, system, turns, tools, maxTokens);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ProviderError) || !error.retryable) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

/** Reads the admin's list of allowed outside models (validated). */
export function parseExternalModels(value: unknown): ExternalModel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m): m is ExternalModel => Boolean(m) && typeof m === "object")
    .filter(
      (m) =>
        typeof m.id === "string" &&
        /^[a-z0-9-]{2,40}$/.test(m.id) &&
        ["anthropic", "openai", "google"].includes(m.provider) &&
        typeof m.model === "string" &&
        /^[A-Za-z0-9._:/-]{2,80}$/.test(m.model) &&
        typeof m.label === "string" &&
        Number(m.inputPerMTok) > 0 &&
        Number(m.outputPerMTok) > 0,
    )
    .map((m) => ({ ...m, inputPerMTok: Number(m.inputPerMTok), outputPerMTok: Number(m.outputPerMTok), label: m.label.slice(0, 60) }));
}
