/**
 * Detect when the user clearly asks to publish / generate a post + image.
 * Used as a server-side safety net so LLM misses still trigger generate_image.
 */
const VISUAL_REQUEST_PATTERNS: RegExp[] = [
  /תרימ[יו]/, // תרימי / תרימו
  /תעלי/,
  /תייצר[י]?/,
  /תיצור[י]?/,
  /צור[י]?\s*(לי\s*)?(תמונ|ויז|פוסט)/,
  /הפוסט\s*והתמונ/,
  /התמונ[הה]?\s*והפוסט/,
  /קדימה.*(פוסט|תמונ|ויז|קמפיין)/,
  /תמונ[הה]?.{0,24}(בבקשה|עכשיו|קדימה|תרימ|תייצר)/,
  /(פוסט|קמפיין|ויז).{0,24}(תרימ|תעלי|תייצר|קדימה)/,
  /generate\s*(an?\s*)?(image|visual|post)/i,
  /create\s*(an?\s*)?(image|visual|post)/i,
  /make\s*(an?\s*)?(image|visual)/i,
];

export function userExplicitlyRequestsVisual(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return VISUAL_REQUEST_PATTERNS.some((re) => re.test(text));
}

/** One-shot correction when the model forgot generate_image on an explicit ask. */
export function buildVisualGenerationCorrectionMessage(): string {
  return `CRITICAL CORRECTION — the user explicitly asked you to create/publish the post AND the image.
You MUST respond with the full JSON AgentOutput again where:
1. intent = "campaign_request" (or "refinement" if refining)
2. social_post is filled in Hebrew from grounding sources (not null)
3. image_task.generate_image = true
4. image_task.prompt = a detailed English-only Flux prompt grounded in user intent + brand guidelines + Brand DNA allowed_visual_style
5. chat_reply in Hebrew, first-person feminine (e.g. "הכנתי לך את הפוסט והתמונה")

Do NOT set generate_image=false. Do NOT return chit_chat.`;
}
