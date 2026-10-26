/**
 * Together AI image smoke — DISABLED.
 * FLUX on Together requires a dedicated endpoint.
 * Production images use FAL.ai only (see src/lib/ai-config.ts / image-service.ts).
 * Run: node scripts/test-together-flux.mjs
 */
console.log("Together image generation: DISABLED");
console.log(
  "Reason: black-forest-labs/FLUX.1-schnell requires a Together dedicated endpoint (not serverless)."
);
console.log("Image engine: FAL.ai fal-ai/flux/schnell (3× exponential backoff).");
console.log("AI_CONFIG.TOGETHER_IMAGE_MODEL: \"\" (empty)");
console.log("No Together images/generations request will be sent.");
process.exit(0);
