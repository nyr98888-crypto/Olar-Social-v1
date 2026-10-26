/**
 * Patch emit-ui-copy.mjs — agent rename + daily/calendar strings.
 * Run: node scripts/patch-ux-copy.mjs && node scripts/emit-ui-copy.mjs
 */
import fs from "fs";

let emit = fs.readFileSync("scripts/emit-ui-copy.mjs", "utf8");

const replacements = [
  [
    "בחרו משהו פשוט — יונה תכתוב, תציע תמונה, ותזכיר מתי לפרסם.",
    "בחרו משהו פשוט — סוכן שיווק AI יכתוב, יציע תמונה, ויזכיר מתי לפרסם.",
  ],
  ["לכל ההצעות אצל יונה", "לכל ההצעות אצל סוכן שיווק AI"],
  ["לחצו — יונה תכין פוסט מוכן", "לחצו — סוכן שיווק AI יכין פוסט מוכן"],
  [
    "כבר 5 ימים בלי פוסט — שווה ללחוץ על יונה ולבחור רעיון מוכן.",
    "כבר 5 ימים בלי פוסט — שווה לפתוח את סוכן שיווק AI ולבחור רעיון מוכן.",
  ],
  ["תשובה מיונה", "תשובה מסוכן שיווק AI"],
  ["אין משימות — יונה יכולה להציע פוסט", "אין משימות — סוכן שיווק AI יכול להציע פוסט"],
  ["יונה — תכתוב לי פוסט", "סוכן שיווק AI — תכתוב לי פוסט"],
  ["יונה כותבת...", "סוכן שיווק AI כותב..."],
  ['["navYonaShort", "יונה"]', '["navYonaShort", "סוכן AI"]'],
  ["הקליטו 10 שניות על העסק", "הקלט רעיון בקולך"],
  ["הקלט רעיון ב-10 שניות", "הקלט רעיון בקולך"],
  [
    "בוא נראה איך העסק שלך נראה ברשת עכשיו. הקלד שם ועיר, ויונה AI תכין לך דף עסקי ופוסט ראשון ברגע.",
    "בוא נראה איך העסק שלך נראה ברשת עכשיו. הקלד שם ועיר, וסוכן שיווק AI יכין לך דף עסקי ופוסט ראשון ברגע.",
  ],
  ["יונה AI בעבודה", "סוכן שיווק AI בעבודה"],
  ["פרסם עם יונה", "פרסם עם סוכן שיווק AI"],
];

for (const [a, b] of replacements) {
  if (!emit.includes(a)) console.log("MISS:", a.slice(0, 48));
  else emit = emit.split(a).join(b);
}

const extraRows = [
  ["dailyUpdateTitle", "עדכון יומי מהסוכן"],
  [
    "dailyUpdateBody",
    "בוקר טוב! 2 פניות ממתינות בוואטסאפ, ופוסט המבצע היומי מוכן להפצה.",
  ],
  ["dailyFreqLabel", "תדירות עדכונים"],
  ["dailyFreqOnce", "פעם ביום (בוקר)"],
  ["dailyFreqTwice", "פעמיים ביום (בוקר וערב)"],
  ["dailyFreqRealtime", "עדכונים בזמן אמת בכל פנייה חדשה"],
  ["calPostModalTitle", "פרטי הפרסום"],
  ["calPublishTime", "שעת פרסום"],
  ["calTargetNetwork", "רשת יעד"],
  ["calPostContent", "תוכן הפוסט"],
  ["calNoPostDay", "אין פוסט מתוזמן ליום זה"],
  ["openSettingsAria", "הגדרות"],
  ["bioPreviewTitle", "תצוגת דף הביו"],
];

if (!emit.includes("dailyUpdateTitle")) {
  const block = extraRows.map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`).join("\n");
  emit = emit.replace(/\n\];\n\nconst body =/, `\n${block}\n];\n\nconst body =`);
}

fs.writeFileSync("scripts/emit-ui-copy.mjs", emit, "utf8");
console.log("patch-ux-copy OK");
