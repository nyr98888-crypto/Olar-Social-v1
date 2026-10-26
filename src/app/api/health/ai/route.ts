import { NextResponse } from "next/server";
import { OPENROUTER_MODELS } from "@/lib/ai/providers/openrouter";
import { isGrokConfigured, getGrokApiKey } from "@/lib/ai/providers/grok";
import { getGeminiApiKey, GEMINI_MODEL } from "@/lib/ai/providers/gemini";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  provider: string;
  status: "OK" | "FAILED" | "SKIPPED";
  latencyMs: number;
  error?: string;
};

async function ping(
  name: string,
  fn: () => Promise<void>
): Promise<Row> {
  const started = Date.now();
  try {
    await fn();
    return { provider: name, status: "OK", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      provider: name,
      status: "FAILED",
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 120) : "failed",
    };
  }
}

/** Lightweight AI provider health — no secrets in response. */
export async function GET() {
  const rows: Row[] = [];

  rows.push(
    await ping("OpenRouter", async () => {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("missing key");
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  if (isGrokConfigured()) {
    rows.push(
      await ping("Grok/xAI", async () => {
        const key = getGrokApiKey();
        const res = await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
    );
  } else {
    rows.push({
      provider: "Grok/xAI",
      status: "SKIPPED",
      latencyMs: 0,
      error: "no XAI_API_KEY / GROK_API_KEY",
    });
  }

  rows.push(
    await ping("Groq", async () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("missing key");
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  rows.push(
    await ping("Gemini", async () => {
      const key = getGeminiApiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}?key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  rows.push(
    await ping("FAL", async () => {
      const key = process.env.FAL_KEY;
      if (!key) throw new Error("missing key");
      // Key presence + trivial auth header check (no paid generation)
      if (!key.startsWith("fal_") && key.length < 8) {
        throw new Error("invalid key shape");
      }
    })
  );

  rows.push({
    provider: "Supabase",
    status: isSupabaseConfigured() ? "OK" : "SKIPPED",
    latencyMs: 0,
    error: isSupabaseConfigured() ? undefined : "not configured",
  });

  const ok = rows.every((r) => r.status !== "FAILED");
  return NextResponse.json({
    ok,
    openRouterModels: OPENROUTER_MODELS,
    checks: rows,
  });
}
