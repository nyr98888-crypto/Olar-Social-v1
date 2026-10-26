import { buildSystemPrompt } from "./system-prompt";
import {
  generateWithOpenRouter,
  streamWithOpenRouter,
} from "./providers/openrouter";
import { analyzeReferenceImages } from "./providers/gemini";
import { generateImage } from "./image-service";
import { buildGoldenAgentOutput } from "./golden-templates";
import { enforcePublicationGrounding } from "./grounding";
import {
  gateAgentOutputWithGolden,
  type PostInputContext,
} from "./pipeline-validator";
import {
  buildVisualGenerationCorrectionMessage,
  userExplicitlyRequestsVisual,
} from "./image-intent";
import { withTimeout } from "./with-timeout";
import {
  takeSlidingWindow,
  type AgentPipelineResult,
  type AgentRequest,
  type ChatTurn,
  type GeneratedImage,
} from "./types";
import type { AgentOutput, BrandDna } from "../../../schemas/agent";
import { AI_CONFIG } from "@/lib/ai-config";

/** Text structured generation hard cap — golden template on exceed (production). */
const STRUCTURED_TEXT_TIMEOUT_MS = AI_CONFIG.STRUCTURED_TEXT_TIMEOUT_MS;

function buildPostInputContext(
  req: Pick<AgentRequest, "userMessage" | "brandGuidelines" | "brandDna">,
  history: ChatTurn[],
  visionNotes: string | null
): PostInputContext {
  return {
    rawPrompt: [
      req.userMessage,
      req.brandGuidelines ? JSON.stringify(req.brandGuidelines) : "",
      visionNotes ?? "",
      ...history.map((t) => t.content),
    ].join("\n"),
    businessName: req.brandGuidelines?.brand_name,
    niche: req.brandDna?.business_type,
  };
}

function applyProductionPostGate(
  output: AgentOutput,
  ctx: PostInputContext,
  providerUsed: string
): { output: AgentOutput; providerUsed: string } {
  const gated = gateAgentOutputWithGolden(
    output,
    ctx,
    buildGoldenAgentOutput
  );
  if (gated.fallback) {
    console.error("[router] post gate → golden", gated.reasons);
    return {
      output: gated.output,
      providerUsed: "fallback:golden-template",
    };
  }
  return { output: gated.output, providerUsed };
}

/** Live SSE / stream pipeline events (Phase A tokens → B output → C image). */
export type AgentStreamEvent =
  | {
      type: "status";
      status: "analyzing" | "thinking" | "streaming" | "generating";
    }
  | { type: "token"; text: string }
  | { type: "output"; output: AgentOutput; providerUsed: string }
  | { type: "image"; image: GeneratedImage }
  | { type: "reply_fix"; text: string };

/**
 * Authoritative provider chain (user override — OpenRouter exclusive text)
 * ────────────────────────────
 * TEXT / structured JSON:
 *   OpenRouter hybrid only (`openai/gpt-4o-mini` → haiku → sonnet → …).
 *   On total OpenRouter failure → golden template (no Groq / Grok / Gemini /
 *   Together for chat or marketing text).
 *
 * VISION (reference uploads only):
 *   Gemini Flash → English visual brief. Soft-skip on failure; text still
 *   runs OpenRouter. Gemini is NEVER used for image generation or chat text.
 *
 * IMAGES:
 *   FAL fal-ai/flux/schnell only, when generate_image === true.
 */
/** Exported for test-engine failover simulation */
export async function runStructuredAgent(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; providerUsed: string }> {
  // Dev/test: force soft niche template without calling providers
  if (process.env.FORCE_AI_FALLBACK === "1") {
    console.warn("[router] FORCE_AI_FALLBACK=1 — golden template");
    const lastUser =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      output: buildGoldenAgentOutput({ rawPrompt: lastUser }),
      providerUsed: "fallback:golden-template",
    };
  }

  // OpenRouter only — no Together / Groq / Gemini text backups
  try {
    const { output, model } = await generateWithOpenRouter(system, messages);
    return { output, providerUsed: `openrouter:${model}` };
  } catch (err) {
    console.error(
      "[router] OpenRouter failed — golden template (no external text backups)",
      (err as { status?: number }).status ??
        (err instanceof Error ? err.message : err)
    );
    const lastUser =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const output = buildGoldenAgentOutput({ rawPrompt: lastUser });
    return { output, providerUsed: "fallback:golden-template" };
  }
}

function skipImageGeneration(
  output: AgentOutput,
  reasonHe: string
): void {
  output.image_task.generate_image = false;
  delete output.image_task.prompt;
  if (!output.chat_reply?.includes("ויז'ואל")) {
    output.chat_reply = `${output.chat_reply?.trim() ?? ""}\n\n${reasonHe}`.trim();
  }
}

/**
 * If the user clearly asked for post+image but the model left generate_image=false
 * (and Niche Lock / missing_info do not block), one hard LLM retry.
 */
async function enforceExplicitVisualRequest(
  output: AgentOutput,
  args: {
    system: string;
    messages: ChatTurn[];
    brandDna: BrandDna | null;
    brandGuidelines: AgentRequest["brandGuidelines"];
    visionNotes: string | null;
    userMessage: string;
    history: ChatTurn[];
  }
): Promise<{ output: AgentOutput; providerUsed?: string }> {
  if (!userExplicitlyRequestsVisual(args.userMessage)) {
    return { output };
  }
  if (output.image_task.generate_image && output.image_task.prompt?.trim()) {
    return { output };
  }
  // Respect ask-first missing_info — do not force image while clarifying
  if (output.intent === "missing_info") {
    console.log("[router] Explicit visual ask — waiting on missing_info");
    return { output };
  }

  console.warn(
    "[router] Explicit visual ask but generate_image was false — retrying LLM"
  );

  const { output: regenerated, providerUsed } = await runStructuredAgent(
    args.system,
    [
      ...args.messages,
      { role: "user", content: buildVisualGenerationCorrectionMessage() },
    ]
  );

  enforcePublicationGrounding(regenerated, {
    userMessage: args.userMessage,
    brand: args.brandGuidelines,
    brandDna: args.brandDna,
    visionNotes: args.visionNotes,
    history: args.history,
  });

  if (
    regenerated.image_task.generate_image &&
    regenerated.image_task.prompt?.trim()
  ) {
    console.log(
      "[router] Visual retry OK — generate_image=true, English prompt ready"
    );
  } else {
    console.warn(
      "[router] Visual retry still missing generate_image/prompt"
    );
  }

  return { output: regenerated, providerUsed };
}

/**
 * Phase 2: Niche Lock / forbidden-word guardrail DISABLED for images.
 * FAL + Together cloud safety checkers are the only content filters.
 */
async function enforcePromptGuardrailBeforeFal(
  output: AgentOutput,
  _args: {
    system: string;
    messages: ChatTurn[];
    brandDna: BrandDna | null;
    brandGuidelines: AgentRequest["brandGuidelines"];
    visionNotes: string | null;
    userMessage: string;
    history: ChatTurn[];
  }
): Promise<{ output: AgentOutput; providerUsed?: string }> {
  return { output };
}

/**
 * Full agent pipeline:
 * 1) Optional vision brief via Gemini (soft-skip on 503/failure)
 * 2) Structured JSON: OpenRouter → Groq → Gemini (Brand DNA injected every call)
 * 3) Prompt Guardrail vs forbidden_elements; LLM retry on hit
 * 4) Optional FAL image with random seed + anti-lock
 */
export async function runAgentPipeline(
  req: AgentRequest
): Promise<AgentPipelineResult> {
  let visionNotes: string | null = null;

  if (req.referenceImages && req.referenceImages.length > 0) {
    try {
      visionNotes = await analyzeReferenceImages(req.referenceImages);
    } catch (err) {
      // Soft-skip: do not crash chat when Gemini vision is overloaded
      console.warn(
        "[router] Vision analysis failed — continuing without notes",
        err instanceof Error ? err.message : err
      );
      visionNotes = null;
    }
  }

  const brandDna = req.brandDna ?? null;

  // Brand DNA injected on EVERY text LLM call via system prompt
  const system = buildSystemPrompt(
    req.brandGuidelines,
    visionNotes,
    req.previousImagePrompt ?? null,
    brandDna,
    req.partnerMemory ?? null,
    req.marketingProfile ?? null,
    req.currentPost ?? null
  );

  // Sliding window = last 6 messages only (no prior image prompts in chat)
  const windowed = takeSlidingWindow(req.history);
  const messages: ChatTurn[] = [
    ...windowed,
    { role: "user", content: req.userMessage },
  ];

  let output: AgentOutput;
  let providerUsed: string;
  const postCtx = buildPostInputContext(req, windowed, visionNotes);

  try {
    const structured = await withTimeout(
      runStructuredAgent(system, messages),
      STRUCTURED_TEXT_TIMEOUT_MS,
      "structured-text"
    );
    output = structured.output;
    providerUsed = structured.providerUsed;
  } catch (err) {
    console.error(
      "[router] structured text timeout/fail → golden",
      err instanceof Error ? err.message : err
    );
    output = buildGoldenAgentOutput(postCtx);
    providerUsed = "fallback:golden-template";
  }

  // Publication guardrails: chit_chat / missing_info + price/phone sanitize
  enforcePublicationGrounding(output, {
    userMessage: req.userMessage,
    brand: req.brandGuidelines,
    brandDna,
    visionNotes,
    history: windowed,
  });

  // Production post gate: validate schema + strip hallucinations → golden if invalid
  {
    const gated = applyProductionPostGate(output, postCtx, providerUsed);
    output = gated.output;
    providerUsed = gated.providerUsed;
  }

  // Explicit "תרימי פוסט+תמונה" — force generate_image + English prompt if LLM missed
  const visualEnforced = await enforceExplicitVisualRequest(output, {
    system,
    messages,
    brandDna,
    brandGuidelines: req.brandGuidelines,
    visionNotes,
    userMessage: req.userMessage,
    history: windowed,
  });
  output = visualEnforced.output;
  if (visualEnforced.providerUsed) {
    providerUsed = `${providerUsed}+visual:${visualEnforced.providerUsed}`;
  }

  // Niche Lock Prompt Guardrail before FAL (may re-call LLM)
  const guarded = await enforcePromptGuardrailBeforeFal(output, {
    system,
    messages,
    brandDna,
    brandGuidelines: req.brandGuidelines,
    visionNotes,
    userMessage: req.userMessage,
    history: windowed,
  });
  output = guarded.output;
  if (guarded.providerUsed) {
    providerUsed = `${providerUsed}+guard:${guarded.providerUsed}`;
  }

  let image: GeneratedImage | null = null;
  if (output.image_task.generate_image && output.image_task.prompt) {
    // Phase 2: no local Niche Lock gate — dual engine (FAL → Together)
    if (req.deferImage) {
      // Chat returns first; client/stream Phase C fetches image separately.
      console.log(
        "[router] deferImage — generate_image=true; client will call image next"
      );
      image = null;
    } else {
      try {
        console.log("[router] Calling dual image-service…");
        image = await generateImage({
          prompt: output.image_task.prompt,
          aspectRatio: output.image_task.aspect_ratio,
          previousPrompt: req.previousImagePrompt,
          userContext: req.userMessage,
          brandDna,
        });
      } catch (err) {
        console.error(
          "[router] Image gen failed",
          err instanceof Error ? err.message : err
        );
        const he =
          err &&
          typeof err === "object" &&
          "userMessageHe" in err &&
          typeof (err as { userMessageHe?: string }).userMessageHe === "string"
            ? (err as { userMessageHe: string }).userMessageHe
            : "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב.";
        skipImageGeneration(output, he);
        image = null;
      }
    }
  }

  return {
    output,
    image,
    providerUsed,
    visionNotes,
  };
}

/**
 * Streaming pipeline (additive — used by /api/chat/stream):
 * Phase A: stream chat_reply tokens from OpenRouter (or one-shot on failover)
 * Phase B: Zod-validated AgentOutput + grounding + Niche Lock guardrail
 * Phase C: FAL image async (emit generating status; does not block chat bubble)
 */
export async function runAgentPipelineStream(
  req: AgentRequest,
  emit: (event: AgentStreamEvent) => void
): Promise<AgentPipelineResult> {
  let visionNotes: string | null = null;

  if (req.referenceImages && req.referenceImages.length > 0) {
    emit({ type: "status", status: "analyzing" });
    try {
      visionNotes = await analyzeReferenceImages(req.referenceImages);
    } catch (err) {
      console.warn(
        "[router] Vision analysis failed — continuing without notes",
        err instanceof Error ? err.message : err
      );
      visionNotes = null;
    }
  }

  const brandDna = req.brandDna ?? null;
  const system = buildSystemPrompt(
    req.brandGuidelines,
    visionNotes,
    req.previousImagePrompt ?? null,
    brandDna,
    req.partnerMemory ?? null,
    req.marketingProfile ?? null,
    req.currentPost ?? null
  );

  const windowed = takeSlidingWindow(req.history);
  const messages: ChatTurn[] = [
    ...windowed,
    { role: "user", content: req.userMessage },
  ];

  emit({ type: "status", status: "streaming" });

  let streamedReply = "";
  let output: AgentOutput;
  let providerUsed: string;

  try {
    const streamed = await streamWithOpenRouter(system, messages, (delta) => {
      streamedReply += delta;
      emit({ type: "token", text: delta });
    });
    output = streamed.output;
    providerUsed = `openrouter:${streamed.model}`;
  } catch (err) {
    console.warn(
      "[router] OpenRouter stream failed → non-stream failover",
      err instanceof Error ? err.message : err
    );
    emit({ type: "status", status: "thinking" });
    const fallback = await runStructuredAgent(system, messages);
    output = fallback.output;
    providerUsed = fallback.providerUsed;
    if (output.chat_reply) {
      emit({ type: "token", text: output.chat_reply });
      streamedReply = output.chat_reply;
    }
  }

  // Prefer the live-streamed Hebrew reply when grounding leaves it intact
  if (streamedReply.trim() && !output.chat_reply?.trim()) {
    output.chat_reply = streamedReply;
  }

  const postCtx = buildPostInputContext(req, windowed, visionNotes);

  enforcePublicationGrounding(output, {
    userMessage: req.userMessage,
    brand: req.brandGuidelines,
    brandDna,
    visionNotes,
    history: windowed,
  });

  {
    const gated = applyProductionPostGate(output, postCtx, providerUsed);
    output = gated.output;
    providerUsed = gated.providerUsed;
    if (gated.providerUsed === "fallback:golden-template" && output.chat_reply) {
      emit({ type: "reply_fix", text: output.chat_reply });
    }
  }

  const visualEnforced = await enforceExplicitVisualRequest(output, {
    system,
    messages,
    brandDna,
    brandGuidelines: req.brandGuidelines,
    visionNotes,
    userMessage: req.userMessage,
    history: windowed,
  });
  output = visualEnforced.output;
  if (visualEnforced.providerUsed) {
    providerUsed = `${providerUsed}+visual:${visualEnforced.providerUsed}`;
  }

  const guarded = await enforcePromptGuardrailBeforeFal(output, {
    system,
    messages,
    brandDna,
    brandGuidelines: req.brandGuidelines,
    visionNotes,
    userMessage: req.userMessage,
    history: windowed,
  });
  output = guarded.output;
  if (guarded.providerUsed) {
    providerUsed = `${providerUsed}+guard:${guarded.providerUsed}`;
  }

  // Sync bubble if grounding/guardrail altered the reply
  if (
    output.chat_reply &&
    streamedReply &&
    output.chat_reply !== streamedReply
  ) {
    emit({ type: "reply_fix", text: output.chat_reply });
  }

  emit({ type: "output", output, providerUsed });

  let image: GeneratedImage | null = null;
  if (output.image_task.generate_image && output.image_task.prompt) {
    // Phase 2: no local Niche Lock gate — dual engine (FAL → Together)
    if (req.deferImage) {
      // Close SSE after chat; client POSTs /api/regenerate-image (mobile-safe).
      console.log(
        "[router] deferImage — generate_image=true; client will call image next"
      );
      emit({ type: "status", status: "generating" });
      image = null;
    } else {
      emit({ type: "status", status: "generating" });
      try {
        console.log("[router] Calling dual image-service…");
        image = await generateImage({
          prompt: output.image_task.prompt,
          aspectRatio: output.image_task.aspect_ratio,
          previousPrompt: req.previousImagePrompt,
          userContext: req.userMessage,
          brandDna,
        });
        emit({ type: "image", image });
      } catch (falErr) {
        console.error(
          "[router] FAL failed",
          falErr instanceof Error ? falErr.message : falErr
        );
        const he =
          falErr &&
          typeof falErr === "object" &&
          "userMessageHe" in falErr &&
          typeof (falErr as { userMessageHe?: string }).userMessageHe ===
            "string"
            ? (falErr as { userMessageHe: string }).userMessageHe
            : "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב.";
        skipImageGeneration(output, he);
        emit({ type: "reply_fix", text: output.chat_reply });
        emit({ type: "output", output, providerUsed });
        image = null;
      }
    }
  }

  return {
    output,
    image,
    providerUsed,
    visionNotes,
  };
}
