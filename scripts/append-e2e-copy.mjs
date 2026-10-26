/**
 * Append E2E / Quick View / Post Card Hebrew keys to emit-ui-copy.mjs then regenerate.
 * Encoding-safe: Node UTF-8 only — never PowerShell.
 */
import fs from "fs";

const EXTRA = [
  ["waSendMessage", "שלח הודעה בוואטסאפ"],
  ["postCardPreview", "תצוגת פוסט"],
  ["guestWelcomeTitle", "ברוכים הבאים ל-One Loop Social! צור את הפוסט או הקמפיין הראשון שלך"],
  ["guestWelcomeCta", "ליצירת פוסט ראשון"],
  ["connectShort", "התחבר"],
  ["googleBizTitle", "Google Business Profile"],
  ["descEasy", "סנכרון כרטיס העסק, ביקורות ושעות פתיחה מאיזי"],
  ["descGoogleBiz", "סנכרון כרטיס העסק בגוגל, ביקורות ועדכונים"],
  ["platformFacebook", "Facebook"],
  ["platformInstagram", "Instagram"],
  ["platformGoogle", "Google Business"],
  ["quickReadyTitle", "מוכן לפרסום היום"],
  ["quickReadySub", "פוסט אחד מוכן — העתיקו או שתפו בוואטסאפ."],
  ["quickCopyContentImage", "העתק תוכן ותמונה"],
  ["quickShareWaStatus", "שתף ישירות לוואטסאפ / לסטטוס"],
  ["quickChipPost30", "⚡ יצירת פוסט ב-30 שניות"],
  ["quickChipOffer", "🏷️ עדכון מבצע קיים"],
  ["quickChipCopyLink", "🔗 העתקת הקישור לדף שלי"],
  ["quickPulseTitle", "דופק אמיתי"],
  ["quickPulseVisits", "ביקורים בדף השבוע"],
  ["quickPulseWa", "לחיצות וואטסאפ"],
  ["quickPulseGuestHint", "פרסם את הדף שלך כדי להתחיל לקבל פניות"],
  ["quickGuestZero", "0"],
  ["linkCopiedShort", "הקישור הועתק"],
  ["campaignNetTag", "רשת"],
];

const emitPath = "scripts/emit-ui-copy.mjs";
let src = fs.readFileSync(emitPath, "utf8");

// Update existing keys in-place where they already exist
const updates = Object.fromEntries(EXTRA);
for (const [k, v] of Object.entries(updates)) {
  const re = new RegExp(`\\["${k}",\\s*"[^"]*"\\]`);
  if (re.test(src)) {
    src = src.replace(re, `["${k}", ${JSON.stringify(v)}]`);
  }
}

// Append brand-new keys before the closing `];` of rows
const newOnly = EXTRA.filter(([k]) => {
  return !new RegExp(`\\["${k}",`).test(src);
});

if (newOnly.length) {
  const insert = newOnly
    .map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`)
    .join("\n");
  const marker = `\n  ["imageLoading", "מייצרת תמונה..."],\n];`;
  if (!src.includes(marker)) {
    // fallback: find last row before ];
    const idx = src.lastIndexOf("\n];");
    if (idx < 0) {
      console.error("Cannot find rows end");
      process.exit(1);
    }
    src = src.slice(0, idx) + ",\n" + insert + src.slice(idx);
  } else {
    src = src.replace(
      marker,
      `\n  ["imageLoading", "מייצרת תמונה..."],\n${insert}\n];`
    );
  }
}

fs.writeFileSync(emitPath, src, "utf8");
console.log("emit-ui-copy patched, new keys:", newOnly.map((x) => x[0]).join(", ") || "(updates only)");
