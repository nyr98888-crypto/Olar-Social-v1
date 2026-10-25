import type { BrandDna } from "../../../schemas/agent";

export interface PromptGuardrailResult {
  ok: boolean;
  /** Matched forbidden phrases (empty when ok) */
  hits: string[];
  prompt: string;
}

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive word/phrase match against forbidden_elements.
 * Multi-word phrases match as contiguous substrings; single tokens use word boundaries when ASCII.
 */
export function findForbiddenHits(
  prompt: string,
  forbidden: string[] | null | undefined
): string[] {
  if (!prompt?.trim() || !forbidden?.length) return [];

  const lower = prompt.toLowerCase();
  const hits: string[] = [];

  for (const raw of forbidden) {
    const term = raw?.trim();
    if (!term) continue;
    const needle = term.toLowerCase();

    let matched = false;
    if (/\s/.test(needle) || /[^\x00-\x7f]/.test(needle)) {
      // Phrase or non-ASCII: substring match
      matched = lower.includes(needle);
    } else {
      const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i");
      matched = re.test(prompt);
    }

    if (matched && !hits.some((h) => h.toLowerCase() === needle)) {
      hits.push(term);
    }
  }

  return hits;
}

/**
 * Prompt Guardrail — run BEFORE any FAL call.
 * Returns ok:false when the English image prompt contains Brand DNA forbidden_elements.
 */
export function validateImagePrompt(
  prompt: string | null | undefined,
  brandDna: BrandDna | null | undefined
): PromptGuardrailResult {
  const clean = (prompt ?? "").trim();
  if (!clean) {
    return { ok: false, hits: ["(empty prompt)"], prompt: clean };
  }

  const hits = findForbiddenHits(clean, brandDna?.forbidden_elements);
  return { ok: hits.length === 0, hits, prompt: clean };
}

/**
 * Severe correction user message appended when regenerating after a guardrail hit.
 * Instructs the LLM to rebuild a clean English Flux prompt from allowed_visual_style only.
 */
export function buildNicheLockCorrectionMessage(
  brandDna: BrandDna,
  dirtyPrompt: string,
  hits: string[]
): string {
  const forbiddenList =
    brandDna.forbidden_elements.length > 0
      ? brandDna.forbidden_elements.join(", ")
      : "(none listed — still avoid off-niche stock scenes)";

  return `[SYSTEM CORRECTION — NICHE LOCK VIOLATION — MANDATORY]
Your previous image_task.prompt was REJECTED and DISCARDED. Do NOT call it valid.

Rejected prompt:
"${dirtyPrompt}"

Forbidden elements detected (case-insensitive): ${hits.join(", ")}

IRON RULES:
1. This business is: ${brandDna.business_type}
2. image_task.prompt MUST stick ONLY to this allowed_visual_style (English):
   ${brandDna.allowed_visual_style}
3. Avoid ALL of these forbidden_elements: ${forbiddenList}
4. Never recycle prior campaign visuals, garage/workshop defaults, or training-data stock scenes.
5. Regenerate a COMPLETELY NEW English Flux prompt grounded in allowed_visual_style + current user intent + brand guidelines.
6. Keep generate_image=true only if you can produce a clean prompt; otherwise set generate_image=false and explain briefly in Hebrew chat_reply.

Respond with the full JSON AgentOutput again. Hebrew for chat_reply/social_post; English for image_task.prompt only.`;
}

/** Max LLM regeneration attempts after a dirty prompt (in addition to the first try). */
export const PROMPT_GUARDRAIL_MAX_RETRIES = 2;
