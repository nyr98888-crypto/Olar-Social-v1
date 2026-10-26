/**
 * Map primary sky/cobalt utility classes to brand accent tokens.
 * Soft tints (sky-50/100) → accent-soft; primary CTAs → accent / accent-hover.
 */
import fs from "fs";
import path from "path";

const roots = ["src/components/olar", "src/app"];

const replacements = [
  // Primary fills / text / borders / rings
  ["bg-sky-600", "bg-accent"],
  ["hover:bg-sky-700", "hover:bg-accent-hover"],
  ["hover:bg-sky-600", "hover:bg-accent"],
  ["text-sky-600", "text-accent"],
  ["hover:text-sky-600", "hover:text-accent"],
  ["border-sky-600", "border-accent"],
  ["hover:border-sky-600", "hover:border-accent"],
  ["hover:border-sky-400", "hover:border-accent"],
  ["ring-sky-600", "ring-accent"],
  ["focus:border-sky-600", "focus:border-accent"],
  ["focus:ring-sky-600", "focus:ring-accent"],
  ["shadow-sky-600/25", "shadow-sky-600/20"],
  ["shadow-sky-600/30", "shadow-sky-600/20"],
  // Soft surfaces
  ["bg-sky-50", "bg-accent-soft"],
  ["hover:bg-sky-50", "hover:bg-accent-soft"],
  ["bg-sky-50/50", "bg-accent-soft/80"],
  ["bg-sky-50/60", "bg-accent-soft/90"],
  ["border-sky-100", "border-sky-100"], // keep subtle line; mapped via --line in cards
  // Secondary darker labels on soft cards
  ["text-sky-700", "text-accent"],
  ["text-sky-200", "text-sky-100"],
  ["bg-sky-500", "bg-accent"],
  ["bg-sky-200/70", "bg-accent/25"],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

let filesTouched = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let src = fs.readFileSync(file, "utf8");
    const before = src;
    for (const [a, b] of replacements) {
      if (a === b) continue;
      src = src.split(a).join(b);
    }
    // Explicit primary button pattern preferred by design brief
    src = src.split("bg-blue-600").join("bg-accent");
    src = src.split("hover:bg-blue-700").join("hover:bg-accent-hover");
    if (src !== before) {
      fs.writeFileSync(file, src, "utf8");
      filesTouched++;
      console.log("patched", file.replace(/\\/g, "/"));
    }
  }
}
console.log("accent-class files", filesTouched);
