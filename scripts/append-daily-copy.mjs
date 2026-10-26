/** Append daily/calendar keys to emit-ui-copy.mjs using \u escapes only. */
import fs from "fs";

const rows = [
  ["dailyUpdateTitle", "\u05e2\u05d3\u05db\u05d5\u05df \u05d9\u05d5\u05de\u05d9 \u05de\u05d4\u05e1\u05d5\u05db\u05df"],
  [
    "dailyUpdateBody",
    "\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1! 2 \u05e4\u05e0\u05d9\u05d5\u05ea \u05de\u05de\u05ea\u05d9\u05e0\u05d5\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4, \u05d5\u05e4\u05d5\u05e1\u05d8 \u05d4\u05de\u05d1\u05e6\u05e2 \u05d4\u05d9\u05d5\u05de\u05d9 \u05de\u05d5\u05db\u05df \u05dc\u05d4\u05e4\u05e6\u05d4.",
  ],
  ["dailyFreqLabel", "\u05ea\u05d3\u05d9\u05e8\u05d5\u05ea \u05e2\u05d3\u05db\u05d5\u05e0\u05d9\u05dd"],
  ["dailyFreqOnce", "\u05e4\u05e2\u05dd \u05d1\u05d9\u05d5\u05dd (\u05d1\u05d5\u05e7\u05e8)"],
  ["dailyFreqTwice", "\u05e4\u05e2\u05de\u05d9\u05d9\u05dd \u05d1\u05d9\u05d5\u05dd (\u05d1\u05d5\u05e7\u05e8 \u05d5\u05e2\u05e8\u05d1)"],
  [
    "dailyFreqRealtime",
    "\u05e2\u05d3\u05db\u05d5\u05e0\u05d9\u05dd \u05d1\u05d6\u05de\u05df \u05d0\u05de\u05ea \u05d1\u05db\u05dc \u05e4\u05e0\u05d9\u05d9\u05d4 \u05d7\u05d3\u05e9\u05d4",
  ],
  ["calPostModalTitle", "\u05e4\u05e8\u05d8\u05d9 \u05d4\u05e4\u05e8\u05e1\u05d5\u05dd"],
  ["calPublishTime", "\u05e9\u05e2\u05ea \u05e4\u05e8\u05e1\u05d5\u05dd"],
  ["calTargetNetwork", "\u05e8\u05e9\u05ea \u05d9\u05e2\u05d3"],
  ["calPostContent", "\u05ea\u05d5\u05db\u05df \u05d4\u05e4\u05d5\u05e1\u05d8"],
  ["calNoPostDay", "\u05d0\u05d9\u05df \u05e4\u05d5\u05e1\u05d8 \u05de\u05ea\u05d5\u05d6\u05de\u05df \u05dc\u05d9\u05d5\u05dd \u05d6\u05d4"],
  ["openSettingsAria", "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea"],
  ["bioPreviewTitle", "\u05ea\u05e6\u05d5\u05d2\u05ea \u05d3\u05e3 \u05d4\u05d1\u05d9\u05d5"],
];

let emit = fs.readFileSync("scripts/emit-ui-copy.mjs", "utf8");
if (emit.includes("dailyUpdateTitle")) {
  console.log("already present");
} else {
  const block = rows
    .map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`)
    .join("\n");
  const marker = '["quickNoWaiting"';
  const pos = emit.lastIndexOf(marker);
  if (pos < 0) throw new Error("quickNoWaiting not found");
  const endArr = emit.indexOf("];", pos);
  if (endArr < 0) throw new Error("]; not found");
  emit = emit.slice(0, endArr) + block + "\n" + emit.slice(endArr);
  fs.writeFileSync("scripts/emit-ui-copy.mjs", emit, "utf8");
  console.log("inserted", rows.length);
}
