import type {
  AgentOutput,
  BrandDna,
  BrandGuidelines,
} from "../../../schemas/agent";
import type { PartnerMemory } from "./partner-memory";
import type { UserMarketingProfile } from "@/lib/olar/user-marketing-profile";

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
  /** Personal Marketing Partner memory (name, niche, writing style). */
  partnerMemory?: PartnerMemory | null;
  /** Wingman activity memory (posts, wins) from user_marketing_profiles. */
  marketingProfile?: UserMarketingProfile | null;
  referenceImages?: ReferenceImage[];
  /** Anti-lock comparison only — never inject into chat history as a template. */
  previousImagePrompt?: string | null;
  /**
   * When true: run text + Niche Lock guardrails only; skip FAL.
   * Client (or stream Phase C) fetches the image in a follow-up so chat never hangs.
   */
  deferImage?: boolean;
}

export type ImageProviderId = "fal" | "together" | "static-fallback";

export interface GeneratedImage {
  url: string;
  /** Which provider produced the URL (circuit-breaker / fallback). */
  provider?: ImageProviderId;
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
  return Math.floor(Math.random() * 2147483647);
}

/** Normalize for anti-lock comparison (ignore case/whitespace). */
export function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

export function promptsAreTooSimilar(a: string, b: string): boolean {
  return normalizePrompt(a) === normalizePrompt(b);
}

/**
 * Cross-niche garage/workshop stock scenes — blocked only when the business
 * is NOT a garage (on-niche garage visuals are allowed).
 */
const LOCKED_GARAGE_SCENE_PATTERNS: RegExp[] = [
  /\bgarage\b/i,
  /\bmechanic\b/i,
  /\bauto\s*repair\b/i,
  /\boil[- ]?stained\b/i,
  /\bworkshop\b/i,
  /\bמוסך\b/,
  /\bמוסכים\b/,
  /\bמכונאי\b/,
];

function nicheLooksLikeGarage(businessType?: string | null): boolean {
  const t = (businessType || "").toLowerCase();
  return (
    t.includes("garage") ||
    t.includes("auto") ||
    t.includes("mechanic") ||
    t.includes("מוסך") ||
    t.includes("רכב") ||
    t.includes("מכונאי")
  );
}

/**
 * True when a garage/workshop scene leaked into a non-garage brand prompt.
 * Pass businessType from Brand DNA so legitimate garage niches are not blocked.
 */
export function hasLockedSceneLeak(
  prompt: string,
  businessType?: string | null
): boolean {
  if (nicheLooksLikeGarage(businessType)) return false;
  return LOCKED_GARAGE_SCENE_PATTERNS.some((re) => re.test(prompt));
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
