import { buildSystemPrompt } from "./system-prompt";
import { generateWithOpenRouter } from "./providers/openrouter";
import { generateWithGroq } from "./providers/groq";
import {
  analyzeReferenceImages,
  generateWithGemini,
} from "./providers/gemini";
import { generateImageWithFal } from "./providers/fal";
import { enforcePublicationGrounding } from "./grounding";
import {
  buildNicheLockCorrectionMessage,
  PROMPT_GUARDRAIL_MAX_RETRIES,
  validateImagePrompt,
} from "./validator";
import {
  takeSlidingWindow,
  type AgentPipelineResult,
  type AgentRequest,
  type ChatTurn,
  type GeneratedImage,
} from "./types";
import type { AgentOutput, BrandDna } from "../../../schemas/agent";
import { isBrandDnaComplete } from "../../../schemas/agent";

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
 *   FAL fal-ai/flux/schnell only, when generate_image === true,
 *   AFTER Prompt Guardrail (forbidden_elements) passes.
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
 * Before FAL: validate prompt vs Brand DNA forbidden_elements.
 * On hit: discard prompt, re-call LLM with severe correction (up to MAX_RETRIES).
 * If still dirty: skip image safely.
 */
async function enforcePromptGuardrailBeforeFal(
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
  if (!output.image_task.generate_image || !output.image_task.prompt) {
    return { output };
  }

  const dna = isBrandDnaComplete(args.brandDna) ? args.brandDna : null;

  // No complete DNA → do not send visuals (Niche Lock incomplete)
  if (!dna) {
    console.warn("[router] Niche Lock incomplete — skipping FAL");
    skipImageGeneration(
      output,
      "לפני שאני מייצרת ויז'ואל — מה סוג העסק? (למשל מוסך, קוסמטיקאית, רואה חשבון)"
    );
    if (output.intent === "campaign_request" || output.intent === "refinement") {
      output.intent = "missing_info";
      output.social_post = null;
    }
    return { output };
  }

  let current = output;
  let lastProvider: string | undefined;
  const correctionMessages: ChatTurn[] = [];

  for (let attempt = 0; attempt <= PROMPT_GUARDRAIL_MAX_RETRIES; attempt++) {
    const check = validateImagePrompt(current.image_task.prompt, dna);
    if (check.ok) {
      return { output: current, providerUsed: lastProvider };
    }

    console.warn(
      "[router] Prompt Guardrail hit — discarding prompt",
      check.hits
    );

    // Discard dirty prompt; do not call FAL
    const dirty = check.prompt;
    current.image_task.generate_image = false;
    delete current.image_task.prompt;

    if (attempt >= PROMPT_GUARDRAIL_MAX_RETRIES) {
      break;
    }

    const correction = buildNicheLockCorrectionMessage(dna, dirty, check.hits);
    correctionMessages.push({ role: "user", content: correction });

    const { output: regenerated, providerUsed } = await runStructuredAgent(
      args.system,
      [...args.messages, ...correctionMessages]
    );
    lastProvider = providerUsed;
    current = regenerated;

    // Re-apply text contracts on regenerated output
    enforcePublicationGrounding(current, {
      userMessage: args.userMessage,
      brand: args.brandGuidelines,
      brandDna: dna,
      visionNotes: args.visionNotes,
      history: args.history,
    });
  }

  skipImageGeneration(
    current,
    "עצרתי את יצירת התמונה — הפרומפט חרג מנישת המותג. ננסה שוב עם כיוון ויזואלי אחר?"
  );
  return { output: current, providerUsed: lastProvider };
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
    brandDna
  );

  // Sliding window = last 6 messages only (no prior image prompts in chat)
  const windowed = takeSlidingWindow(req.history);
  const messages: ChatTurn[] = [
    ...windowed,
    { role: "user", content: req.userMessage },
  ];

  const { output: initialOutput, providerUsed: initialProvider } =
    await runStructuredAgent(system, messages);

  let output = initialOutput;
  let providerUsed = initialProvider;

  // Publication guardrails: chit_chat / missing_info contracts + strip ungrounded claims
  enforcePublicationGrounding(output, {
    userMessage: req.userMessage,
    brand: req.brandGuidelines,
    brandDna,
    visionNotes,
    history: windowed,
  });

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
    // Final gate immediately before FAL
    const finalCheck = validateImagePrompt(output.image_task.prompt, brandDna);
    if (!finalCheck.ok) {
      console.warn(
        "[router] Final guardrail blocked FAL",
        finalCheck.hits
      );
      skipImageGeneration(
        output,
        "עצרתי את יצירת התמונה — הפרומפט לא עמד בכללי הנישה."
      );
    } else {
      try {
        image = await generateImageWithFal({
          prompt: output.image_task.prompt,
          aspectRatio: output.image_task.aspect_ratio,
          previousPrompt: req.previousImagePrompt,
          userContext: req.userMessage,
          brandDna,
        });
      } catch (err) {
        console.error(
          "[router] FAL failed",
          err instanceof Error ? err.message : err
        );
        skipImageGeneration(
          output,
          "לא הצלחתי לייצר ויז'ואל הפעם — אפשר לנסות שוב."
        );
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
