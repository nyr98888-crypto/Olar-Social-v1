import fs from "fs";

const path = "src/lib/olar/mock-data.ts";
let m = fs.readFileSync(path, "utf8");

const he = {
  fb: "\u05e4\u05d9\u05d9\u05e1\u05d1\u05d5\u05e7",
  ig: "\u05d0\u05d9\u05e0\u05e1\u05d8\u05d2\u05e8\u05dd",
  google: "\u05d2\u05d5\u05d2\u05dc \u05e2\u05e1\u05e7\u05d9\u05dd",
  reels: "\u05e8\u05d9\u05dc\u05e1",
  local: "\u05e2\u05e1\u05e7\u05de\u05e7\u05d5\u05de\u05d9",
  hook: "\u05de\u05d1\u05e6\u05e2 \u05de\u05e7\u05d5\u05de\u05d9 \u05e7\u05e6\u05e8",
  contact:
    "\u05d4\u05ea\u05e7\u05e9\u05e8\u05d5 \u05d0\u05d5 \u05e9\u05dc\u05d7\u05d5 \u05d4\u05d5\u05d3\u05e2\u05d4",
};

const networks = `export const NETWORKS = [
  { id: "facebook" as const, label: ${JSON.stringify(he.fb)} },
  { id: "instagram" as const, label: ${JSON.stringify(he.ig)} },
  { id: "google" as const, label: ${JSON.stringify(he.google)} },
  { id: "twitter" as const, label: "X" },
  { id: "reels" as const, label: ${JSON.stringify(he.reels)} },
];`;

const a = m.indexOf("export const NETWORKS = [");
const b = m.indexOf("export const AUTOMATION_MODES");
if (a < 0 || b < 0) {
  console.error("NETWORKS markers missing");
  process.exit(1);
}
m = m.slice(0, a) + networks + "\n\n" + m.slice(b);

if (!m.includes('google: {\n    label:')) {
  const insert = `  google: {
    label: ${JSON.stringify(he.google)},
    maxChars: 300,
    hook: ${JSON.stringify(he.hook)},
    hashtags: [${JSON.stringify("#" + he.local)}],
    contact: ${JSON.stringify(he.contact)},
  },
`;
  m = m.replace(
    /  reels: \{[\s\S]*?contact: [\s\S]*?,\n  \},\n\};/,
    (block) => block.replace(/\n\};$/, `\n${insert}};`)
  );
}

fs.writeFileSync(path, m, "utf8");
console.log(
  "google network",
  m.includes('id: "google" as const'),
  "platform",
  m.includes("maxChars: 300")
);
