import { NextResponse } from "next/server";
import type { AgentOutput, BrandGuidelines } from "../../../schemas/agent";
import {
  buildNicheFallbackOutput,
  FALLBACK_SOFT_FAIL_HE,
  FALLBACK_SOFT_READY_HE,
  type FallbackBizContext,
} from "./fallback-content";

/**
 * Soft success envelope for AI failures — never leak provider/HTTP details.
 */
export function softAiFallbackJson(opts: {
  ctx?: FallbackBizContext;
  brand?: BrandGuidelines | null;
  conversationId?: string;
  extra?: Record<string, unknown>;
}) {
  const output = buildNicheFallbackOutput(opts.ctx, opts.brand);
  const assistantMsg = {
    id: `soft-${Date.now()}`,
    content: output.chat_reply,
    social_post: output.social_post,
    image_url: null,
    image_seed: null,
    image_prompt: null,
    intent: output.intent,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({
    ok: true,
    fallback: true,
    soft_message: FALLBACK_SOFT_FAIL_HE,
    conversationId: opts.conversationId ?? `guest-${Date.now()}`,
    message: assistantMsg,
    output,
    image: null,
    imagePending: false,
    providerUsed: "fallback:golden-template",
    status: "replied",
    ...opts.extra,
  });
}

export function softAiSuccessShape(output: AgentOutput, fallback: boolean) {
  return {
    ok: true as const,
    fallback,
    soft_message: fallback ? FALLBACK_SOFT_READY_HE : undefined,
    output,
    providerUsed: fallback ? "fallback:golden-template" : undefined,
  };
}
