/**
 * Text / structured JSON service — OpenRouter-first hybrid fallback
 * wrapped with Production Guardrails:
 *   AI (≤4s) → validateAndSanitizePost → golden template if invalid/timeout/fail
 *
 * User-facing output is ALWAYS clean & validated (soft success).
 * Technical failures stay in server console.error only.
 */
import { runStructuredAgent } from "./router";
import { buildGoldenAgentOutput } from "./golden-templates";
import {
  gateAgentOutputWithGolden,
  type PostInputContext,
} from "./pipeline-validator";
import {
  OPENROUTER_MODELS,
  generateWithOpenRouter,
} from "./providers/openrouter";
import { withTimeout } from "./with-timeout";
import type { ChatTurn } from "./types";
import type { AgentOutput } from "../../../schemas/agent";

export { OPENROUTER_MODELS };

/** Default hard cap for chat/structured — callers may pass a longer budget. */
export const TEXT_PIPELINE_TIMEOUT_MS = 4_000;
/** Onboarding / generate-post needs enough time for OpenRouter Haiku. */
export const GENERATE_POST_TIMEOUT_MS = 28_000;

export type TextServiceResult = {
  output: AgentOutput;
  providerUsed: string;
  fallback?: boolean;
  validationReasons?: string[];
};

function lastUserContent(messages: ChatTurn[]): string {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

function contextFromMessages(
  messages: ChatTurn[],
  extra?: Partial<PostInputContext>
): PostInputContext {
  return {
    rawPrompt: extra?.rawPrompt ?? lastUserContent(messages),
    businessName: extra?.businessName,
    phone: extra?.phone,
    whatsapp: extra?.whatsapp,
    niche: extra?.niche,
    city: extra?.city,
  };
}

function goldenResult(
  ctx: PostInputContext,
  reason: string
): TextServiceResult {
  console.error("[text-service] golden template", { reason });
  return {
    output: buildGoldenAgentOutput(ctx),
    providerUsed: "fallback:golden-template",
    fallback: true,
    validationReasons: [reason],
  };
}

/** Apply pipeline validator; on failure swap to golden template. */
export function enforcePostPipeline(
  output: AgentOutput,
  ctx: PostInputContext
): { output: AgentOutput; fallback: boolean; reasons: string[] } {
  return gateAgentOutputWithGolden(output, ctx, buildGoldenAgentOutput);
}

/**
 * Full chain via router (OpenRouter hybrid → Grok? → Groq → Gemini),
 * with 4s timeout + validateAndSanitizePost + golden fallback.
 * Never throws for provider failure — returns golden template instead.
 */
export async function generateStructuredText(
  system: string,
  messages: ChatTurn[],
  inputContext?: Partial<PostInputContext> & { timeoutMs?: number }
): Promise<TextServiceResult> {
  const started = Date.now();
  const timeoutMs = inputContext?.timeoutMs ?? TEXT_PIPELINE_TIMEOUT_MS;
  const ctx = contextFromMessages(messages, inputContext);
  console.log("[text-service] structured request", {
    openRouterModels: OPENROUTER_MODELS,
    timeoutMs,
  });

  try {
    const result = await withTimeout(
      runStructuredAgent(system, messages),
      timeoutMs,
      "text-pipeline"
    );

    const gated = enforcePostPipeline(result.output, ctx);
    const fallback =
      gated.fallback || result.providerUsed.startsWith("fallback:");

    console.log("[text-service] content from", {
      providerUsed: fallback
        ? "fallback:golden-template"
        : result.providerUsed,
      fallback,
      latencyMs: Date.now() - started,
      validationReasons: gated.reasons,
    });

    return {
      output: gated.output,
      providerUsed: fallback
        ? gated.fallback
          ? "fallback:golden-template"
          : result.providerUsed
        : result.providerUsed,
      fallback,
      validationReasons: gated.reasons,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = /timed out|ETIMEDOUT/i.test(msg);
    console.error("[text-service] FAILED — golden template", {
      latencyMs: Date.now() - started,
      timedOut,
      error: msg,
    });
    return goldenResult(
      ctx,
      timedOut ? `timeout_${timeoutMs}ms` : `provider_error:${msg.slice(0, 120)}`
    );
  }
}

/**
 * OpenRouter-only hybrid (models[] + sequential). Throws if OpenRouter fails
 * entirely — use generateStructuredText for external backups.
 * Still runs post pipeline when successful.
 */
export async function generateWithOpenRouterHybrid(
  system: string,
  messages: ChatTurn[],
  inputContext?: Partial<PostInputContext>
): Promise<TextServiceResult> {
  const ctx = contextFromMessages(messages, inputContext);
  const { output, model } = await generateWithOpenRouter(system, messages);
  const gated = enforcePostPipeline(output, ctx);
  return {
    output: gated.output,
    providerUsed: gated.fallback
      ? "fallback:golden-template"
      : `openrouter:${model}`,
    fallback: gated.fallback,
    validationReasons: gated.reasons,
  };
}

/**
 * Free-form chat-style completion via the same provider chain + guardrails.
 */
export async function generateChatReply(
  system: string,
  userMessage: string,
  history: ChatTurn[] = [],
  inputContext?: Partial<PostInputContext>
): Promise<{ reply: string; providerUsed: string; output: AgentOutput }> {
  const messages: ChatTurn[] = [
    ...history.slice(-6),
    { role: "user", content: userMessage },
  ];
  const { output, providerUsed } = await generateStructuredText(
    system,
    messages,
    { ...inputContext, rawPrompt: inputContext?.rawPrompt ?? userMessage }
  );
  return {
    reply: output.chat_reply,
    providerUsed,
    output,
  };
}
