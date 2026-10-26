/** Append interaction-related UI keys using \u escapes only (PowerShell-safe). */
import fs from "fs";

const rows = [
  ["fixPostBtn", "\u05ea\u05e7\u05df \u05de\u05e9\u05d4\u05d5 \u05d1\u05e4\u05d5\u05e1\u05d8"],
  [
    "fixPostHint",
    "\u05de\u05d4 \u05dc\u05e9\u05e0\u05d5\u05ea? (\u05dc\u05de\u05e9\u05dc: \u05ea\u05e7\u05e6\u05e8 / \u05d4\u05d5\u05e1\u05e3 \u05de\u05d1\u05e6\u05e2)",
  ],
  ["fixPostApply", "\u05d4\u05d7\u05dc"],
  [
    "micRecordingTapEnd",
    "\u05de\u05e7\u05dc\u05d9\u05d8... \u05dc\u05d7\u05e5 \u05dc\u05e1\u05d9\u05d5\u05dd",
  ],
  ["userMenuAria", "\u05ea\u05e4\u05e8\u05d9\u05d8 \u05de\u05e9\u05ea\u05de\u05e9"],
  [
    "logoutRestartOnboarding",
    "\u05d4\u05ea\u05e0\u05ea\u05e7 / \u05d4\u05ea\u05d7\u05dc \u05de\u05d7\u05d3\u05e9 (Onboarding)",
  ],
  ["tickerLive", "\u05d7\u05d9"],
  [
    "micFallbackDone",
    "\u05e8\u05e2\u05d9\u05d5\u05df \u05e9\u05d4\u05d5\u05e7\u05dc\u05d8: \u05de\u05d1\u05e6\u05e2 \u05d4\u05e9\u05d1\u05d5\u05e2 + \u05e7\u05e8\u05d9\u05d0\u05d4 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  ],
];

let emit = fs.readFileSync("scripts/emit-ui-copy.mjs", "utf8");
if (emit.includes("fixPostBtn")) {
  console.log("already present");
} else {
  const block = rows
    .map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`)
    .join("\n");
  const marker = '["bioPreviewTitle"';
  const pos = emit.lastIndexOf(marker);
  if (pos < 0) throw new Error("bioPreviewTitle not found");
  const endArr = emit.indexOf("];", pos);
  if (endArr < 0) throw new Error("]; not found");
  emit = emit.slice(0, endArr) + block + "\n" + emit.slice(endArr);
  fs.writeFileSync("scripts/emit-ui-copy.mjs", emit, "utf8");
  console.log("inserted", rows.length);
}
