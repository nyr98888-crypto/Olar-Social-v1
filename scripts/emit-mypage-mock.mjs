import fs from "fs";

/** Append MY_PAGE mock block to mock-data.ts using unicode escapes (ASCII-safe). */
const path = "src/lib/olar/mock-data.ts";
let src = fs.readFileSync(path, "utf8");

if (src.includes("export const MY_PAGE")) {
  console.log("MY_PAGE already present");
  process.exit(0);
}

const block = `
export const MY_PAGE = {
  slug: "moti-garage",
  url: "olar.me/moti-garage",
  live: true,
  businessName: ${JSON.stringify("\u05de\u05d5\u05d8\u05d9 \u05de\u05d5\u05e1\u05da")},
  tagline: ${JSON.stringify("\u05ea\u05d9\u05e7\u05d5\u05e0\u05d9 \u05e8\u05db\u05d1 \u05d1\u05d0\u05d4\u05d1\u05d4 \u2014 \u05d1\u05dc\u05d9 \u05d4\u05e4\u05ea\u05e2\u05d5\u05ea")},
  description: ${JSON.stringify("\u05de\u05d5\u05e1\u05da \u05e9\u05db\u05d5\u05e0\u05ea\u05d9 \u05e2\u05dd \u05e9\u05d9\u05e8\u05d5\u05ea \u05de\u05d4\u05d9\u05e8, \u05de\u05d7\u05d9\u05e8\u05d9\u05dd \u05d4\u05d5\u05d2\u05e0\u05d9\u05dd, \u05d5\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4.")},
  address: ${JSON.stringify("\u05e8\u05d7\u05d5\u05d1 \u05d4\u05ea\u05e2\u05e9\u05d9\u05d9\u05d4 12, \u05e8\u05d0\u05e9\u05d5\u05df \u05dc\u05e6\u05d9\u05d5\u05df")},
  phone: "050-0000000",
  whatsapp: "0500000000",
  mapsUrl: "https://maps.google.com/?q=Rosh+HaAyin",
  wazeUrl: "https://waze.com/ul?q=Rosh%20HaAyin",
  rating: 4.9,
  weekVisits: 186,
  services: [
    {
      id: "s1",
      title: ${JSON.stringify("\u05d1\u05d3\u05d9\u05e7\u05ea \u05d7\u05d5\u05e8\u05e3")},
      desc: ${JSON.stringify("\u05de\u05e6\u05d1\u05e8, \u05de\u05d2\u05d1\u05d9\u05dd \u05d5\u05e9\u05de\u05df \u2014 \u05e2\u05d3 45 \u05d3\u05e7\u05d5\u05ea")},
      price: 280,
    },
    {
      id: "s2",
      title: ${JSON.stringify("\u05d4\u05d7\u05dc\u05e4\u05ea \u05e9\u05de\u05df")},
      desc: ${JSON.stringify("\u05e9\u05de\u05df + \u05de\u05e1\u05e0\u05df + \u05d1\u05d3\u05d9\u05e7\u05d4 \u05db\u05dc\u05dc\u05d9\u05ea")},
      price: 350,
    },
    {
      id: "s3",
      title: ${JSON.stringify("\u05d0\u05d1\u05d7\u05d5\u05df \u05e7\u05d3\u05dd")},
      desc: ${JSON.stringify("\u05d1\u05dc\u05de\u05d9\u05dd + \u05d3\u05d9\u05e1\u05e7\u05d9\u05dd \u2014 \u05ea\u05d0\u05d5\u05dd \u05de\u05d4\u05d9\u05e8")},
      price: 450,
    },
  ],
  gallery: [
    { id: "g1", label: ${JSON.stringify("\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d1\u05e9\u05d8\u05d7")}, tone: "from-slate-300 to-slate-500" },
    { id: "g2", label: ${JSON.stringify("\u05e8\u05db\u05d1 \u05de\u05d5\u05db\u05df")}, tone: "from-amber-200 to-orange-400" },
    { id: "g3", label: ${JSON.stringify("\u05e6\u05d5\u05d5\u05ea \u05d4\u05e6\u05dc\u05d7\u05d4")}, tone: "from-sky-200 to-blue-500" },
    { id: "g4", label: ${JSON.stringify("\u05dc\u05e7\u05d5\u05d7 \u05de\u05e8\u05d5\u05e6\u05d4")}, tone: "from-emerald-200 to-teal-500" },
  ],
} as const;
`;

// Ensure IntegrationId-related lists stay consistent when we patch types separately.
src = src.replace(
  /export function reviewReplySuggestion\([\s\S]*$/,
  block.trim() + "\n\n" + src.match(/export function reviewReplySuggestion\([\s\S]*$/)[0]
);

fs.writeFileSync(path, src, "utf8");
const t = fs.readFileSync(path, "utf8");
console.log(
  "mock-data MY_PAGE",
  t.includes("MY_PAGE") && /[\u0590-\u05FF]/.test(t) ? "HEBREW_OK" : "FAIL"
);
