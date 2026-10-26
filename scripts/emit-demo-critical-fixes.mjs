/**
 * Demo-critical UTF-8 patches — never run Hebrew via PowerShell.
 * Updates ui-copy keys + zeros niche/MY_PAGE prices.
 */
import fs from "fs";

const J = (s) => JSON.stringify(s);

/* ---- 1) ui-copy extras ---- */
const copyPath = "src/lib/olar/ui-copy.ts";
let copy = fs.readFileSync(copyPath, "utf8");

const extras = {
  quoteWaCta: "לתיאום והצעת מחיר בוואטסאפ",
  comingSoon: "בקרוב",
  navStudioShort: "סטודיו",
  navCampaigns: "פוסטים וקמפיינים",
  navAgentSmart: "הסוכן החכם",
  navBioPage: "הדף שלך באינטרנט",
  tabCampaign: "יצירת קמפיין שלם",
  makeCampaign: "יצירת קמפיין שלם",
  campaignReady: "שלושה פוסטים מוכנים — העתיקו ופרסמו.",
  campaignHint: "ספרו מה לקדם — נייצר 3 פוסטים מלאים לקמפיין.",
  phCampaign:
    "לדוגמה: מוסך דוד בהרצליה — הכנת רכב לחורף, בלמים ומגבים, תכתבו בוואטסאפ...",
  copyPost: "העתק פוסט",
  postCopied: "הפוסט הועתק",
  campaignPostN: "פוסט",
  makePostImage: "יצירת תמונה לפוסט",
  imageLoading: "מייצרת תמונה...",
  studioSubDemo:
    "תמונת תדמית, באנר, לוגו, או קמפיין מלא — בחרו מה צריך.",
};

for (const [k, v] of Object.entries(extras)) {
  if (new RegExp(`\\b${k}\\s*:`).test(copy)) continue;
  copy = copy.replace(/\n\} as const;\s*$/, `\n  ${k}: ${J(v)},\n} as const;\n`);
}

copy = copy.replace(
  /servicesTitle:\s*"[^"]*"/,
  `servicesTitle: ${J("השירותים שלנו")}`
);
copy = copy.replace(
  /studioSub:\s*"[^"]*"/,
  `studioSub: ${J(extras.studioSubDemo)}`
);

fs.writeFileSync(copyPath, copy, "utf8");
console.log(
  "ui-copy",
  /[\u0590-\u05FF]/.test(fs.readFileSync(copyPath, "utf8"))
    ? "HEBREW_OK"
    : "FAIL"
);

/* ---- 2) zero prices in business-profile NICHES ---- */
const bpPath = "src/lib/olar/business-profile.ts";
let bp = fs.readFileSync(bpPath, "utf8");
bp = bp.replace(/"price":\s*\d+/g, '"price": 0');
fs.writeFileSync(bpPath, bp, "utf8");
console.log("business-profile prices", (bp.match(/"price": 0/g) || []).length);

/* ---- 3) zero MY_PAGE service prices ---- */
const mockPath = "src/lib/olar/mock-data.ts";
let mock = fs.readFileSync(mockPath, "utf8");
mock = mock.replace(
  /(export const MY_PAGE[\s\S]*?services:\s*\[[\s\S]*?\],\s*gallery:)/,
  (block) => block.replace(/price:\s*\d+/g, "price: 0")
);
fs.writeFileSync(mockPath, mock, "utf8");
const myPrices = mock.match(/export const MY_PAGE[\s\S]*?gallery:/)?.[0] || "";
console.log(
  "MY_PAGE prices",
  (myPrices.match(/price:\s*0/g) || []).length,
  "nonzero",
  (myPrices.match(/price:\s*[1-9]/g) || []).length
);
