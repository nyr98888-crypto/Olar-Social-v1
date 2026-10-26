import fs from "fs";

const path = "src/lib/olar/mock-data.ts";
let m = fs.readFileSync(path, "utf8");

if (m.includes("maxChars: 300")) {
  console.log("already has google platform");
  process.exit(0);
}

const marker = `  reels: {
    label: "\u05e8\u05d9\u05dc\u05e1",
    maxChars: 160,
    hook: "3 \u05e9\u05e0\u05d9\u05d5\u05ea \u05e8\u05d0\u05e9\u05d5\u05e0\u05d5\u05ea \u05e2\u05dd \u05ea\u05e0\u05d5\u05e2\u05d4",
    hashtags: ["#\u05e8\u05d9\u05dc\u05e1", "#\u05d5\u05d9\u05d3\u05d0\u05d5\u05e7\u05e6\u05e8"],
    contact: "\u05d4\u05d7\u05dc\u05e7\u05d4 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  },
};`;

const insert = `  reels: {
    label: "\u05e8\u05d9\u05dc\u05e1",
    maxChars: 160,
    hook: "3 \u05e9\u05e0\u05d9\u05d5\u05ea \u05e8\u05d0\u05e9\u05d5\u05e0\u05d5\u05ea \u05e2\u05dd \u05ea\u05e0\u05d5\u05e2\u05d4",
    hashtags: ["#\u05e8\u05d9\u05dc\u05e1", "#\u05d5\u05d9\u05d3\u05d0\u05d5\u05e7\u05e6\u05e8"],
    contact: "\u05d4\u05d7\u05dc\u05e7\u05d4 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  },
  google: {
    label: "\u05d2\u05d5\u05d2\u05dc \u05e2\u05e1\u05e7\u05d9\u05dd",
    maxChars: 300,
    hook: "\u05de\u05d1\u05e6\u05e2 \u05de\u05e7\u05d5\u05de\u05d9 \u05e7\u05e6\u05e8",
    hashtags: ["#\u05e2\u05e1\u05e7\u05de\u05e7\u05d5\u05de\u05d9"],
    contact: "\u05d4\u05ea\u05e7\u05e9\u05e8\u05d5 \u05d0\u05d5 \u05e9\u05dc\u05d7\u05d5 \u05d4\u05d5\u05d3\u05e2\u05d4",
  },
};`;

if (!m.includes(marker)) {
  // CRLF variant - splice by index near reels contact
  const idx = m.indexOf("contact: \"\u05d4\u05d7\u05dc\u05e7\u05d4 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4\"");
  if (idx < 0) {
    console.error("reels contact not found");
    process.exit(1);
  }
  const close = m.indexOf("};", idx);
  const googleBlock = `,
  google: {
    label: "\u05d2\u05d5\u05d2\u05dc \u05e2\u05e1\u05e7\u05d9\u05dd",
    maxChars: 300,
    hook: "\u05de\u05d1\u05e6\u05e2 \u05de\u05e7\u05d5\u05de\u05d9 \u05e7\u05e6\u05e8",
    hashtags: ["#\u05e2\u05e1\u05e7\u05de\u05e7\u05d5\u05de\u05d9"],
    contact: "\u05d4\u05ea\u05e7\u05e9\u05e8\u05d5 \u05d0\u05d5 \u05e9\u05dc\u05d7\u05d5 \u05d4\u05d5\u05d3\u05e2\u05d4",
  }
`;
  // find the `},` before `};` of PLATFORM_COPY
  const endBlock = m.lastIndexOf("},", close);
  m = m.slice(0, endBlock + 2) + googleBlock + m.slice(endBlock + 2);
} else {
  m = m.replace(marker, insert);
}

fs.writeFileSync(path, m, "utf8");
console.log("PLATFORM google", m.includes("maxChars: 300"));
