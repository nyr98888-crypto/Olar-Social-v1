import fs from "fs";

const path = "src/lib/olar/mock-data.ts";
let m = fs.readFileSync(path, "utf8");
const a = m.indexOf("export const CONNECTED_DEFAULT");
const b = m.indexOf("export function buildAskReviewMessage");
if (a < 0 || b < 0) {
  console.error("markers missing", a, b);
  process.exit(1);
}

const block = `export const CONNECTED_DEFAULT: Record<
  IntegrationId,
  {
    connected: boolean;
    handle: string;
    phone: string;
    kind: "business" | "personal" | null;
    pageUrl: string;
  }
> = {
  google: { connected: false, handle: "", phone: "", kind: "business", pageUrl: "" },
  whatsapp: { connected: false, handle: "", phone: "", kind: "business", pageUrl: "" },
  facebook: { connected: true, handle: "@olar.social", phone: "", kind: "business", pageUrl: "" },
  instagram: { connected: true, handle: "@olar.social", phone: "", kind: "personal", pageUrl: "" },
  easy: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  tiktok: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  twitter: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  telegram: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
  pinterest: { connected: false, handle: "", phone: "", kind: null, pageUrl: "" },
};

`;

m = m.slice(0, a) + block + m.slice(b);
fs.writeFileSync(path, m, "utf8");
console.log("CONNECTED_DEFAULT OK", m.includes("pageUrl: string"));
