/**
 * Smoke test — Together AI chat (Maya).
 * Tries DeepSeek-V3 first, then current serverless chat models.
 * Run: node scripts/test-together-chat.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const TOGETHER_CHAT_URL = "https://api.together.xyz/v1/chat/completions";
const MODELS = [
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-V4.1-Flash",
  "deepseek-ai/DeepSeek-V4-Pro-0813",
  "openai/gpt-oss-120b",
  "Qwen/Qwen3.5-9B",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  "meta-llama/Meta-Llama-3.1-70B-Instruct",
];

function loadEnvLocal() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
    console.log("Loaded env from", name);
    return;
  }
}

loadEnvLocal();
const key = process.env.TOGETHER_API_KEY?.trim();
if (!key) {
  console.error("FAIL: TOGETHER_API_KEY missing");
  process.exit(1);
}

const currentPost = {
  headline: "מנעולים זהב — פתיחה מהירה",
  bodyText: "שירות מנעולן 24/7 באזור שלכם",
  ctaButton: "לתיאום בוואטסאפ",
};

const system = `את מאיה, מנהלת השיווק הדיגיטלי של העסק. הפוסט הנוכחי המוצג למשתמש הוא: ${JSON.stringify(currentPost)}. כשמבקשים ממך לעדכן את הכותרת או הטקסט, החזירי תשובה הכוללת את הטקסט המעודכן בפורמט JSON כדי לעדכן את הכרטיס השמאלי בלייב.

החזירי JSON בלבד:
{"replyMessage":"...","headline":"...","bodyText":"...","ctaButton":"...","variations":[{"headline":"...","bodyText":"...","ctaButton":"..."},{"headline":"...","bodyText":"...","ctaButton":"..."}]}`;

console.log("Together Maya chat test");
console.log("Key:", `${key.slice(0, 8)}***`);

let ok = false;
let usedModel = "";
for (const model of MODELS) {
  console.log(`\n→ Trying ${model}`);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(TOGETHER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: "תחדדי את הכותרת שתהיה יותר שיווקית ומזמינה",
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    console.log("Network error:", err instanceof Error ? err.message : err);
    continue;
  }
  const body = await res.text();
  const ms = Date.now() - t0;
  console.log("Status:", res.status, `(${ms}ms)`);
  if (!res.ok) {
    console.log("Body:", body.slice(0, 220).replace(/\s+/g, " "));
    continue;
  }
  console.log("Response body (full):");
  console.log(body);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error("FAIL: non-JSON envelope");
    continue;
  }
  const content = parsed?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("FAIL: empty content");
    continue;
  }
  let maya;
  try {
    maya = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
    );
  } catch {
    console.error("FAIL: content is not JSON", content.slice(0, 200));
    continue;
  }
  console.log("\nPASS model=", model);
  console.log("replyMessage:", maya.replyMessage);
  console.log("headline:", maya.headline || maya.variations?.[0]?.headline);
  console.log("bodyText:", maya.bodyText || maya.variations?.[0]?.bodyText);
  ok = true;
  usedModel = model;
  break;
}

if (ok) {
  console.log(`\n[OK] Together chat verified with ${usedModel}`);
}
process.exit(ok ? 0 : 1);
