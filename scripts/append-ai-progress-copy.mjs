/** Append AI progress / soft-ready keys via \u escapes (PowerShell-safe). */
import fs from "fs";

const rows = [
  [
    "aiProgress1",
    "\u05d4\u05e1\u05d5\u05db\u05df \u05de\u05e0\u05ea\u05d7 \u05d0\u05ea \u05d4\u05e2\u05e1\u05e7 \u05d5\u05de\u05e0\u05e1\u05d7 \u05e8\u05e2\u05d9\u05d5\u05df \u05de\u05e0\u05e6\u05d7...",
  ],
  [
    "aiProgress2",
    "\u05de\u05d3\u05d9\u05d9\u05e7 \u05d0\u05ea \u05d4\u05de\u05d9\u05dc\u05d9\u05dd \u05d5\u05de\u05e2\u05e6\u05d1 \u05d5\u05d9\u05d6'\u05d5\u05d0\u05dc \u05e9\u05de\u05ea\u05d0\u05d9\u05dd \u05d1\u05d3\u05d9\u05d5\u05e7 \u05dc\u05e2\u05e1\u05e7 \u05e9\u05dc\u05da...",
  ],
  [
    "aiProgress3",
    "\u05db\u05de\u05e2\u05d8 \u05e9\u05dd! \u05e2\u05d5\u05d3 \u05e8\u05d2\u05e2 \u05d4\u05db\u05dc \u05de\u05d5\u05db\u05df \u05dc\u05ea\u05e6\u05d5\u05d2\u05d4...",
  ],
  [
    "aiSoftReady",
    "\u05d4\u05e4\u05d5\u05e1\u05d8 \u05de\u05d5\u05db\u05df! \u05e0\u05d9\u05ea\u05df \u05dc\u05e2\u05e8\u05d5\u05da \u05d5\u05dc\u05dc\u05d8\u05e9 \u05d0\u05d5\u05ea\u05d5 \u05db\u05e8\u05e6\u05d5\u05e0\u05da.",
  ],
];

let emit = fs.readFileSync("scripts/emit-ui-copy.mjs", "utf8");
if (emit.includes("aiProgress1")) {
  console.log("aiProgress keys already in emit-ui-copy.mjs");
} else {
  const block =
    rows.map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`).join("\n") +
    "\n";
  const marker = '["micFallbackDone"';
  const pos = emit.lastIndexOf(marker);
  if (pos < 0) throw new Error("micFallbackDone not found");
  const endArr = emit.indexOf("];", pos);
  if (endArr < 0) throw new Error("]; not found");
  emit = emit.slice(0, endArr) + block + emit.slice(endArr);
  fs.writeFileSync("scripts/emit-ui-copy.mjs", emit, "utf8");
  console.log("inserted into emit-ui-copy.mjs", rows.length);
}

// Patch ui-copy.ts directly if emitter would overwrite other keys poorly
let ui = fs.readFileSync("src/lib/olar/ui-copy.ts", "utf8");
if (ui.includes("aiProgress1")) {
  console.log("aiProgress keys already in ui-copy.ts");
} else {
  const insert = rows
    .map(([k, v]) => {
      const he = JSON.parse(`"${v}"`);
      return `  ${k}: ${JSON.stringify(he)},`;
    })
    .join("\n");
  ui = ui.replace(
    "  micFallbackDone:",
    `${insert}\n  micFallbackDone:`
  );
  fs.writeFileSync("src/lib/olar/ui-copy.ts", ui, "utf8");
  console.log("inserted into ui-copy.ts", rows.length);
}
