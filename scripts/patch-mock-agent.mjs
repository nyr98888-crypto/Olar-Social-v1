/**
 * Patch mock-data + layout for agent rename, Pinterest analytics, calendar times.
 */
import fs from "fs";

const J = (s) => JSON.stringify(s);

/* ---- mock-data ---- */
let mock = fs.readFileSync("src/lib/olar/mock-data.ts", "utf8");

const mockReplacements = [
  ["תנו ליונה לכתוב פוסט", "תנו לסוכן שיווק AI לכתוב פוסט"],
  [
    "היי, אני יונה. אין לך רעיון לפוסט? לחצו על אחת ההצעות למטה — או פשוט כתבו לי במילים שלכם מה קורה בעסק.",
    "היי, אני סוכן שיווק AI. אין לך רעיון לפוסט? לחצו על אחת ההצעות למטה — או פשוט כתבו לי במילים שלכם מה קורה בעסק.",
  ],
  ["יונה מציעה — אתם לוחצים אישור", "סוכן שיווק AI מציע — אתם לוחצים אישור"],
  ["יונה מפרסמת לבד לפי לוח", "סוכן שיווק AI מפרסם לבד לפי לוח"],
];

for (const [a, b] of mockReplacements) {
  if (!mock.includes(a)) console.log("mock MISS:", a.slice(0, 40));
  else mock = mock.split(a).join(b);
}

if (!mock.includes('"pinterest"') || !mock.includes("ANALYTICS_NETWORKS")) {
  console.log("analytics block unexpected");
} else {
  mock = mock.replace(
    /export const ANALYTICS_NETWORKS: IntegrationId\[\] = \[[\s\S]*?\];/,
    `export const ANALYTICS_NETWORKS: IntegrationId[] = [
  "google",
  "whatsapp",
  "facebook",
  "instagram",
  "pinterest",
  "easy",
];`
  );
}

// Add publishTime to calendar posts if missing
if (!mock.includes("publishTime")) {
  mock = mock.replace(
    /title: "פוסט מבצע לחורף",\n    date: "2026-10-27",\n    type: "post",\n    network: "אינסטגרם",\n    suggestion:/,
    `title: "פוסט מבצע לחורף",\n    date: "2026-10-27",\n    type: "post",\n    network: "אינסטגרם",\n    publishTime: "09:30",\n    body: ${J("החורף כבר פה — בדקו מצבר ומגבים אצלנו. כתבו בוואטסאפ לתיאום.")},\n    suggestion:`
  );
  mock = mock.replace(
    /title: "סרטון קצר מאחורי הקלעים",\n    date: "2026-10-28",\n    type: "post",\n    network: "רילס",\n    suggestion:/,
    `title: "סרטון קצר מאחורי הקלעים",\n    date: "2026-10-28",\n    type: "post",\n    network: "רילס",\n    publishTime: "18:00",\n    body: ${J("15 שניות מהשטח — בלי מוזיקה רועשת. תייגו אותנו כשאתם מגיעים.")},\n    suggestion:`
  );
  mock = mock.replace(
    /title: "סטורי שאלות מהלקוחות",\n    date: "2026-10-30",\n    type: "post",\n    network: "אינסטגרם",\n    suggestion:/,
    `title: "סטורי שאלות מהלקוחות",\n    date: "2026-10-30",\n    type: "post",\n    network: "אינסטגרם",\n    publishTime: "12:00",\n    body: ${J("שאלה אחת לקהל היום — ונענה מחר בפוסט.")},\n    suggestion:`
  );
  mock = mock.replace(
    /title: "פוסט המלצות בפייסבוק",\n    date: "2026-11-02",\n    type: "post",\n    network: "פייסבוק",\n    suggestion:/,
    `title: "פוסט המלצות בפייסבוק",\n    date: "2026-11-02",\n    type: "post",\n    network: "פייסבוק",\n    publishTime: "10:15",\n    body: ${J("ציטוט לקוח אמיתי + קישור מהיר לוואטסאפ.")},\n    suggestion:`
  );
  mock = mock.replace(
    /title: "סטטוס בוואטסאפ",\n    date: "2026-10-29",\n    type: "post",\n    network: "וואטסאפ",\n    suggestion:/,
    `title: "סטטוס בוואטסאפ",\n    date: "2026-10-29",\n    type: "post",\n    network: "וואטסאפ",\n    publishTime: "08:00",\n    body: ${J("סטטוס עם תמונה מהיום — כתבו לי כאן.")},\n    suggestion:`
  );
}

fs.writeFileSync("src/lib/olar/mock-data.ts", mock, "utf8");

/* ---- types: publishTime + body on CalendarEvent ---- */
let types = fs.readFileSync("src/lib/olar/types.ts", "utf8");
if (!types.includes("publishTime")) {
  types = types.replace(
    `network?: string;
  suggestion?: string;
}`,
    `network?: string;
  publishTime?: string;
  body?: string;
  suggestion?: string;
}`
  );
  fs.writeFileSync("src/lib/olar/types.ts", types, "utf8");
}

/* ---- layout description ---- */
let layout = fs.readFileSync("src/app/layout.tsx", "utf8");
const title = "אולר סושיאל — Olar Social";
const desc =
  "אולר סושיאל — סוכן שיווק AI, סטודיו, יומן, לידים ואנליטיקה במקום אחד · olar.me";
layout = layout
  .replace(/title:\s*"[^"]*"/, `title: ${J(title)}`)
  .replace(/description:\s*"[^"]*"/, `description: ${J(desc)}`);
fs.writeFileSync("src/app/layout.tsx", layout, "utf8");

console.log(
  "patch-mock-agent",
  mock.includes("סוכן שיווק AI") ? "HE_OK" : "FAIL",
  mock.includes('"pinterest"') && mock.includes("ANALYTICS_NETWORKS") ? "PIN_OK" : "PIN?"
);
