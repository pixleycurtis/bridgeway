import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, type ModelMessage } from "ai";

const MODEL = "openai/gpt-6-astra";
const CLAUDE_MODEL = "anthropic/claude-sonnet-5";
const BASE = "https://ai.gateway.lovable.dev/v1";

function gatewayFetch(apiKey: string) {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("Lovable-API-Key", apiKey);
    headers.set("X-Lovable-AIG-SDK", "vercel-ai-sdk");
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
    if (!res.ok) {
      const body = await res.clone().text();
      if (res.status === 402) throw new Error("Your workspace is out of AI credits. Add credits in Settings → Plans & credits.");
      if (res.status === 429) throw new Error("AI is busy right now — try again in a minute.");
      throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
    }
    return res;
  };
}

/** Claude call through Lovable AI Gateway (native /v1/messages, streamed, consumed server-side). */
export async function runClaude(messages: ModelMessage[], system?: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  const provider = createAnthropic({ baseURL: BASE, apiKey, fetch: gatewayFetch(apiKey) });
  let failure: unknown;
  const result = streamText({
    model: provider(CLAUDE_MODEL),
    ...(system ? { system } : {}),
    messages,
    onError: ({ error }) => { failure = error; },
  });
  const text = await result.text;
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
  return text;
}

/** One-shot AI call through Lovable AI Gateway (streamed, consumed server-side). */
export async function runAI(messages: ModelMessage[], system?: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: BASE,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const body = await res.clone().text();
        if (res.status === 402) throw new Error("Your workspace is out of AI credits. Add credits in Settings → Plans & credits.");
        if (res.status === 429) throw new Error("AI is busy right now — try again in a minute.");
        throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
      }
      return res;
    },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    ...(system ? { system } : {}),
    messages,
    onError: ({ error }) => { failure = error; },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
  return text;
}

export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI returned no data");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
