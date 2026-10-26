/**
 * Together AI chat — DISABLED.
 * Text / Maya studio use OpenRouter exclusively (`chatWithOpenRouter`).
 * Kept as a stub so accidental imports fail loudly instead of calling Together.
 */
export type TogetherChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type TogetherChatResult = {
  content: string;
  model: string;
  latencyMs: number;
};

/**
 * @deprecated Use `chatWithOpenRouter` from `./openrouter`.
 * Together text/chat is fully disabled (OpenRouter-only unification).
 */
export async function chatWithTogether(_opts: {
  messages: TogetherChatMessage[];
  temperature?: number;
  maxTokens?: number;
  models?: string[];
}): Promise<TogetherChatResult> {
  throw new Error(
    "Together chat disabled — use OpenRouter (chatWithOpenRouter) exclusively for text/Maya"
  );
}
