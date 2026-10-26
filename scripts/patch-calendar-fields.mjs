/** Add publishTime/body to CalendarEvent mock posts. Handles CRLF. */
import fs from "fs";

let types = fs.readFileSync("src/lib/olar/types.ts", "utf8");
if (!types.includes("publishTime?")) {
  types = types.replace(
    "  network?: string;\r\n  suggestion?: string;\r\n}",
    "  network?: string;\r\n  publishTime?: string;\r\n  body?: string;\r\n  suggestion?: string;\r\n}"
  );
  if (!types.includes("publishTime?")) {
    types = types.replace(
      "  network?: string;\n  suggestion?: string;\n}",
      "  network?: string;\n  publishTime?: string;\n  body?: string;\n  suggestion?: string;\n}"
    );
  }
  fs.writeFileSync("src/lib/olar/types.ts", types, "utf8");
}
console.log("types", types.includes("publishTime?"));

let mock = fs.readFileSync("src/lib/olar/mock-data.ts", "utf8");

const patches = [
  {
    id: "e1",
    time: "09:30",
    body: "\u05d4\u05d7\u05d5\u05e8\u05e3 \u05db\u05d1\u05e8 \u05e4\u05d4 \u2014 \u05d1\u05d3\u05e7\u05d5 \u05de\u05e6\u05d1\u05e8 \u05d5\u05de\u05d2\u05d1\u05d9\u05dd \u05d0\u05e6\u05dc\u05e0\u05d5. \u05db\u05ea\u05d1\u05d5 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05dc\u05ea\u05d9\u05d0\u05d5\u05dd.",
  },
  {
    id: "e2",
    time: "18:00",
    body: "15 \u05e9\u05e0\u05d9\u05d5\u05ea \u05de\u05d4\u05e9\u05d8\u05d7 \u2014 \u05d1\u05dc\u05d9 \u05de\u05d5\u05d6\u05d9\u05e7\u05d4 \u05e8\u05d5\u05e2\u05e9\u05ea.",
  },
  {
    id: "e5",
    time: "12:00",
    body: "\u05e9\u05d0\u05dc\u05d4 \u05d0\u05d7\u05ea \u05dc\u05e7\u05d4\u05dc \u05d4\u05d9\u05d5\u05dd \u2014 \u05d5\u05e0\u05e2\u05e0\u05d4 \u05de\u05d7\u05e8 \u05d1\u05e4\u05d5\u05e1\u05d8.",
  },
  {
    id: "e7",
    time: "10:15",
    body: "\u05e6\u05d9\u05d8\u05d5\u05d8 \u05dc\u05e7\u05d5\u05d7 \u05d0\u05de\u05d9\u05ea\u05d9 + \u05e7\u05d9\u05e9\u05d5\u05e8 \u05de\u05d4\u05d9\u05e8 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4.",
  },
  {
    id: "e9",
    time: "08:00",
    body: "\u05e1\u05d8\u05d8\u05d5\u05e1 \u05e2\u05dd \u05ea\u05de\u05d5\u05e0\u05d4 \u05de\u05d4\u05d9\u05d5\u05dd \u2014 \u05db\u05ea\u05d1\u05d5 \u05dc\u05d9 \u05db\u05d0\u05df.",
  },
];

for (const p of patches) {
  if (mock.includes(`id: "${p.id}"`) && mock.match(new RegExp(`id: "${p.id}"[\\s\\S]*?publishTime:`))) {
    console.log(p.id, "skip");
    continue;
  }
  const re = new RegExp(
    `(id: "${p.id}",[\\s\\S]*?type: "post",[\\r\\n]+\\s*network: "[^"]+",)([\\r\\n]+)(\\s*)suggestion:`
  );
  const m = mock.match(re);
  if (!m) {
    console.log(p.id, "NO_MATCH");
    continue;
  }
  mock = mock.replace(
    re,
    `$1$2$3publishTime: "${p.time}",$2$3body: ${JSON.stringify(p.body)},$2$3suggestion:`
  );
  console.log(p.id, "patched");
}

fs.writeFileSync("src/lib/olar/mock-data.ts", mock, "utf8");
console.log("done", /publishTime/.test(mock));
