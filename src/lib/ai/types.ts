import type {
  AgentOutput,
  BrandDna,
  BrandGuidelines,
} from "../../../schemas/agent";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ReferenceImage {
  mimeType: string;
  /** Base64 without data-URI prefix */
  data: string;
}

export interface AgentRequest {
  userMessage: string;
  history: ChatTurn[];
  brandGuidelines: BrandGuidelines | null;
  /** Niche lock — authoritative for visuals (from profile ± conversation). */
  brandDna?: BrandDna | null;
  referenceImages?: ReferenceImage[];
  /** Anti-lock comparison only — never inject into chat history as a template. */
  previousImagePrompt?: string | null;
}

export interface GeneratedImage {
  url: string;
  seed: number;
  prompt: string;
}

export interface AgentPipelineResult {
  output: AgentOutput;
  image: GeneratedImage | null;
  providerUsed: string;
  visionNotes: string | null;
}

export const SLIDING_WINDOW_SIZE = 6;

export function takeSlidingWindow(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-SLIDING_WINDOW_SIZE);
}

export function randomFalSeed(): number {
  return Math.floor(Math.random() * 10_000_000);
}

/** Normalize for anti-lock comparison (ignore case/whitespace). */
export function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

export function promptsAreTooSimilar(a: string, b: string): boolean {
  return normalizePrompt(a) === normalizePrompt(b);
}

/** Stale locked scenes that must never leak into FAL prompts. */
const LOCKED_SCENE_PATTERNS: RegExp[] = [
  /\bgarage\b/i,
  /\bmechanic\b/i,
  /\bauto\s*repair\b/i,
  /\boil[- ]?stained\b/i,
  /\bworkshop\b/i,
  /\bמוסך\b/,
  /\bמוסכים\b/,
  /\bמכונאי\b/,
];

export function hasLockedSceneLeak(prompt: string): boolean {
  return LOCKED_SCENE_PATTERNS.some((re) => re.test(prompt));
}

/**
 * Parse a data-URI or raw base64 string into a ReferenceImage.
 */
export function parseImageBase64(
  value: string,
  fallbackMime = "image/jpeg"
): ReferenceImage {
  const dataUri = /^data:([^;]+);base64,(.+)$/i.exec(value.trim());
  if (dataUri) {
    return { mimeType: dataUri[1], data: dataUri[2] };
  }
  return { mimeType: fallbackMime, data: value.trim() };
}

/**
 * Normalize imageBase64Array / referenceImages into ReferenceImage[].
 */
export function normalizeReferenceImages(input: {
  imageBase64Array?: string[];
  referenceImages?: ReferenceImage[];
}): ReferenceImage[] {
  const fromArray = (input.imageBase64Array ?? [])
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => parseImageBase64(s));

  const fromRefs = (input.referenceImages ?? []).filter(
    (r) => r?.data && r?.mimeType
  );

  return [...fromArray, ...fromRefs].slice(0, 2);
}
