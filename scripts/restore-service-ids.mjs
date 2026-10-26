/** Ensure every niche service has id s1/s2/s3. */
import fs from "fs";

const path = "src/lib/olar/business-profile.ts";
let s = fs.readFileSync(path, "utf8");

// Within NICHES JSON, add missing service ids by walking services arrays naively
s = s.replace(
  /"services": \[([\s\S]*?)\]/g,
  (full, inner) => {
    let i = 0;
    const next = inner.replace(/\{\n(\s*)"title":/g, () => {
      i += 1;
      return `{\n        "id": "s${i}",\n        "title":`;
    });
    return `"services": [${next}]`;
  }
);

fs.writeFileSync(path, s, "utf8");
console.log("service ids", (s.match(/"id": "s\d+"/g) || []).length);
