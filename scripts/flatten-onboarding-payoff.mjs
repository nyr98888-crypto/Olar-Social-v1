/** Replace smartphone mock in Onboarding payoff with flat cards. */
import fs from "fs";

const path = "src/components/olar/Onboarding.tsx";
let src = fs.readFileSync(path, "utf8");

const start = src.indexOf("          <div className=\"grid gap-6 lg:grid-cols-2\">");
const end = src.indexOf("          <div className=\"flex flex-col items-center gap-3 pt-2\">");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const replacement = `          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md">
              <p className="text-sm font-semibold text-sky-600">
                {C.bioPreviewTitle}
              </p>
              <p dir="ltr" className="mt-1 text-xs text-slate-500">
                olar.me/{page.slug}
              </p>
              <p className="mt-3 text-2xl font-black text-slate-950">
                {page.businessName}
              </p>
              {page.city ? (
                <p className="mt-1 text-sm text-slate-700">{page.city}</p>
              ) : null}
              <p className="mt-2 text-sm text-slate-800">{page.tagline}</p>
              <ul className="mt-4 space-y-2">
                {page.services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-sky-700">
                      {s.price > 0
                        ? \`\${C.fromPrice}\${s.price} \${C.currencyIls}\`
                        : C.freeConsult}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={\`https://wa.me/\${waDigits}\`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {C.bioWaBtn}
                </a>
                <a
                  href={\`tel:\${page.phone}\`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-900"
                >
                  <Phone className="h-5 w-5 text-sky-600" />
                  {C.callAction}
                </a>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md">
              <p className="text-sm font-semibold text-sky-600">
                {C.firstPostReady}
              </p>
              <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 via-sky-50 to-slate-100 text-sky-700">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3
                className="mt-4 text-2xl font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {page.firstPost.headline}
              </h3>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-800">
                {page.firstPost.body}
              </p>
              <p className="mt-3 text-sm text-sky-700">
                {page.firstPost.hashtags.join(" ")}
              </p>
              <button
                type="button"
                onClick={sendPostToSelf}
                className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
              >
                <MessageCircle className="h-5 w-5" />
                {C.sendPostSelfWa}
              </button>
            </article>
          </div>

`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(path, src, "utf8");
console.log("flatten payoff OK", !src.includes("border-slate-900 bg-slate-900"));
