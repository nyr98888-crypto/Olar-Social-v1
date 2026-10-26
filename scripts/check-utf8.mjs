import fs from "fs";
import path from "path";

const files = [
  "src/components/olar/views/AnalyticsView.tsx",
  "src/components/olar/views/LeadsView.tsx",
  "src/components/olar/views/ReviewsView.tsx",
  "src/components/olar/views/SettingsView.tsx",
  "src/components/olar/views/StudioView.tsx",
  "src/components/olar/views/CalendarView.tsx",
  "src/components/olar/views/YonaView.tsx",
  "src/components/olar/views/MyPageView.tsx",
  "src/components/olar/views/DashboardView.tsx",
  "src/components/olar/OlarApp.tsx",
  "src/components/olar/RightDock.tsx",
  "src/components/olar/BottomNav.tsx",
  "src/components/olar/Onboarding.tsx",
  "src/lib/olar/ui-copy.ts",
  "src/lib/olar/mock-data.ts",
];

for (const f of files) {
  const buf = fs.readFileSync(f);
  let ok = true;
  try {
    const t = buf.toString("utf8");
    if (t.includes("\uFFFD")) ok = false;
    // detect invalid utf8 by roundtrip
    const again = Buffer.from(t, "utf8");
    if (!again.equals(buf) && buf[0] !== 0xef) {
      // may have BOM or invalid sequences
    }
  } catch {
    ok = false;
  }
  // Manual invalid UTF-8 check
  let i = 0;
  let invalid = false;
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) {
      i++;
      continue;
    }
    let need = 0;
    if ((b & 0xe0) === 0xc0) need = 1;
    else if ((b & 0xf0) === 0xe0) need = 2;
    else if ((b & 0xf8) === 0xf0) need = 3;
    else {
      invalid = true;
      break;
    }
    for (let j = 1; j <= need; j++) {
      if (i + j >= buf.length || (buf[i + j] & 0xc0) !== 0x80) {
        invalid = true;
        break;
      }
    }
    if (invalid) break;
    i += need + 1;
  }
  const t = buf.toString("utf8");
  const he = /[\u0590-\u05FF]/.test(t);
  const q = (t.match(/\?/g) || []).length;
  console.log(
    path.basename(f),
    invalid ? "BAD_UTF8" : "utf8_ok",
    "he=" + he,
    "q=" + q,
    "bytes=" + buf.length
  );
}
