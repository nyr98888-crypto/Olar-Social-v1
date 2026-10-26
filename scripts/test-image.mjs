/**
 * Together AI image smoke test (no UI). Alias of test-together-flux flow.
 * Model id must match AI_CONFIG.TOGETHER_IMAGE_MODEL in src/lib/ai-config.ts.
 * Run: node scripts/test-image.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const TOGETHER_IMAGES_URL = "https://api.together.xyz/v1/images/generations";
/** Keep in sync with src/lib/ai-config.ts → AI_CONFIG.TOGETHER_IMAGE_MODEL */
const MODEL = "";
const WIDTH = 1024;
const HEIGHT = 1024;
const STEPS = 4;

function loadEnvLocal() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function redact(s) {
  return String(s)
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/TOGETHER_API_KEY[^\s"']*/gi, "[REDACTED]")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]")
    .slice(0, 500);
}

loadEnvLocal();

console.log("Together image test");
console.log("URL:", TOGETHER_IMAGES_URL);
console.log("Model:", MODEL || "(empty — disabled)");
console.log("Dims:", `${WIDTH}x${HEIGHT}`, "steps:", STEPS);

if (!MODEL.trim()) {
  console.log(
    "SKIP: AI_CONFIG.TOGETHER_IMAGE_MODEL is empty — no Together image model works for this account."
  );
  console.log("Production images: FAL.ai fal-ai/flux/schnell via image-service.");
  process.exit(0);
}

const key = process.env.TOGETHER_API_KEY?.trim();
if (!key) {
  console.error("FAILED: TOGETHER_API_KEY missing in .env.local");
  process.exit(1);
}

const seed = Math.floor(Math.random() * 2147483647);
const prompt =
  "A clean product photo of a ceramic coffee mug on a wooden table, soft daylight, no text";

console.log("seed:", seed);
console.log("Key:", `${key.slice(0, 4)}*** len=${key.length}`);

const t0 = Date.now();
let res;
try {
  res = await fetch(TOGETHER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      width: WIDTH,
      height: HEIGHT,
      steps: STEPS,
      n: 1,
      seed,
    }),
  });
} catch (err) {
  console.error(
    "FAILED: network error",
    redact(err instanceof Error ? err.message : err)
  );
  process.exit(1);
}

const latencyMs = Date.now() - t0;
const bodyText = await res.text().catch(() => "");

console.log("Status:", res.status);
console.log("Latency ms:", latencyMs);

if (!res.ok) {
  console.error("FAILED status:", res.status, "body:", redact(bodyText));
  process.exit(1);
}

let data;
try {
  data = JSON.parse(bodyText);
} catch {
  console.error("FAILED: non-JSON body:", redact(bodyText));
  process.exit(1);
}

const url = data?.data?.[0]?.url;
if (!url) {
  console.error("FAILED: 200 but no data[0].url:", redact(bodyText));
  process.exit(1);
}

console.log("SUCCESS URL:", url.slice(0, 100) + (url.length > 100 ? "…" : ""));
process.exit(0);
