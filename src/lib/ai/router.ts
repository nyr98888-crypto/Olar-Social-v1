import { buildSystemPrompt } from "./system-prompt";
import { generateWithOpenRouter } from "./providers/openrouter";
import { generateWithGroq } from "./providers/groq";
import {
  analyzeReferenceImages,
  generateWithGemini,
} from "./providers/gemini";
import { generateImageWithFal } from "./providers/fal";
import {
  takeSlidingWindow,
  type AgentPipelineResult,
  type AgentRequest,
  type ChatTurn,
} from "./types";
import type { AgentOutput } from "../../../schemas/agent";

/**
 * Authoritative provider chain
 * ────────────────────────────
 * TEXT / structured JSON (always):
 *   1) OpenRouter PRIMARY — anthropic/claude-3.5-haiku → openai/gpt-4o-mini
 *   2) Groq openai/gpt-oss-120b — ONLY if OpenRouter fails (error/429/5xx)
 *   3) Gemini Flash — ONLY if Groq also fails (text backup, never preferred)
 *
 * VISION (reference uploads only):
 *   Gemini Flash → English visual brief. Soft-skip on failure; text still
 *   runs OpenRouter. Gemini is NEVER used for image generation.
 *
 * IMAGES:
 *   FAL fal-ai/flux/schnell only, when generate_image === true.
 */
/** Exported for test-engine failover simulation */
export async function runStructuredAgent(
  system: string,
  messages: ChatTurn[]
): Promise<{ output: AgentOutput; providerUsed: string }> {
  // 1) OpenRouter — always first for conversational / structured JSON
  try {
    const { output, model } = await generateWithOpenRouter(system, messages);
    return { output, providerUsed: `openrouter:${model}` };
  } catch (err) {
    const status = (err as { status?: number }).status;
    console.warn(
      "[router] OpenRouter failed → Groq",
      status ?? (err instanceof Error ? err.message : err)
    );
  }

  // 2) Groq — backup text only
  try {
    const { output, model } = await generateWithGroq(system, messages);
    return { output, providerUsed: `groq:${model}` };
  } catch (err) {
    const status = (err as { status?: number }).status;
    console.warn(
      "[router] Groq failed → Gemini",
      status ?? (err instanceof Error ? err.message : err)
    );
  }

  // 3) Gemini Flash — final text backup only
  try {
    const { output, model } = await generateWithGemini(system, messages);
    return { output, providerUsed: `gemini:${model}` };
  } catch (err) {
    console.error(
      "[router] All text providers failed",
      err instanceof Error ? err.message : err
    );
    throw new Error(
      "All text providers failed (OpenRouter → Groq → Gemini). Please try again."
    );
  }
}

/**
 * Full agent pipeline:
 * 1) Optional vision brief via Gemini (soft-skip on 503/failure)
 * 2) Structured JSON: OpenRouter → Groq → Gemini
 * 3) Optional FAL image with random seed + anti-lock
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

  const system = buildSystemPrompt(
    req.brandGuidelines,
    visionNotes,
    req.previousImagePrompt ?? null
  );

  const windowed = takeSlidingWindow(req.history);
  const messages: ChatTurn[] = [
    ...windowed,
    { role: "user", content: req.userMessage },
  ];

  const { output, providerUsed } = await runStructuredAgent(system, messages);

  // Enforce text-only safety
  if (output.intent === "chit_chat") {
    output.social_post = null;
    output.image_task.generate_image = false;
  }

  let image = null;
  if (output.image_task.generate_image && output.image_task.prompt) {
    image = await generateImageWithFal({
      prompt: output.image_task.prompt,
      aspectRatio: output.image_task.aspect_ratio,
      previousPrompt: req.previousImagePrompt,
      userContext: req.userMessage,
    });
  }

  return {
    output,
    image,
    providerUsed,
    visionNotes,
  };
}
