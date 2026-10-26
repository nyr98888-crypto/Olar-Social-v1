/**
 * CLI smoke test — FAL.ai exclusive image engine (3× retries).
 * Run: npm run test:pipeline
 *
 * Together AI is not used for images (dedicated endpoint required for FLUX).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fal } from "@fal-ai/client";

const FAL_MODEL = "fal-ai/flux/schnell";
const FAL_MAX_ATTEMPTS = 3;
const FAL_RETRY_BASE_MS = 1_000;

const PROMPT =
  "Professional golden door lock cylinder installed on modern entrance door, photorealistic 8k";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

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
    console.log(`${GREEN}✓${RESET} Loaded env from ${name}`);
    return;
  }
  console.warn(
    `${YELLOW}⚠${RESET} No .env.local / .env found — using process.env only`
  );
}

function maskKey(name) {
  const v = process.env[name]?.trim();
  if (!v) return `${RED}MISSING${RESET}`;
  return `${GREEN}OK${RESET} (${v.slice(0, 4)}*** len=${v.length})`;
}

function shortUrl(url) {
  if (!url || typeof url !== "string") return "(none)";
  if (url.length <= 64) return url;
  return `${url.slice(0, 48)}…`;
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithFalOnce(prompt, seed) {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    const err = new Error("FAL_KEY missing");
    err.statusCode = 401;
    throw err;
  }
  fal.config({ credentials: key });

  const result = await fal.subscribe(FAL_MODEL, {
    input: {
      prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      seed,
      enable_safety_checker: true,
    },
    logs: false,
  });

  const url = result?.data?.images?.[0]?.url;
  if (!url) {
    const err = new Error("FAL returned no image URL in data.images[0]");
    err.statusCode = 502;
    throw err;
  }
  return url;
}

async function generateWithFalRetry(prompt, seed, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? FAL_MAX_ATTEMPTS;
  let forceFailFirst = Boolean(opts.forceFailFirst);
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (forceFailFirst) {
        forceFailFirst = false;
        throw new Error("Simulated FAL failure (retry test)");
      }
      return await generateWithFalOnce(prompt, seed);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      const delay = Math.min(
        FAL_RETRY_BASE_MS * Math.pow(2, attempt - 1),
        8_000
      );
      console.warn(
        `  ${YELLOW}⚠${RESET} FAL attempt ${attempt}/${maxAttempts} failed — retry in ${delay}ms`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

function printFail(provider, statusCode, message) {
  console.error(`\n${RED}${"=".repeat(40)}${RESET}`);
  console.error(`${RED}${BOLD}[PIPELINE VERIFICATION FAILED]${RESET}`);
  console.error(`${RED}- Provider: ${provider}${RESET}`);
  console.error(`${RED}- Status Code: ${statusCode ?? "n/a"}${RESET}`);
  console.error(`${RED}- Error: ${message}${RESET}`);
  console.error(`${RED}${"=".repeat(40)}${RESET}\n`);
}

async function main() {
  console.log(`\n${BOLD}One Loop — FAL-Only Image Pipeline Smoke Test${RESET}`);
  console.log(`Engine:   FAL.ai exclusive (${FAL_MODEL})`);
  console.log(`Retries:  ${FAL_MAX_ATTEMPTS}× exponential backoff`);
  console.log(`Together: DISABLED (no image API calls)`);
  console.log(`Prompt:   ${PROMPT.slice(0, 72)}…\n`);

  loadEnvLocal();

  console.log("\n=== API Keys ===");
  console.log(`FAL_KEY:           ${maskKey("FAL_KEY")}`);
  console.log(
    `TOGETHER_API_KEY:  ${maskKey("TOGETHER_API_KEY")} ${YELLOW}(ignored for images)${RESET}`
  );

  if (!process.env.FAL_KEY?.trim()) {
    printFail("FAL.ai", 401, "FAL_KEY is missing from .env.local");
    process.exit(1);
  }

  // ── Test 1: normal FAL call ────────────────────────────────────────────
  console.log(`\n${BOLD}[1/2] FAL primary — ${FAL_MODEL}${RESET}`);
  const seed0 = Math.floor(Math.random() * 2147483647);
  let url0 = "";
  let latencyMs = 0;
  try {
    const t0 = Date.now();
    url0 = await generateWithFalOnce(PROMPT, seed0);
    latencyMs = Date.now() - t0;
    if (!isHttpUrl(url0)) throw new Error(`Invalid URL: ${url0}`);
    console.log(
      `${GREEN}✓${RESET} FAL 200 OK — ${latencyMs}ms — seed=${seed0}`
    );
    console.log(`  URL: ${shortUrl(url0)}`);
  } catch (err) {
    printFail(
      FAL_MODEL,
      err?.statusCode || 500,
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }

  // ── Test 2: retry path (fail first attempt, recover) ───────────────────
  console.log(
    `\n${BOLD}[2/2] FAL retries — simulate 1 failure then recover${RESET}`
  );
  const seed1 = Math.floor(Math.random() * 2147483647);
  let url1 = "";
  try {
    const t0 = Date.now();
    url1 = await generateWithFalRetry(PROMPT, seed1, {
      forceFailFirst: true,
    });
    const ms = Date.now() - t0;
    if (!isHttpUrl(url1)) throw new Error(`Invalid URL: ${url1}`);
    console.log(`${GREEN}✓${RESET} FAL retry recovery OK — ${ms}ms`);
    console.log(`  URL: ${shortUrl(url1)}`);
  } catch (err) {
    printFail(
      "FAL retries",
      err?.statusCode || 500,
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }

  console.log(`\n${GREEN}${"=".repeat(40)}${RESET}`);
  console.log(`${GREEN}${BOLD}[PIPELINE VERIFICATION SUCCESS]${RESET}`);
  console.log(`- Image Engine: FAL.ai only (${FAL_MODEL})`);
  console.log(`- Primary: PASS (${latencyMs}ms)`);
  console.log(`- Retries (3× backoff): VERIFIED`);
  console.log(`- Together images: DISABLED (no calls)`);
  console.log(`- Image 1: ${shortUrl(url0)}`);
  console.log(`- Image 2: ${shortUrl(url1)}`);
  console.log(`${GREEN}${"=".repeat(40)}${RESET}\n`);
  process.exit(0);
}

main().catch((err) => {
  printFail(
    "verify-pipeline",
    500,
    err instanceof Error ? err.stack || err.message : String(err)
  );
  process.exit(1);
});
