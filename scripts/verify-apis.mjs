/**
 * Live AI provider health + Hebrew text smoke test.
 * Run: npm run test:apis
 * Never prints full secrets.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

function mask(key) {
  const v = process.env[key];
  if (!v) return "MISSING";
  return `OK (${v.slice(0, 4)}*** len=${v.length})`;
}

function row(provider, status, latencyMs, error) {
  return { provider, status, latencyMs, error: error || "" };
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    await fn();
    return row(label, "OK", Date.now() - t0, "");
  } catch (err) {
    return row(
      label,
      "FAILED",
      Date.now() - t0,
      err instanceof Error ? err.message.slice(0, 140) : String(err).slice(0, 140)
    );
  }
}

loadEnvLocal();

console.log("\n=== ENV (masked) ===");
for (const k of [
  "OPENROUTER_API_KEY",
  "FAL_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  console.log(`${k}: ${mask(k)}`);
}

const OPENROUTER_MODELS = [
  "anthropic/claude-haiku-5.5",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-exp:free",
];

const results = [];

results.push(
  await timed("OpenRouter", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY missing");
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "One Loop Social verify-apis",
      },
      body: JSON.stringify({
        // OpenRouter allows ≤3 models per request
        model: OPENROUTER_MODELS[0],
        models: OPENROUTER_MODELS.slice(1, 3),
        max_tokens: 80,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content:
              'Reply with JSON only: {"chat_reply":"שלום בעברית קצרה על עסק מקומי"}',
          },
        ],
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body.slice(0, 100)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    if (!hasHebrew) {
      throw new Error(`no Hebrew in response (model=${data.model || "?"})`);
    }
    console.log(
      `  Hebrew smoke OK via openrouter:${data.model || OPENROUTER_MODELS[0]}`
    );
  })
);

const grokKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
if (grokKey) {
  results.push(
    await timed("Grok/xAI", async () => {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${grokKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-3-mini",
          max_tokens: 40,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );
} else {
  results.push(row("Grok/xAI", "SKIPPED", 0, "no key"));
}

results.push(
  await timed("Groq", async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY missing");
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  })
);

results.push(
  await timed("Gemini", async () => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");
    const model = "gemini-3.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  })
);

results.push(
  await timed("FAL", async () => {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY missing");
    // Presence check only — avoid burning credits on every verify
    if (key.length < 10) throw new Error("key too short");
  })
);

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (sbUrl && sbKey) {
  results.push(
    await timed("Supabase", async () => {
      const res = await fetch(`${sbUrl.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: sbKey },
        signal: AbortSignal.timeout(10_000),
      });
      // Some projects return 200; others 404 on /health — treat 2xx/404 as reachable
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    })
  );
} else {
  results.push(row("Supabase", "SKIPPED", 0, "not configured"));
}

console.log("\n=== Provider | Status | Latency ms | Error ===");
for (const r of results) {
  console.log(
    `${r.provider.padEnd(14)} | ${r.status.padEnd(7)} | ${String(r.latencyMs).padStart(6)} | ${r.error}`
  );
}

const failed = results.filter((r) => r.status === "FAILED");
if (failed.length) {
  console.error(`\n${failed.length} provider(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nAll required pings OK (or skipped optional).");
}

console.log(
  "\nForced soft fallback tip: unset OPENROUTER_API_KEY temporarily and call /api/chat — expect ok:true, fallback:true, Hebrew niche post."
);
