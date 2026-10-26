/**
 * Together.ai — image generation DISABLED.
 * FLUX requires a dedicated endpoint on Together; production uses FAL.ai only.
 * Text/other Together usage (if any) is out of scope here.
 */
import type { GeneratedImage } from "../types";
import { AI_CONFIG } from "@/lib/ai-config";

/** Empty = Together images off (must stay in sync with ai-config). */
export const TOGETHER_IMAGE_MODEL = AI_CONFIG.TOGETHER_IMAGE_MODEL;
export const TOGETHER_IMAGE_TIMEOUT_MS = 30_000;

export async function generateImageWithTogether(_opts: {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "16:9";
  seed?: number;
}): Promise<GeneratedImage> {
  throw new Error(
    "Together image generation disabled — FLUX requires a dedicated endpoint; use FAL.ai only"
  );
}
