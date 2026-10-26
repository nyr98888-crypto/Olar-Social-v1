/**
 * Remove only top-level niche "id" keys (not ProfileService.id).
 * Safer: re-emit from emit-value-onboarding.mjs which no longer emits niche ids.
 */
import fs from "fs";

const path = "src/lib/olar/business-profile.ts";
let s = fs.readFileSync(path, "utf8");

// Niche blocks look like: "garage": { "id": "garage", "tagline":
s = s.replace(/("(?:garage|cosmetics|cafe|general)": \{\n\s*)"id": "[^"]+",\n(\s*)/g, "$1");

fs.writeFileSync(path, s, "utf8");
const hasServiceId = /"id": "s1"/.test(s);
const hasNicheId = /"garage": \{\n\s*"id":/.test(s);
console.log("serviceIds", hasServiceId, "nicheIdsGone", !hasNicheId);
