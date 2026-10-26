/**
 * AI provider config — OpenRouter-only text/chat · FAL images.
 *
 * Images:  Primary = FAL.ai · Backup = OpenRouter (Flux Schnell) when wired
 * Text:    Exclusive = OpenRouter Chat Completions (home + Maya studio)
 *
 * Together AI is DISABLED for text/chat. Image Together remains empty.
 */
export const AI_CONFIG = {
  /**
   * Together image generation remains disabled (empty).
   * Image failover goes to OpenRouter, not Together.
   */
  TOGETHER_IMAGE_MODEL: "",
  STEPS: 4,
  DIMENSIONS: { width: 1024, height: 1024 },

  /** Primary image engine */
  IMAGE_ENGINE: "fal" as const,
  FAL_MODEL: "fal-ai/flux/schnell",
  FAL_MAX_ATTEMPTS: 3,

  /**
   * Exclusive image backup via OPENROUTER_API_KEY.
   * User-specified slug; OpenRouter may alias FLUX.1-schnell variants.
   */
  OPENROUTER_IMAGE_MODEL: "black-forest-labs/flux-1-schnell",
  OPENROUTER_IMAGE_FALLBACKS: [
    "black-forest-labs/flux.1-schnell",
    "black-forest-labs/FLUX.1-schnell",
  ] as const,
  OPENROUTER_IMAGE_TIMEOUT_MS: 45_000,

  /** Primary text — OpenRouter only (no Together / Groq / Gemini for chat). */
  TEXT_ENGINE: "openrouter" as const,

  /**
   * Structured text hard cap (router + text-service).
   * 10s prevents premature abort on OpenRouter Hebrew marketing copy.
   */
  STRUCTURED_TEXT_TIMEOUT_MS: 10_000,

  /**
   * Maya studio + default chat model (OpenRouter).
   * gpt-4o-mini preferred for speed + Hebrew reliability.
   */
  TEXT_CHAT_MODEL: "openai/gpt-4o-mini",
  TEXT_CHAT_FALLBACKS: [
    "anthropic/claude-haiku-5.5",
    "anthropic/claude-3.5-haiku",
    "openai/gpt-4o-mini",
  ] as const,
  MAYA_CHAT_MODEL: "openai/gpt-4o-mini",
  MAYA_CHAT_FALLBACKS: [
    "anthropic/claude-haiku-5.5",
    "anthropic/claude-3.5-haiku",
  ] as const,
  /** Keep Maya snappy — soft plain reply if JSON misses; never hang. */
  MAYA_CHAT_TIMEOUT_MS: 12_000,
} as const;
