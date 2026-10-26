/**
 * Full System Audit — verify all 6 stabilization phases in source.
 * Run: node scripts/audit-6-steps.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const ROOT = process.cwd();
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function abs(...parts) {
  return resolve(ROOT, ...parts);
}

function read(rel) {
  const p = abs(rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

function exists(rel) {
  return existsSync(abs(rel));
}

/** Recursively collect source files under dir (relative paths). */
function walk(relDir, acc = []) {
  const dir = abs(relDir);
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const rel = join(relDir, name).replace(/\\/g, "/");
    const st = statSync(abs(rel));
    if (st.isDirectory()) walk(rel, acc);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(name)) acc.push(rel);
  }
  return acc;
}

function fileIncludes(rel, needle) {
  const src = read(rel);
  return src != null && src.includes(needle);
}

function anyFileIncludes(files, needle) {
  return files.filter((f) => fileIncludes(f, needle));
}

function grepFiles(files, pattern) {
  const re = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
  const hits = [];
  for (const f of files) {
    const src = read(f);
    if (src && re.test(src)) hits.push(f);
  }
  return hits;
}

/** @type {Array<{ step: number; topic: string; status: 'PASS'|'FAIL'|'WARN'; notes: string }>} */
const rows = [];

function record(step, topic, status, notes) {
  rows.push({ step, topic, status, notes });
}

// ── Collect corpora ─────────────────────────────────────────────────────────
const aiFiles = walk("src/lib/ai");
const uiFiles = [
  ...walk("src/components/olar"),
  ...walk("src/app"),
  ...walk("src/lib/store"),
  ...walk("src/lib/utils"),
  ...walk("src/lib/olar"),
];
const allSrc = [...new Set([...aiFiles, ...uiFiles, ...walk("scripts")])];

console.log(`\n${BOLD}One Loop — Full System Audit (6 Steps)${RESET}`);
console.log(`Root: ${ROOT}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — State Persistence
// ═══════════════════════════════════════════════════════════════════════════
{
  const storePath = "src/lib/store/campaign-store.ts";
  const storeOk = exists(storePath);
  const storeSrc = read(storePath) || "";
  const keyOk =
    storeSrc.includes("one_loop_active_campaign") &&
    (storeSrc.includes("localStorage.setItem") ||
      storeSrc.includes("localStorage.getItem") ||
      storeSrc.includes("ONE_LOOP_CAMPAIGN_KEY"));
  const pageSrc = read("src/app/page.tsx") || "";
  const layoutSrc = read("src/components/olar/StudioLayout.tsx") || "";
  const pageWired =
    pageSrc.includes("StudioLayout") && pageSrc.includes("OlarApp");
  const layoutWired =
    layoutSrc.includes("campaign-store") ||
    layoutSrc.includes("one_loop_active_campaign") ||
    layoutSrc.includes("hydrateCampaignFromStorage") ||
    layoutSrc.includes("setCampaign");

  if (storeOk && keyOk && pageWired && layoutWired) {
    record(
      1,
      "State Persistence",
      "PASS",
      `${storePath}; key one_loop_active_campaign; page.tsx→StudioLayout; StudioLayout↔campaign-store`
    );
  } else {
    const missing = [];
    if (!storeOk) missing.push("missing campaign-store.ts");
    if (!keyOk) missing.push("no one_loop_active_campaign localStorage R/W");
    if (!pageWired) missing.push("page.tsx not wrapping StudioLayout");
    if (!layoutWired) missing.push("StudioLayout not wired to campaign-store");
    record(1, "State Persistence", "FAIL", missing.join("; "));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — AI Pipeline & Zero Blockers
// ═══════════════════════════════════════════════════════════════════════════
{
  const issues = [];
  const okNotes = [];

  if (exists("src/lib/ai/fal-circuit-breaker.ts")) {
    issues.push("fal-circuit-breaker.ts still exists");
  } else {
    okNotes.push("fal-circuit-breaker.ts deleted");
  }

  const cooldownHits = grepFiles(
    aiFiles,
    /cooldownMs\s*:\s*90_?000|90000/
  );
  const cbHits = grepFiles(
    aiFiles,
    /CircuitBreakerOpenError|isFalCircuitOpen|recordFalFailure/
  );
  if (cooldownHits.length || cbHits.length) {
    issues.push(
      `circuit/cooldown remnants: ${[...cooldownHits, ...cbHits].join(", ")}`
    );
  } else {
    okNotes.push("no cooldownMs:90000 / CircuitBreaker in lib/ai");
  }

  const imgSvc = read("src/lib/ai/image-service.ts") || "";
  const aiCfg = read("src/lib/ai-config.ts") || "";
  const hasFal =
    imgSvc.includes("fal-ai/flux/schnell") ||
    imgSvc.includes("AI_CONFIG.FAL_MODEL") ||
    fileIncludes("src/lib/ai/providers/fal.ts", "fal-ai/flux/schnell");
  const togetherDisabled =
    /TOGETHER_IMAGE_MODEL:\s*[\"']{2}/.test(aiCfg) ||
    /Together image generation disabled|togetherImages:\s*[\"']disabled[\"']/i.test(
      imgSvc
    );
  const hasOpenRouterBackup =
    /OPENROUTER_IMAGE_MODEL|generateWithOpenRouter|OpenRouter backup/i.test(
      imgSvc + aiCfg
    );
  const hasFalRetries =
    /FAL_MAX_ATTEMPTS\s*=\s*3|FAL_MAX_ATTEMPTS:\s*3/.test(imgSvc + aiCfg) &&
    /Math\.pow\(2|exponential/i.test(imgSvc);

  // Ensure no live Together images/generations HTTP call remains in image-service
  const togetherLiveCall =
    /api\.together\.(xyz|ai)\/v1\/images/.test(imgSvc) &&
    !/disabled|DISABLED|not called|never call/i.test(imgSvc);

  if (!hasFal) issues.push("no fal-ai/flux/schnell call path");
  else okNotes.push("FAL fal-ai/flux/schnell present");
  if (!togetherDisabled) {
    issues.push("Together still active as image path — must stay disabled");
  } else {
    okNotes.push("Together images disabled");
  }
  if (!hasOpenRouterBackup) {
    issues.push("OpenRouter image backup missing in image-service / ai-config");
  } else {
    okNotes.push("OpenRouter exclusive image backup present");
  }
  if (!hasFalRetries) {
    issues.push("FAL 3× exponential backoff retries missing");
  } else {
    okNotes.push("FAL 3× exponential backoff present");
  }
  if (togetherLiveCall) {
    issues.push("live Together images/generations URL still in image-service");
  }

  const nicheBlockHits = grepFiles(
    ["src/lib/ai/image-service.ts", "src/lib/ai/providers/fal.ts"],
    /FAL blocked by Niche Lock|Rejected locked\/forbidden|findForbiddenHits/
  );
  if (nicheBlockHits.length) {
    issues.push(`local Niche Lock blockers in: ${nicheBlockHits.join(", ")}`);
  } else {
    okNotes.push("no Niche Lock throw/block in image-service/fal.ts");
  }

  // Soft check: forbidden word lists used as prompt "avoid:" still exist elsewhere
  const avoidLists = grepFiles(
    aiFiles,
    /\bburglar\b.*\bmechanic\b|\bmechanic\b.*\bburglar\b/
  );
  if (avoidLists.length) {
    okNotes.push(
      `note: avoid:-style negatives still in ${avoidLists.slice(0, 3).join(", ")} (prompt shaping, not circuit breaker)`
    );
  }

  const unsplashInEngine = grepFiles(
    ["src/lib/ai/image-service.ts", "src/lib/olar/category-fallbacks.ts"],
    /images\.unsplash\.com/
  );
  if (unsplashInEngine.length) {
    issues.push(`Unsplash static URLs in: ${unsplashInEngine.join(", ")}`);
  } else {
    okNotes.push("no Unsplash URLs in image-service / category-fallbacks");
  }

  if (issues.length) {
    record(2, "AI Pipeline & Zero Blockers", "FAIL", issues.join(" | "));
  } else {
    record(2, "AI Pipeline & Zero Blockers", "PASS", okNotes.join("; "));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — UI & Inline Editing
// ═══════════════════════════════════════════════════════════════════════════
{
  const card = read("src/components/olar/PostCardPreview.tsx") || "";
  const studio = read("src/components/olar/views/StudioView.tsx") || "";
  const myPage = read("src/components/olar/views/MyPageView.tsx") || "";
  const issues = [];
  const ok = [];

  if (!card.includes("contentEditable") && !/textarea/i.test(card)) {
    issues.push("PostCardPreview missing contentEditable/textarea");
  } else {
    ok.push("PostCardPreview inline edit (contentEditable)");
  }

  if (!studio.includes("items-stretch")) {
    issues.push("StudioView A/B grid missing items-stretch");
  } else {
    ok.push("items-stretch grid");
  }

  if (!card.includes("mt-auto") && !studio.includes("mt-auto")) {
    issues.push("mt-auto not found on cards/actions");
  } else {
    ok.push("mt-auto action anchoring");
  }

  if (
    !myPage.includes("useCampaignStore") &&
    !myPage.includes("campaign-store")
  ) {
    issues.push("MyPageView not reading campaign-store");
  } else {
    ok.push("MyPageView ← campaign-store");
  }

  if (
    !myPage.includes("selectedVariation") &&
    !myPage.includes("useActiveCampaignVariation") &&
    !myPage.includes("imageUrl")
  ) {
    issues.push("MyPageView may not bind campaign image/text");
  } else {
    ok.push("MyPage shows campaign image/text");
  }

  record(
    3,
    "UI & Inline Editing",
    issues.length ? "FAIL" : "PASS",
    issues.length ? issues.join("; ") : ok.join("; ")
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4 — CLI Smoke Test
// ═══════════════════════════════════════════════════════════════════════════
{
  const scriptOk = exists("scripts/verify-pipeline.mjs");
  const pkg = read("package.json") || "";
  let scripts = {};
  try {
    scripts = JSON.parse(pkg).scripts || {};
  } catch {
    /* ignore */
  }
  const cmd = scripts["test:pipeline"] || "";
  const cmdOk =
    cmd.includes("verify-pipeline.mjs") || cmd.includes("verify-pipeline");

  if (scriptOk && cmdOk) {
    record(
      4,
      "CLI Smoke Test",
      "PASS",
      `scripts/verify-pipeline.mjs; package.json "test:pipeline": "${cmd}"`
    );
  } else {
    const missing = [];
    if (!scriptOk) missing.push("scripts/verify-pipeline.mjs missing");
    if (!cmdOk)
      missing.push(
        `package.json test:pipeline invalid (got: ${cmd || "undefined"})`
      );
    record(4, "CLI Smoke Test", "FAIL", missing.join("; "));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5 — Studio Agent Maya
// ═══════════════════════════════════════════════════════════════════════════
{
  const issues = [];
  const ok = [];
  const gen = read("src/components/olar/CampaignGenerator.tsx") || "";
  const layout = read("src/components/olar/StudioLayout.tsx") || "";
  const studio = read("src/components/olar/views/StudioView.tsx") || "";

  // Domain/pillar tag row under chat should be gone from CampaignGenerator
  if (gen.includes("ContentPillarTabs")) {
    issues.push(
      "CampaignGenerator still imports/renders ContentPillarTabs (domain tags)"
    );
  } else {
    ok.push("ContentPillarTabs removed from CampaignGenerator chat");
  }

  if (
    !layout.includes("one_loop_studio_messages") &&
    !fileIncludes("src/lib/store.ts", "one_loop_studio_messages")
  ) {
    issues.push("one_loop_studio_messages persistence missing");
  } else {
    ok.push("chat history → one_loop_studio_messages");
  }

  const preventsMissing =
    studio.includes("hasLivePost") ||
    studio.includes("Never show Missing Card") ||
    gen.includes("never Missing Card") ||
    gen.includes("no Missing Card") ||
    gen.includes("skipImages");
  if (!preventsMissing) {
    issues.push("no Missing Card prevention / live preview sync markers");
  } else {
    ok.push("left preview sync / Missing Card guards present");
  }

  if (!gen.includes("skipImages") && !gen.includes("fillImagesInBackground")) {
    issues.push(
      "Maya fast-text / background images flow missing in CampaignGenerator"
    );
  } else {
    ok.push("fast text + background images");
  }

  record(
    5,
    "Studio Agent Maya",
    issues.length ? "FAIL" : "PASS",
    issues.length ? issues.join("; ") : ok.join("; ")
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6 — Export, WhatsApp & Calendar
// ═══════════════════════════════════════════════════════════════════════════
{
  const issues = [];
  const ok = [];

  if (!exists("src/lib/utils/download-image.ts")) {
    issues.push("src/lib/utils/download-image.ts missing");
  } else if (
    !fileIncludes("src/lib/utils/download-image.ts", "downloadImageDirect")
  ) {
    issues.push("downloadImageDirect export missing");
  } else {
    ok.push("downloadImageDirect present");
  }

  const waHits = grepFiles(
    [
      "src/components/olar/views/MyPageView.tsx",
      "src/components/olar/views/StudioView.tsx",
      "src/lib/olar/connections.ts",
      "schemas/agent.ts",
    ],
    /api\.whatsapp\.com\/send\?text=\$\{encodeURIComponent|wa\.me\/.*encodeURIComponent|encodeURIComponent\([\s\S]{0,80}(?:wa\.me|api\.whatsapp)/
  );
  const waAlt = grepFiles(
    uiFiles,
    /https:\/\/(?:api\.whatsapp\.com\/send|wa\.me)\/?\?text=\$\{encodeURIComponent|wa\.me\/\$\{[^}]+\}/
  );
  if (!waHits.length && !waAlt.length) {
    // looser: encodeURIComponent + WhatsApp host in same file
    const loose = uiFiles.filter((f) => {
      const s = read(f) || "";
      return (
        s.includes("encodeURIComponent") &&
        (s.includes("wa.me") || s.includes("api.whatsapp.com"))
      );
    });
    if (!loose.length) {
      issues.push(
        "no WhatsApp api.whatsapp.com/wa.me + encodeURIComponent share link found"
      );
    } else {
      ok.push(`WhatsApp encodeURIComponent in ${loose.slice(0, 3).join(", ")}`);
    }
  } else {
    ok.push("WhatsApp encodeURIComponent share present");
  }

  // Exclude this audit script from key presence checks (avoid false positives)
  const prodSrc = allSrc.filter((f) => !f.includes("audit-6-steps"));
  const scheduledKeyHits = anyFileIncludes(
    prodSrc,
    "one_loop_scheduled_posts"
  );
  const calendarSrc = read("src/components/olar/views/CalendarView.tsx") || "";
  const studioSched =
    fileIncludes("src/components/olar/views/StudioView.tsx", "schedulePostToCalendar") ||
    fileIncludes("src/components/olar/views/StudioView.tsx", "createCalendarEvent");

  if (!scheduledKeyHits.length) {
    issues.push(
      "missing localStorage key 'one_loop_scheduled_posts' — need persist scheduled posts under that key and load them in CalendarView"
    );
  } else {
    ok.push("one_loop_scheduled_posts present");
    if (!calendarSrc.includes("one_loop_scheduled_posts")) {
      issues.push(
        "CalendarView does not read one_loop_scheduled_posts"
      );
    } else {
      ok.push("CalendarView reads one_loop_scheduled_posts");
    }
  }

  if (!studioSched) {
    issues.push("Studio schedule-to-calendar action missing");
  } else {
    ok.push("Studio schedulePostToCalendar / createCalendarEvent wired");
  }

  // Partial credit note if calendar API exists but different key
  if (
    !scheduledKeyHits.length &&
    (exists("src/lib/olar/calendar-client.ts") ||
      exists("src/app/api/calendar/route.ts"))
  ) {
    ok.push(
      "note: calendar API/client exists (calendar-events) but NOT under one_loop_scheduled_posts"
    );
  }

  record(
    6,
    "Export, WhatsApp & Calendar",
    issues.length ? "FAIL" : "PASS",
    issues.length
      ? `${issues.join(" | ")} — also: ${ok.join("; ") || "n/a"}`
      : ok.join("; ")
  );
}

// ── Print table ─────────────────────────────────────────────────────────────
const statusPad = 6;
const stepPad = 4;
const topicPad = 32;

console.log(
  `${"שלב".padEnd(stepPad)} | ${"נושא".padEnd(topicPad)} | ${"סטטוס".padEnd(statusPad)} | הערות / קבצים`
);
console.log("-".repeat(100));

let fails = 0;
for (const r of rows) {
  const color =
    r.status === "PASS" ? GREEN : r.status === "WARN" ? YELLOW : RED;
  const status = `${color}${r.status.padEnd(statusPad)}${RESET}`;
  console.log(
    `${String(r.step).padEnd(stepPad)} | ${r.topic.padEnd(topicPad)} | ${status} | ${r.notes}`
  );
  if (r.status === "FAIL") fails++;
}

console.log("-".repeat(100));
if (fails === 0) {
  console.log(`\n${GREEN}${BOLD}[AUDIT SUCCESS] All 6 steps PASS${RESET}\n`);
  process.exit(0);
} else {
  console.log(
    `\n${RED}${BOLD}[AUDIT INCOMPLETE] ${fails} step(s) FAIL — see notes above${RESET}\n`
  );
  process.exit(1);
}
