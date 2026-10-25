/**
 * Self-check for Yona agent pipeline.
 * Run: npm run test:pipeline
 * Requires .env.local with OPENROUTER_API_KEY, GEMINI_API_KEY (or GOOGLE_AI_API_KEY), FAL_KEY
 * Optional: GROQ_API_KEY for failover path
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { AgentOutputSchema } from "../schemas/agent";
import { generateWithOpenRouter } from "../src/lib/ai/providers/openrouter";
import { generateWithGemini } from "../src/lib/ai/providers/gemini";
import { generateImageWithFal, randomFalSeed } from "../src/lib/ai/providers/fal";
import { buildSystemPrompt } from "../src/lib/ai/system-prompt";
import { promptsAreTooSimilar } from "../src/lib/ai/types";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.warn("⚠ .env.local not found — relying on process.env");
    return;
  }
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

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

const BANNED_LOCK_WORDS = [
  "mechanic garage",
  "auto repair shop",
  "oil-stained floor",
  "default workshop",
];

async function testTextOnlyJson() {
  console.log("\n--- 1) Text-only structured JSON ---");
  const system = buildSystemPrompt(
    { brand_name: "בדיקה", tone: "ידידותי" },
    null,
    null
  );
  const messages = [
    {
      role: "user" as const,
      content: "היי יונה, מה שלומך? רק שיחה קצרה בלי פוסט ובלי תמונה.",
    },
  ];

  let output;
  let provider = "openrouter";
  try {
    const r = await generateWithOpenRouter(system, messages);
    output = r.output;
    provider = `openrouter:${r.model}`;
  } catch (e) {
    console.warn("OpenRouter unavailable, trying Groq:", e);
    try {
      const { generateWithGroq } = await import(
        "../src/lib/ai/providers/groq"
      );
      const r = await generateWithGroq(system, messages);
      output = r.output;
      provider = `groq:${r.model}`;
    } catch (e2) {
      console.warn("Groq unavailable, trying Gemini:", e2);
      const r = await generateWithGemini(system, messages);
      output = r.output;
      provider = `gemini:${r.model}`;
    }
  }

  const parsed = AgentOutputSchema.parse(output);
  assert(parsed.image_task.generate_image === false, "generate_image is false");
  assert(
    parsed.social_post === null || parsed.intent === "chit_chat",
    "chit_chat / no campaign post"
  );
  assert(parsed.chat_reply.length > 0, `chat_reply present via ${provider}`);
}

async function testCampaignDynamicPrompt() {
  console.log("\n--- 2) Campaign request → dynamic English prompt ---");
  const system = buildSystemPrompt(
    {
      brand_name: "Nura Botanics",
      tone: "רגוע, טבעי",
      colors: ["sage", "cream"],
      audience: "נשים 25-40",
    },
    "Product: glass dropper bottle with pale green serum, soft daylight, linen cloth",
    null
  );
  const messages = [
    {
      role: "user" as const,
      content:
        "תכיני לי קמפיין אינסטגרם לסרם לחות חדש בשם Dawn Dew, כולל תמונה שיווקית.",
    },
  ];

  let output;
  try {
    const r = await generateWithOpenRouter(system, messages);
    output = r.output;
  } catch {
    const r = await generateWithGemini(system, messages);
    output = r.output;
  }

  const parsed = AgentOutputSchema.parse(output);
  assert(
    parsed.image_task.generate_image === true,
    "generate_image true for campaign"
  );
  assert(!!parsed.image_task.prompt, "English image prompt exists");
  const prompt = parsed.image_task.prompt!.toLowerCase();
  assert(
    !BANNED_LOCK_WORDS.some((w) => prompt.includes(w)),
    "prompt has no hardcoded lock visuals from past"
  );
  // Heuristic: mostly Latin / English
  const hebrewChars = (parsed.image_task.prompt!.match(/[\u0590-\u05FF]/g) || [])
    .length;
  assert(hebrewChars === 0, "image prompt is English-only");
  assert(!!parsed.social_post?.headline, "social_post.headline present");
  console.log("  prompt sample:", parsed.image_task.prompt!.slice(0, 120) + "...");
  return parsed.image_task.prompt!;
}

async function testFalSeeds(prompt: string) {
  console.log("\n--- 3) FAL random seeds uniqueness ---");
  const seeds = [randomFalSeed(), randomFalSeed(), randomFalSeed(), randomFalSeed(), randomFalSeed()];
  assert(new Set(seeds).size >= 4, `local seeds mostly unique: ${seeds.join(",")}`);

  if (!process.env.FAL_KEY) {
    console.warn("⚠ FAL_KEY missing — skipping live FAL calls");
    return;
  }

  const a = await generateImageWithFal({
    prompt,
    previousPrompt: null,
  });
  const b = await generateImageWithFal({
    prompt,
    previousPrompt: a.prompt,
  });

  assert(a.seed !== b.seed, `consecutive FAL seeds differ (${a.seed} vs ${b.seed})`);
  assert(!!a.url && !!b.url, "both FAL calls returned URLs");
  // Anti-lock: if same base prompt, second should have been varied OR at least seed differs
  if (promptsAreTooSimilar(prompt, prompt)) {
    assert(a.seed !== b.seed, "anti-lock still yields new seed");
  }
  console.log("  urls ok, seeds:", a.seed, b.seed);
}

async function main() {
  loadEnvLocal();
  console.log("Yona pipeline self-check\n");

  if (
    !process.env.OPENROUTER_API_KEY &&
    !process.env.GEMINI_API_KEY &&
    !process.env.GOOGLE_AI_API_KEY &&
    !process.env.GROQ_API_KEY
  ) {
    throw new Error(
      "Need OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY/GOOGLE_AI_API_KEY in .env.local"
    );
  }

  await testTextOnlyJson();
  const prompt = await testCampaignDynamicPrompt();
  await testFalSeeds(prompt);

  console.log("\n✅ All pipeline checks passed.");
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
