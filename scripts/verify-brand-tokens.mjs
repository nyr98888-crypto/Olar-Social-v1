import fs from "fs";

const g = fs.readFileSync("src/app/globals.css", "utf8");
const m = fs.readFileSync("src/lib/olar/mock-data.ts", "utf8");
const o = fs.readFileSync("src/components/olar/OlarApp.tsx", "utf8");
const c = fs.readFileSync("src/lib/olar/ui-copy.ts", "utf8");
const w = fs.readFileSync("src/components/olar/WorkModeToggle.tsx", "utf8");

console.log(
  "tokens",
  /--accent:\s*#0284c7/i.test(g),
  /--accent-hover:\s*#0369a1/i.test(g),
  /--accent-soft:\s*#f0f9ff/i.test(g),
  /--color-yona/.test(g),
  /\.olar-cta[\s\S]*var\(--accent\)/.test(g)
);
console.log(
  "brand",
  m.includes(
    "\u05d5\u05d5\u05d0\u05df \u05dc\u05d5\u05e4 \u05e1\u05d5\u05e6\u05d9\u05d0\u05dc"
  ),
  !m.includes("\u05d0\u05d5\u05dc\u05e8 \u05e1\u05d5\u05e9\u05d9\u05d0\u05dc")
);
console.log(
  "header",
  o.includes("WorkModeToggle") && o.includes("Settings2") && o.includes("openMenu")
);
console.log("agent", c.includes("\u05e1\u05d5\u05db\u05df \u05e9\u05d9\u05d5\u05d5\u05e7 AI"));
console.log("daily", c.includes("dailyUpdateTitle"));
console.log("mic", /micRecordIdea: "([^"]+)"/.exec(c)?.[1]);
console.log("pinterest", m.includes('"pinterest"'));
console.log("workModeAccent", w.includes("bg-accent") && w.includes("font-bold"));
console.log(
  "noWashedPrimary",
  !/bg-sky-600|bg-blue-600|sky-300|sky-400/.test(
    fs.readFileSync("src/components/olar/WorkModeToggle.tsx", "utf8") +
      fs.readFileSync("src/components/olar/BottomNav.tsx", "utf8")
  )
);
