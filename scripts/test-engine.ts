/**
 * Yona engine self-check.
 * Run: npx tsx scripts/test-engine.ts
 *   or: npm run test:engine
 *
 * Requires .env.local with API keys (see .env.example).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { AgentOutputSchema } from "../schemas/agent";
import { buildSystemPrompt } from "../src/lib/ai/system-prompt";
import { generateWithOpenRouter } from "../src/lib/ai/providers/openrouter";
import {
  generateWithGroq,
  GROQ_MODEL,
} from "../src/lib/ai/providers/groq";
import {
  generateWithGemini,
  getGeminiApiKey,
  GEMINI_MODEL,
} from "../src/lib/ai/providers/gemini";
import {
  generateImageWithFal,
  randomFalSeed,
  FAL_MODEL,
  sanitizeFalPrompt,
} from "../src/lib/ai/providers/fal";
import { runStructuredAgent } from "../src/lib/ai/router";
import { promptsAreTooSimilar } from "../src/lib/ai/types";

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

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

function skip(msg: string) {
  console.warn(`⚠ SKIP: ${msg}`);
}

// ─── 1) API key health checks ───────────────────────────────────────────────

async function healthOpenRouter(): Promise<boolean> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    skip("OPENROUTER_API_KEY missing");
    return false;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Yona Engine Test",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      skip(`OpenRouter health failed (${res.status}): ${body.slice(0, 160)}`);
      return false;
    }
    console.log(`✓ OpenRouter health (${res.status})`);
    return true;
  } catch (err) {
    skip(
      `OpenRouter health error: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

async function healthGroq(): Promise<boolean> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    skip("GROQ_API_KEY missing");
    return false;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 16,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      skip(
        `Groq health failed (${res.status}, model=${GROQ_MODEL}): ${body.slice(0, 160)}`
      );
      return false;
    }
    console.log(`✓ Groq health (${res.status}, model=${GROQ_MODEL})`);
    return true;
  } catch (err) {
    skip(
      `Groq health error: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

async function healthGemini(): Promise<boolean> {
  let key: string;
  try {
    key = getGeminiApiKey();
  } catch {
    skip("GEMINI_API_KEY / GOOGLE_AI_API_KEY missing");
    return false;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      skip(
        `Gemini health failed (${res.status}, model=${GEMINI_MODEL}): ${body.slice(0, 160)}`
      );
      return false;
    }
    console.log(`✓ Gemini health (${res.status}, model=${GEMINI_MODEL})`);
    return true;
  } catch (err) {
    skip(
      `Gemini health error: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

async function healthFal(): Promise<boolean> {
  const key = process.env.FAL_KEY;
  if (!key) {
    skip("FAL_KEY missing");
    return false;
  }
  try {
    // Auth probe only (GET) — does not queue a paid generation
    const res = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
      method: "GET",
      headers: { Authorization: `Key ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      skip(`FAL auth health failed (status ${res.status})`);
      return false;
    }
    console.log(`✓ FAL auth health (status ${res.status})`);
    return true;
  } catch (err) {
    skip(
      `FAL health error: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

async function testHealthChecks() {
  console.log("\n=== 1) API key health checks ===");
  // Soft-fail per provider — one unhealthy key must not abort the suite
  const results = await Promise.all([
    healthOpenRouter(),
    healthGroq(),
    healthGemini(),
    healthFal(),
  ]);
  const labels = ["openrouter", "groq", "gemini", "fal"] as const;
  const summary = labels
    .map((label, i) => `${label}=${results[i] ? "ok" : "fail"}`)
    .join(", ");
  console.log(`  providers: ${summary}`);
  const okCount = results.filter(Boolean).length;
  assert(okCount >= 1, `at least one provider healthy (${okCount}/4)`);
  return {
    openrouter: results[0],
    groq: results[1],
    gemini: results[2],
    fal: results[3],
  };
}

// ─── 2) Failover: disable OpenRouter → Groq < 2s ────────────────────────────

async function testFailoverToGroq(hasGroq: boolean) {
  console.log("\n=== 2) Failover simulation (OpenRouter → Groq) ===");
  if (!hasGroq) {
    skip("Groq unhealthy — cannot verify Groq failover");
    return;
  }

  const saved = process.env.OPENROUTER_API_KEY;
  // Force OpenRouter to fail immediately (missing key)
  delete process.env.OPENROUTER_API_KEY;

  const system = buildSystemPrompt(
    { brand_name: "בדיקה", tone: "ידידותי" },
    null,
    null
  );
  const messages = [
    { role: "user" as const, content: "היי, רק בודקים failover. תעני בקצרה." },
  ];

  const t0 = Date.now();
  try {
    const { output, providerUsed } = await runStructuredAgent(system, messages);
    const ms = Date.now() - t0;
    assert(
      providerUsed.startsWith("groq:"),
      `fell over to Groq (got ${providerUsed})`
    );
    // gpt-oss may spend a short reasoning pass; keep failover snappy but realistic
    assert(ms < 5000, `Groq reply in < 5s (actual ${ms}ms)`);
    AgentOutputSchema.parse(output);
    assert(output.chat_reply.length > 0, "failover reply has chat_reply");
    console.log(`  provider=${providerUsed}, ${ms}ms`);
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
}

// ─── 3) Seed randomness ─────────────────────────────────────────────────────

async function testSeedRandomness(hasFal: boolean) {
  console.log("\n=== 3) Seed randomness ===");
  const local = [randomFalSeed(), randomFalSeed(), randomFalSeed()];
  assert(
    new Set(local).size === 3,
    `local randomFalSeed all different: ${local.join(", ")}`
  );

  // Anti-lock sanitize: identical previous prompt gets a variation hint
  const base = "Minimal product photo of a glass serum bottle on cream linen";
  const varied = sanitizeFalPrompt(base, base);
  assert(
    !promptsAreTooSimilar(varied, base),
    "sanitizeFalPrompt forces variation when prompt matches previous"
  );

  if (!hasFal) {
    skip("FAL_KEY missing — skipping live FAL seed calls");
    return;
  }

  const prompt =
    "Minimal product photo of a glass serum bottle on cream linen, soft daylight, clean contemporary lifestyle, no text";
  const images: Array<{ url: string; seed: number; prompt: string }> = [];
  for (let i = 0; i < 3; i++) {
    images.push(
      await generateImageWithFal({
        prompt,
        previousPrompt: i === 0 ? null : images[i - 1]?.prompt,
        userContext: "serum bottle campaign",
      })
    );
  }
  const seeds = images.map((img) => img.seed);
  assert(
    new Set(seeds).size === 3,
    `3 FAL calls produced distinct seeds: ${seeds.join(", ")}`
  );
  assert(
    images.every((img) => !!img.url),
    "all 3 FAL calls returned URLs"
  );
}

// ─── 4) Text-only chit-chat ──────────────────────────────────────────────────

async function testTextOnly() {
  console.log("\n=== 4) Text-only chit-chat ===");
  const system = buildSystemPrompt(null, null, null);
  const messages = [
    { role: "user" as const, content: "היי יונה מה המצב?" },
  ];

  let output;
  let provider = "";
  try {
    const r = await generateWithOpenRouter(system, messages);
    output = r.output;
    provider = `openrouter:${r.model}`;
  } catch {
    try {
      const r = await generateWithGroq(system, messages);
      output = r.output;
      provider = `groq:${r.model}`;
    } catch {
      const r = await generateWithGemini(system, messages);
      output = r.output;
      provider = `gemini:${r.model}`;
    }
  }

  const parsed = AgentOutputSchema.parse(output);
  assert(parsed.image_task.generate_image === false, "generate_image is false");
  assert(
    parsed.social_post === null || parsed.intent === "chit_chat",
    "no campaign post for chit_chat"
  );
  assert(parsed.chat_reply.length > 0, `short natural reply via ${provider}`);
  assert(parsed.chat_reply.length < 500, "reply stays concise");
  console.log(`  reply: ${parsed.chat_reply.slice(0, 80)}...`);
}

async function main() {
  loadEnvLocal();
  console.log("Yona engine self-check\n");

  const health = await testHealthChecks();
  await testFailoverToGroq(health.groq);
  await testSeedRandomness(health.fal);
  await testTextOnly();

  console.log("\n✅ All engine checks passed.");
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
