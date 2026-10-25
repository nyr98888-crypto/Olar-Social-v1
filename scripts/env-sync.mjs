/**
 * Merge missing/empty keys from .env.example → .env.local.
 * Never overwrites non-empty local values. Never prints secret values.
 * If example holds a real-looking secret, moves it to local and restores a placeholder.
 *
 * Run: npm run env:sync
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const examplePath = resolve(root, ".env.example");
const localPath = resolve(root, ".env.local");

const PLACEHOLDER_RE =
  /^(your_[\w-]*_?here|your_[\w-]+|YOUR_[\w.]+|changeme|xxx|todo|replace_me|<.*>)$/i;

function isPlaceholder(value) {
  const v = value.trim().replace(/^["']|["']$/g, "");
  if (!v) return true;
  if (PLACEHOLDER_RE.test(v)) return true;
  if (/YOUR_PROJECT/i.test(v)) return true;
  if (/^https:\/\/YOUR_/i.test(v)) return true;
  return false;
}

function parseEnv(text) {
  /** @type {Map<string, { rawLine: string, value: string, commented: boolean }>} */
  const map = new Map();
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    map.set(key, { rawLine, value, commented: false });
  }
  return { map, lines };
}

function stripQuotes(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function defaultPlaceholder(key) {
  if (key === "NEXT_PUBLIC_SUPABASE_URL") {
    return "https://YOUR_PROJECT.supabase.co";
  }
  if (key.includes("ANON")) return "your_anon_key_here";
  return "your_key_here";
}

if (!existsSync(examplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

const exampleText = readFileSync(examplePath, "utf8");
const localText = existsSync(localPath)
  ? readFileSync(localPath, "utf8")
  : "";

const example = parseEnv(exampleText);
const local = parseEnv(localText);

/** @type {string[]} */
const filled = [];
/** @type {string[]} */
const skippedPlaceholder = [];
/** @type {string[]} */
const preserved = [];
/** @type {string[]} */
const movedFromExample = [];

let localOut = localText;
let exampleOut = exampleText;
let localDirty = false;
let exampleDirty = false;

function ensureLocalKey(key, value) {
  const line = `${key}=${value}`;
  const existing = local.map.get(key);
  if (!existing) {
    if (localOut && !localOut.endsWith("\n")) localOut += "\n";
    localOut += `${line}\n`;
    local.map.set(key, { rawLine: line, value, commented: false });
    localDirty = true;
    return;
  }
  // Replace empty assignment in-place
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(localOut)) {
    localOut = localOut.replace(re, line);
  } else {
    if (localOut && !localOut.endsWith("\n")) localOut += "\n";
    localOut += `${line}\n`;
  }
  local.map.set(key, { rawLine: line, value, commented: false });
  localDirty = true;
}

function restoreExamplePlaceholder(key) {
  const ph = defaultPlaceholder(key);
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${ph}`;
  if (re.test(exampleOut)) {
    exampleOut = exampleOut.replace(re, line);
  }
  exampleDirty = true;
}

for (const [key, ex] of example.map) {
  const exVal = stripQuotes(ex.value);
  const loc = local.map.get(key);
  const locVal = loc ? stripQuotes(loc.value) : "";

  if (locVal) {
    preserved.push(key);
    continue;
  }

  // Local missing or empty
  if (!exVal || isPlaceholder(exVal)) {
    skippedPlaceholder.push(key);
    // Ensure key exists in local (empty) so the file is "complete"
    if (!loc) {
      ensureLocalKey(key, "");
      filled.push(`${key} (added empty)`);
    }
    continue;
  }

  // Example has a real-looking value — move to local, restore placeholder in example
  ensureLocalKey(key, ex.value.includes(" ") ? JSON.stringify(exVal) : ex.value);
  restoreExamplePlaceholder(key);
  movedFromExample.push(key);
  filled.push(key);
}

if (localDirty) writeFileSync(localPath, localOut, "utf8");
if (exampleDirty) writeFileSync(examplePath, exampleOut, "utf8");
if (!existsSync(localPath)) writeFileSync(localPath, localOut || "", "utf8");

console.log("env:sync done");
console.log(
  `  filled/moved: ${filled.length ? filled.join(", ") : "(none)"}`,
);
console.log(
  `  preserved (non-empty local): ${preserved.length ? preserved.join(", ") : "(none)"}`,
);
console.log(
  `  still empty (example placeholder only): ${
    skippedPlaceholder.length ? skippedPlaceholder.join(", ") : "(none)"
  }`,
);
if (movedFromExample.length) {
  console.log(
    `  secrets moved example→local + placeholders restored: ${movedFromExample.join(", ")}`,
  );
}
