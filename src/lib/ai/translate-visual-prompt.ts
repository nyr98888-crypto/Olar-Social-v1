/**
 * Universal Visual Art Director — authoritative LLM step before FAL.
 * Raw user text (any language) → pure English commercial FLUX prompt.
 * Category blueprints seed/fallback only. Groq → Gemini Flash.
 */
import {
  applyVisualPromptGuardrail,
  buildFalVisualPrompt,
  CATEGORY_BLUEPRINTS,
  detectVisualCategory,
  hasHebrewScript,
  nicheToCategory,
  type FalVisualPurpose,
  type VisualCategory,
} from "./fal-visual-prompt";
import { withTimeout } from "./with-timeout";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const LLM_TIMEOUT_MS = 12_000;

/** Exact Art Director system instruction (authoritative for step 1). */
export const ART_DIRECTOR_SYSTEM = `You are an expert commercial art director. Convert ANY local business request into an English commercial ad photography prompt for FLUX. 
MANDATORY RULES: 
- Always enforce bright commercial daylight, clean workshop/office/studio lighting.
- Never generate dark, murky, or night scenes.
- Specify subject in action, clean environment, shot on 35mm lens f/2.8, sharp focus, 8k resolution.
- Strict: NO text, NO letters, NO watermarks.
- Output ONLY the prompt string.`;

function cleanLlmPrompt(raw: string): string {
  let t = raw
    .trim()
    .replace(/^```[\w]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (hasHebrewScript(t)) {
    t = t.replace(/[\u0590-\u05FF]+/g, " ").replace(/\s+/g, " ").trim();
  }
  return t;
}

async function artDirectorGroq(userText: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const res = await withTimeout(
      fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.35,
          messages: [
            { role: "system", content: ART_DIRECTOR_SYSTEM },
            { role: "user", content: userText.slice(0, 1500) },
          ],
        }),
      }),
      LLM_TIMEOUT_MS,
      "Groq art director"
    );
    if (!res.ok) {
      console.warn("[art-director] Groq", res.status);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const cleaned = cleanLlmPrompt(data.choices?.[0]?.message?.content || "");
    return cleaned.length >= 40 ? cleaned : null;
  } catch (err) {
    console.warn(
      "[art-director] Groq failed",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function artDirectorGemini(userText: string): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelIds = [
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-flash-latest",
    ];
    const prompt = `${ART_DIRECTOR_SYSTEM}\n\nBusiness request:\n${userText.slice(0, 1500)}`;
    for (const modelId of modelIds) {
      try {
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await withTimeout(
          model.generateContent(prompt),
          LLM_TIMEOUT_MS,
          "Gemini art director"
        );
        const cleaned = cleanLlmPrompt(result.response.text() || "");
        if (cleaned.length >= 40) return cleaned;
      } catch (err) {
        console.warn(
          `[art-director] Gemini ${modelId}`,
          err instanceof Error ? err.message : err
        );
      }
    }
    return null;
  } catch (err) {
    console.warn(
      "[art-director] Gemini failed",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export type TranslateVisualOpts = {
  description: string;
  niche?: string | null;
  businessName?: string | null;
  purpose?: FalVisualPurpose | null;
  allowedVisualStyle?: string | null;
  /** When true, skip LLM and only guardrail an already-English prompt */
  englishReady?: boolean;
};

/**
 * Pipeline step 1+2:
 * Art Director LLM (or blueprint fallback) → safety regex guardrail.
 * Always returns non-empty English safe for FAL. Never returns Hebrew.
 */
export async function translateToFalEnglishPrompt(
  opts: TranslateVisualOpts
): Promise<{
  prompt: string;
  source: "groq" | "gemini" | "template" | "passthrough";
  category: VisualCategory;
}> {
  const raw = (opts.description || "").trim();
  const category =
    opts.niche && nicheToCategory(opts.niche) !== "GENERAL_TRADE"
      ? nicheToCategory(opts.niche)
      : detectVisualCategory(raw, opts.niche, opts.allowedVisualStyle);

  // Already-English path (e.g. route already ran Art Director)
  if (
    opts.englishReady ||
    (raw.length >= 40 && !hasHebrewScript(raw))
  ) {
    return {
      prompt: applyVisualPromptGuardrail(raw, category),
      source: "passthrough",
      category,
    };
  }

  if (raw) {
    const fromGroq = await artDirectorGroq(raw);
    if (fromGroq && !hasHebrewScript(fromGroq)) {
      return {
        prompt: applyVisualPromptGuardrail(fromGroq, category),
        source: "groq",
        category,
      };
    }
    const fromGemini = await artDirectorGemini(raw);
    if (fromGemini && !hasHebrewScript(fromGemini)) {
      return {
        prompt: applyVisualPromptGuardrail(fromGemini, category),
        source: "gemini",
        category,
      };
    }
  }

  // Blueprint fallback when LLM unavailable
  const prompt = buildFalVisualPrompt({
    niche: opts.niche,
    businessName: opts.businessName,
    hebrewPrompt: hasHebrewScript(raw) ? raw : null,
    englishPrompt: raw || null,
    userHint: raw,
    allowedVisualStyle: opts.allowedVisualStyle,
    purpose: opts.purpose,
    category,
  });

  return {
    prompt: applyVisualPromptGuardrail(prompt, category),
    source: "template",
    category,
  };
}

export { CATEGORY_BLUEPRINTS };
