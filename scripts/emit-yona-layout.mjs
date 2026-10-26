/**
 * Patch YonaView: PostCardPreview + side-by-side lg grid + mobile stack.
 * Leaves Hebrew logic intact; only structural UI changes.
 */
import fs from "fs";

const path = "src/components/olar/views/YonaView.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes('from "@/components/olar/PostCardPreview"')) {
  s = s.replace(
    'import { BrandGlyph } from "../NetworkBrand";',
    `import { BrandGlyph } from "../NetworkBrand";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import {
  buildWaInquiryLink,
} from "@/lib/olar/connections";`
  );
}

// Ensure buildWaInquiryLink is available from connections import that already exists
if (
  s.includes('from "@/lib/olar/connections"') &&
  !s.includes("buildWaInquiryLink")
) {
  s = s.replace(
    `import {
  appendWaCta,
  buildWaOpenMessage,
  hasFullAutomation,
  isPersonalPublish,
  useConnections,
} from "@/lib/olar/connections";`,
    `import {
  appendWaCta,
  buildWaInquiryLink,
  buildWaOpenMessage,
  hasFullAutomation,
  isPersonalPublish,
  useConnections,
} from "@/lib/olar/connections";`
  );
}

// Remove duplicate buildWaInquiryLink import if we added both
const dup = s.match(/import \{\s*buildWaInquiryLink,\s*\} from "@\/lib\/olar\/connections";/);
if (dup && s.includes("buildWaInquiryLink,")) {
  s = s.replace(
    /import \{\s*buildWaInquiryLink,\s*\} from "@\/lib\/olar\/connections";\n?/,
    ""
  );
}

// Remove PhonePreview function
const phoneStart = s.indexOf("function PhonePreview(");
const exportStart = s.indexOf("export function YonaView()");
if (phoneStart >= 0 && exportStart > phoneStart) {
  s = s.slice(0, phoneStart) + s.slice(exportStart);
}

// Inject page + waHref after useConnections
if (!s.includes("useResolvedMyPage()")) {
  s = s.replace(
    `export function YonaView() {
  const { networks } = useConnections();`,
    `export function YonaView() {
  const { networks } = useConnections();
  const { page } = useResolvedMyPage();`
  );
}

// Fix waPhone fallback — no fake 050 for guests
s = s.replace(
  'const waPhone = networks.whatsapp.phone || "050-0000000";',
  'const waPhone = networks.whatsapp.phone || page.whatsapp || "";'
);

// Replace outer return layout shell
const returnMarker = "  return (\n    <div className=\"relative flex h-full min-h-0 w-full flex-col overflow-hidden\" dir=\"rtl\">";
const newShell = `  const waHref = waPhone
    ? buildWaInquiryLink(waPhone, buildWaOpenMessage(C.waOpenMsgTopic, post.headline))
    : null;

  const previewCard = (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-base text-slate-800">
        {C.postCardPreview} | {post.meta.label}
      </p>
      <PostCardPreview
        network={network}
        businessName={page.businessName || C.myBiz}
        post={{
          headline: post.headline,
          body: post.body,
          hashtags: post.hashtags,
          call_to_action: post.call_to_action,
        }}
        imageUrl={imageUrl}
        imageLoading={imageLoading}
        waHref={waHref}
      />
      <button
        type="button"
        disabled={imageLoading}
        onClick={() => void generatePostImage()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white text-base font-medium text-slate-900 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4 text-accent" />
        {imageLoading
          ? C.imageLoading || C.making
          : C.makePostImage || C.imgReady}
      </button>
      <button
        type="button"
        onClick={() => {
          if (fullAuto) publishAuto();
          else if (personal) void publishPersonal();
          else publishFallback();
        }}
        className={\`flex min-h-12 w-full items-center justify-center rounded-2xl text-lg font-medium text-white hover:opacity-90 \${
          fullAuto
            ? "bg-emerald-600"
            : personal
              ? "bg-accent"
              : "bg-slate-900"
        }\`}
      >
        {published
          ? C.readyPublish
          : fullAuto
            ? C.publishAutoNow
            : personal
              ? personalLabel
              : \`\${C.confirmPublish}\${post.meta.label}\`}
      </button>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-hidden" dir="rtl">`;

if (s.includes(returnMarker) && !s.includes("const previewCard")) {
  s = s.replace(returnMarker, newShell);
}

// Replace the grid section — find from header shrink-0 through end of main grid
const gridOldStart = s.indexOf(
  '      <div className="w-full shrink-0 space-y-3 border-b border-slate-300 bg-white pb-4">'
);

if (gridOldStart < 0) {
  console.error("grid header not found");
  fs.writeFileSync(path, s, "utf8");
  process.exit(1);
}

// Find sticky bottom mobile CTA and keep it, rewrite middle
const stickyIdx = s.indexOf(
  '      <div className="safe-bottom sticky bottom-14 z-30 border-t border-slate-300 bg-white/95 py-3 backdrop-blur-md md:hidden">'
);

if (stickyIdx < 0) {
  console.error("sticky not found");
  process.exit(1);
}

const headerAndGrid = `      <div className="grid h-[calc(100vh-80px)] min-h-0 w-full flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-12">
        {/* Workspace — right/center on desktop (cols 7-8), full on mobile */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-7 xl:col-span-8">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-4">
            <div className="w-full space-y-3 border-b border-slate-300 bg-white pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-4 text-sm font-semibold text-accent">
                  {C.humanNotBot}
                </span>
                <h1
                  className="break-words text-2xl font-bold text-slate-950 sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {C.yonaTitle}
                </h1>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNetwork(n.id);
                      setPostOverride(null);
                    }}
                    className={\`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-base font-medium \${
                      network === n.id
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-800"
                    }\`}
                  >
                    <BrandGlyph
                      id={
                        n.id === "reels"
                          ? "instagram"
                          : n.id === "twitter"
                            ? "twitter"
                            : n.id
                      }
                      size={16}
                    />
                    {n.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {AUTOMATION_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={\`min-h-12 shrink-0 rounded-xl px-4 text-base font-medium \${
                      mode === m.id
                        ? "bg-accent text-white"
                        : "border border-slate-300 bg-white text-slate-800"
                    }\`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-2 flex items-center justify-end gap-1.5 text-base font-medium text-slate-800">
                  {C.clickIdea}
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {CONTENT_IDEAS.map((idea) => (
                    <button
                      key={idea.id}
                      type="button"
                      disabled={busy}
                      onClick={() => selectIdea(idea)}
                      className={\`min-h-[5rem] min-w-[12rem] max-w-[15rem] shrink-0 cursor-pointer rounded-2xl border px-4 py-3 text-right shadow-md transition hover:border-sky-600 hover:shadow-lg \${
                        activeIdea?.id === idea.id
                          ? "border-sky-600 ring-2 ring-sky-600 bg-sky-50"
                          : "border-slate-300 bg-white"
                      }\`}
                    >
                      <p className="break-words text-base font-bold text-slate-950">
                        {idea.title}
                      </p>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-slate-800">
                        {idea.blurb}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 py-2" dir="rtl">
`;

// Extract chat messages loop from old file between messages.map and endRef
const msgStart = s.indexOf("{messages.map((msg, i) => (");
const msgEnd = s.indexOf('<div ref={endRef} />');
if (msgStart < 0 || msgEnd < 0) {
  console.error("messages block missing");
  process.exit(1);
}
const messagesBlock = s.slice(msgStart, msgEnd + '<div ref={endRef} />'.length);

// Extract input area from textarea section
const inputStart = s.indexOf(
  '          <div className="shrink-0 border-t border-slate-300 bg-white py-4">'
);
const inputEnd = s.indexOf(
  "        </section>\n\n        <section",
  inputStart
);
if (inputStart < 0) {
  console.error("input area missing");
  process.exit(1);
}
// get until closing of create section - find after fixOpen block
const afterFix = s.indexOf("              )}\n            </div>\n          </div>\n        </section>", inputStart);
let inputBlock;
if (afterFix > 0) {
  inputBlock = s.slice(inputStart, afterFix + "              )}\n            </div>\n          </div>\n".length);
} else {
  // fallback: take until first </section> after inputStart
  const secClose = s.indexOf("</section>", inputStart);
  inputBlock = s.slice(inputStart, secClose);
}

const rest = `
            </div>

            ${inputBlock.replace('          <div className="shrink-0 border-t', '            <div className="sticky bottom-0 shrink-0 border-t')}
          </div>
        </section>

        {/* Sticky live preview — left on desktop; below form on mobile */}
        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain lg:col-span-5 lg:block xl:col-span-4">
          <div className="sticky top-0 p-1">{previewCard}</div>
        </aside>

        {/* Mobile preview below workspace */}
        <div className="border-t border-slate-200 px-1 pb-28 pt-4 lg:hidden">
          {previewCard}
        </div>
      </div>

`;

const stickyAndClose = s.slice(stickyIdx);

// Rebuild: everything before old header + new middle + sticky
const beforeHeader = s.slice(0, gridOldStart);
s = beforeHeader + headerAndGrid + messagesBlock + "\n" + rest + stickyAndClose;

// Fix sticky to use bottom-nav clearance and lg:hidden
s = s.replace(
  'safe-bottom sticky bottom-14 z-30 border-t border-slate-300 bg-white/95 py-3 backdrop-blur-md md:hidden',
  'safe-bottom fixed inset-x-0 bottom-14 z-30 border-t border-slate-300 bg-white/95 px-3 py-3 backdrop-blur-md lg:hidden'
);

fs.writeFileSync(path, s, "utf8");
console.log("YonaView layout patched", {
  hasPostCard: s.includes("PostCardPreview"),
  hasGrid12: s.includes("lg:grid-cols-12"),
  noPhone: !s.includes("function PhonePreview"),
  hasPage: s.includes("useResolvedMyPage"),
});
