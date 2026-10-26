import fs from "fs";
import path from "path";

const root = path.resolve("src/components/olar/views");

/** Hebrew helpers via code points — keeps this .mjs file ASCII-safe */
const H = {
  homeTitle: "\u05d4\u05e2\u05e1\u05e7 \u05e9\u05dc\u05d9 \u05d4\u05d9\u05d5\u05dd",
  hello: "\u05e9\u05dc\u05d5\u05dd",
  whatToday: "\u05de\u05d4 \u05e0\u05e2\u05e9\u05d4 \u05d4\u05d9\u05d5\u05dd?",
  pickSimple:
    "\u05d1\u05d7\u05e8\u05d5 \u05de\u05e9\u05d4\u05d5 \u05e4\u05e9\u05d5\u05d8 \u2014 \u05d9\u05d5\u05e0\u05d4 \u05ea\u05db\u05ea\u05d5\u05d1, \u05ea\u05e6\u05d9\u05e2 \u05ea\u05de\u05d5\u05e0\u05d4, \u05d5\u05ea\u05d6\u05db\u05d9\u05e8 \u05de\u05ea\u05d9 \u05dc\u05e4\u05e8\u05e1\u05dd.",
  allIdeas: "\u05dc\u05db\u05dc \u05d4\u05d4\u05e6\u05e2\u05d5\u05ea \u05d0\u05e6\u05dc \u05d9\u05d5\u05e0\u05d4",
  nothingToday:
    "\u05d0\u05d9\u05df \u05dc\u05d9 \u05de\u05d4 \u05dc\u05e4\u05e8\u05e1\u05dd \u05d4\u05d9\u05d5\u05dd",
  clickReady:
    "\u05dc\u05d7\u05e6\u05d5 \u2014 \u05d9\u05d5\u05e0\u05d4 \u05ea\u05db\u05d9\u05df \u05e4\u05d5\u05e1\u05d8 \u05de\u05d5\u05db\u05df",
  postsWeek: "\u05db\u05de\u05d4 \u05e4\u05e8\u05e1\u05de\u05e0\u05d5 \u05d4\u05e9\u05d1\u05d5\u05e2",
  whenPublish: "\u05de\u05d4 \u05de\u05e4\u05e8\u05e1\u05de\u05d9\u05dd \u05d5\u05de\u05ea\u05d9",
  fiveDays:
    "\u05db\u05d1\u05e8 5 \u05d9\u05de\u05d9\u05dd \u05d1\u05dc\u05d9 \u05e4\u05d5\u05e1\u05d8 \u2014 \u05e9\u05d5\u05d5\u05d4 \u05dc\u05dc\u05d7\u05d5\u05e5 \u05e2\u05dc \u05d9\u05d5\u05e0\u05d4 \u05d5\u05dc\u05d1\u05d7\u05d5\u05e8 \u05e8\u05e2\u05d9\u05d5\u05df \u05de\u05d5\u05db\u05df.",
  people: "\u05d0\u05e0\u05e9\u05d9\u05dd \u05e9\u05e4\u05e0\u05d5 \u05d0\u05dc\u05d9\u05d9",
  peopleSub:
    "\u05de\u05d9 \u05db\u05ea\u05d1, \u05de\u05d0\u05d9\u05e4\u05d4, \u05d5\u05de\u05d4 \u05db\u05d3\u05d0\u05d9 \u05dc\u05e2\u05e0\u05d5\u05ea \u2014 \u05d1\u05dc\u05d9 \u05e1\u05d9\u05d1\u05d5\u05db\u05d9\u05dd.",
  colNew: "\u05e4\u05e0\u05d5 \u05e2\u05db\u05e9\u05d9\u05d5 (\u05de\u05d7\u05db\u05d9\u05dd \u05dc\u05ea\u05e9\u05d5\u05d1\u05d4)",
  colActive: "\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc (\u05d3\u05d9\u05d1\u05e8\u05ea\u05d9 \u05d0\u05d9\u05ea\u05dd)",
  colClosed: "\u05e7\u05d1\u05e2\u05d5 \u05ea\u05d5\u05e8 / \u05d4\u05d2\u05d9\u05e2\u05d5 \u05dc\u05e2\u05e1\u05e7",
  whatReply: "\u05de\u05d4 \u05dc\u05e2\u05e0\u05d5\u05ea \u05dc\u05d5?",
  callNow: "\u05d7\u05d9\u05d9\u05d2 \u05e2\u05db\u05e9\u05d9\u05d5",
  all: "\u05d4\u05db\u05dc",
  replyBook: "\u05ea\u05d9\u05d0\u05d5\u05dd \u05ea\u05d5\u05e8 \u05de\u05d4\u05d9\u05e8",
  replyPrice: "\u05e4\u05d9\u05e8\u05d5\u05d8 \u05de\u05d7\u05d9\u05e8 \u05e7\u05e6\u05e8",
  replyAsk: "\u05dc\u05e9\u05d0\u05d5\u05dc \u05e2\u05d5\u05d3 \u05e4\u05e8\u05d8\u05d9\u05dd",
  replyTo: "\u05de\u05d4 \u05dc\u05e2\u05e0\u05d5\u05ea \u05dc",
  pickTemplate:
    "\u05d1\u05d7\u05e8\u05d5 \u05ea\u05d1\u05e0\u05d9\u05ea \u2014 \u05d4\u05e2\u05ea\u05d9\u05e7\u05d5 \u05d1\u05dc\u05d7\u05d9\u05e6\u05d4 \u05d5\u05e9\u05dc\u05d7\u05d5 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4.",
  copyReply: "\u05d4\u05e2\u05ea\u05e7 \u05ea\u05e9\u05d5\u05d1\u05d4",
  copied: "\u05d4\u05d5\u05e2\u05ea\u05e7",
  whatWorked: "\u05de\u05d4 \u05e2\u05d1\u05d3 \u05d4\u05e9\u05d1\u05d5\u05e2?",
  whatWorkedSub:
    "\u05d1\u05d7\u05e8\u05d5 \u05e8\u05e9\u05ea \u2014 \u05ea\u05e8\u05d0\u05d5 \u05de\u05d9 \u05e8\u05d0\u05d4, \u05de\u05d9 \u05d4\u05ea\u05e7\u05e9\u05e8, \u05d5\u05de\u05d9 \u05db\u05ea\u05d1 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4.",
  simpleSummary: "\u05e1\u05d9\u05db\u05d5\u05dd \u05e4\u05e9\u05d5\u05d8",
  saw: "\u05db\u05de\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05e8\u05d0\u05d5 \u05d0\u05ea \u05d6\u05d4",
  called: "\u05db\u05de\u05d4 \u05d4\u05ea\u05e7\u05e9\u05e8\u05d5 \u05d0\u05dc\u05d9\u05d9",
  waMsg: "\u05db\u05de\u05d4 \u05e9\u05dc\u05d7\u05d5 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  maps: "\u05db\u05de\u05d4 \u05d7\u05d9\u05e4\u05e9\u05d5 \u05d4\u05d2\u05e2\u05d4 \u05d1\u05d5\u05d9\u05d9\u05d6 / \u05d2\u05d5\u05d2\u05dc",
  util: "\u05db\u05de\u05d4 \u05e0\u05d9\u05e6\u05dc\u05ea\u05dd \u05de\u05d4\u05e4\u05d5\u05d8\u05e0\u05e6\u05d9\u05d0\u05dc \u05d4\u05d7\u05d5\u05d3\u05e9\u05d9",
  postsOf: "\u05e4\u05d5\u05e1\u05d8\u05d9\u05dd \u05de\u05ea\u05d5\u05da",
  couldPublish: "\u05e9\u05d0\u05e4\u05e9\u05e8 \u05d4\u05d9\u05d4 \u05dc\u05e4\u05e8\u05e1\u05dd",
  strongest: "\u05d4\u05e4\u05d5\u05e1\u05d8 \u05d4\u05db\u05d9 \u05d7\u05d6\u05e7",
  weakest: "\u05d4\u05e4\u05d5\u05e1\u05d8 \u05d4\u05db\u05d9 \u05d7\u05dc\u05e9",
  sawEng: "\u05e8\u05d0\u05d5",
  reacted: "\u05d4\u05d2\u05d9\u05d1\u05d5",
  reviewsTitle: "\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea \u05d1\u05d2\u05d5\u05d2\u05dc \u05d5\u05d1\u05d0\u05d9\u05d6\u05d9",
  reviewsSub:
    "\u05db\u05de\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05de\u05de\u05dc\u05d9\u05e6\u05d9\u05dd \u05e2\u05dc\u05d9\u05db\u05dd \u2014 \u05d5\u05de\u05d4 \u05db\u05d3\u05d0\u05d9 \u05dc\u05e2\u05e0\u05d5\u05ea.",
  avgScore: "\u05e6\u05d9\u05d5\u05df \u05de\u05de\u05d5\u05e6\u05e2",
  outOf: "\u05de\u05ea\u05d5\u05da",
  raters: "\u05de\u05d3\u05e8\u05d2\u05d9\u05dd \u05d1",
  askReview: "\u05d1\u05e7\u05e9 \u05d4\u05de\u05dc\u05e6\u05d4 \u05de\u05dc\u05e7\u05d5\u05d7 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  recentReviews: "\u05de\u05d4 \u05db\u05ea\u05d1\u05d5 \u05e2\u05dc\u05d9\u05db\u05dd \u05dc\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4",
  suggestReply: "\u05d4\u05e6\u05e2 \u05ea\u05e9\u05d5\u05d1\u05d4 \u05dc\u05d1\u05d9\u05e7\u05d5\u05e8\u05ea",
  askReviewTitle: "\u05d1\u05e7\u05e9\u05ea \u05d4\u05de\u05dc\u05e6\u05d4",
  askReviewHelp:
    "\u05d4\u05d6\u05d9\u05e0\u05d5 \u05de\u05e1\u05e4\u05e8 \u05e9\u05dc \u05dc\u05e7\u05d5\u05d7 \u2014 \u05e0\u05e4\u05ea\u05d7 \u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05e2\u05dd \u05d4\u05d5\u05d3\u05e2\u05d4 \u05de\u05d5\u05db\u05e0\u05d4 \u05d5\u05dc\u05d9\u05e0\u05e7\u05d9\u05dd \u05dc\u05d2\u05d5\u05d2\u05dc \u05d5\u05dc\u05d0\u05d9\u05d6\u05d9.",
  sendWa: "\u05e9\u05dc\u05d7 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
  yonaReply: "\u05ea\u05e9\u05d5\u05d1\u05d4 \u05de\u05d9\u05d5\u05e0\u05d4",
  copyAnswer: "\u05d4\u05e2\u05ea\u05e7 \u05ea\u05e9\u05d5\u05d1\u05d4",
  google: "\u05d2\u05d5\u05d2\u05dc",
  easy: "\u05d0\u05d9\u05d6\u05d9",
  networks: "\u05d7\u05d9\u05d1\u05d5\u05e8 \u05d4\u05e8\u05e9\u05ea\u05d5\u05ea \u05e9\u05dc\u05d9",
  networksSub:
    "\u05d7\u05d1\u05e8\u05d5 \u05e4\u05d9\u05d9\u05e1\u05d1\u05d5\u05e7, \u05d0\u05d9\u05e0\u05e1\u05d8\u05d2\u05e8\u05dd, \u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05d5\u05e2\u05d5\u05d3 \u2014 \u05e2\u05e1\u05e7\u05d9 \u05d0\u05d5 \u05e4\u05e8\u05d8\u05d9, \u05d1\u05dc\u05d9 \u05e1\u05d9\u05d1\u05d5\u05db\u05d9\u05dd.",
  business: "\u05e2\u05e1\u05e7\u05d9",
  personal: "\u05e4\u05e8\u05d8\u05d9",
  notConnected: "\u05dc\u05d0 \u05de\u05d7\u05d5\u05d1\u05e8",
  disconnect: "\u05e0\u05d9\u05ea\u05d5\u05e7",
  connect: "\u05d7\u05d1\u05e8",
  guestOn: "\u05de\u05e6\u05d1 \u05d0\u05d5\u05e8\u05d7 \u05e4\u05e2\u05d9\u05dc",
  guestHelp:
    "\u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05de\u05e9\u05d9\u05da \u05d1\u05dc\u05d9 \u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05d2\u05d5\u05d2\u05dc \u2014 \u05d4\u05d7\u05d9\u05d1\u05d5\u05e8\u05d9\u05dd \u05db\u05d0\u05df \u05dc\u05d4\u05d3\u05d2\u05de\u05d4 \u05d1\u05dc\u05d1\u05d3.",
  connectTo: "\u05d7\u05d9\u05d1\u05d5\u05e8",
  chooseAccount: "\u05d1\u05d7\u05e8\u05d5 \u05e1\u05d5\u05d2 \u05d7\u05e9\u05d1\u05d5\u05df \u05d5\u05d4\u05e9\u05dc\u05d9\u05de\u05d5 \u05e4\u05e8\u05d8\u05d9\u05dd",
  bizPage: "\u05e2\u05de\u05d5\u05d3 \u05e2\u05e1\u05e7\u05d9",
  bizPageDesc: "\u05dc\u05d7\u05d9\u05d1\u05d5\u05e8 \u05de\u05dc\u05d0 \u05dc\u05e2\u05de\u05d5\u05d3 \u05e9\u05dc \u05d4\u05e2\u05e1\u05e7",
  personalDesc: "\u05e4\u05e8\u05e1\u05d5\u05dd \u05de\u05d4\u05d9\u05e8 \u05d1\u05dc\u05d7\u05d9\u05e6\u05d4 \u05d0\u05d7\u05ea",
  username: "\u05e9\u05dd \u05de\u05e9\u05ea\u05de\u05e9",
  phone: "\u05de\u05e1\u05e4\u05e8 \u05d8\u05dc\u05e4\u05d5\u05df (\u05e7\u05d9\u05e9\u05d5\u05e8 \u05de\u05d4\u05d9\u05e8)",
  confirmConnect: "\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d9\u05d1\u05d5\u05e8",
  close: "\u05e1\u05d2\u05d9\u05e8\u05d4",
};

function write(name, body) {
  const file = path.join(root, name);
  fs.writeFileSync(file, body, { encoding: "utf8" });
  const ok = /[\u0590-\u05FF]/.test(fs.readFileSync(file, "utf8"));
  console.log(name, ok ? "HEBREW_OK" : "HEBREW_MISSING");
}

// Keep generate script focused: emit Dashboard + thin wrappers that pull copy from mock-data
// where possible. Full screens get Hebrew from H map.

write(
  "DashboardView.tsx",
  `"use client";

import type { OlarView } from "@/lib/olar/types";
import {
  CONTENT_IDEAS,
  DASHBOARD_STATS,
  OWNER_NAME,
  QUICK_ACTIONS,
  WEEK_DAYS,
  WEEKLY_ACTIVITY,
} from "@/lib/olar/mock-data";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: OlarView) => void;
}) {
  const max = Math.max(...WEEKLY_ACTIVITY, 1);

  return (
    <div className="w-full space-y-6 animate-rise px-6 py-6 lg:px-8" dir="rtl">
      <header className="space-y-2 text-right">
        <p className="text-base font-medium text-accent">${H.homeTitle}</p>
        <h1
          className="text-3xl leading-tight text-slate-900 sm:text-4xl lg:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ${H.hello} {OWNER_NAME}, ${H.whatToday}
        </h1>
        <p className="w-full text-lg leading-relaxed text-slate-800">
          ${H.pickSimple}
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.view)}
            className="flex min-h-16 items-center justify-between rounded-2xl border border-line bg-white px-5 text-right shadow-[var(--shadow)] transition hover:border-accent/40 hover:bg-accent-soft/40 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-lg font-medium text-slate-900">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              {action.label}
            </span>
            <ArrowLeft className="h-5 w-5 text-slate-800" aria-hidden />
          </button>
        ))}
      </div>

      <section className="w-full space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate("yona")}
            className="min-h-12 text-base font-medium text-accent hover:underline"
          >
            ${H.allIdeas}
          </button>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            ${H.nothingToday}
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </h2>
        </div>
        <div className="grid w-full gap-3 md:grid-cols-3">
          {CONTENT_IDEAS.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => onNavigate("yona")}
              className="rounded-2xl border border-line bg-white p-5 text-right transition hover:border-accent/50 hover:bg-accent-soft/30"
            >
              <p className="text-lg font-semibold text-slate-900">{idea.title}</p>
              <p className="mt-2 text-base leading-relaxed text-slate-800">
                {idea.blurb}
              </p>
              <p className="mt-3 text-base font-medium text-accent">
                ${H.clickReady}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {DASHBOARD_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-line bg-white p-5 text-right"
          >
            <p className="text-base text-slate-800">{stat.label}</p>
            <p
              className="mt-1 text-3xl text-slate-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {stat.value}
            </p>
            <p
              className={\`mt-1 text-base font-medium \${
                stat.good ? "text-accent" : "text-danger"
              }\`}
            >
              {stat.delta}
            </p>
          </div>
        ))}
      </section>

      <section className="w-full rounded-2xl border border-line bg-white p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            ${H.postsWeek}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="min-h-12 text-base font-medium text-accent hover:underline"
          >
            ${H.whenPublish}
          </button>
        </div>
        <div className="flex h-36 items-end justify-between gap-2 lg:gap-4">
          {WEEK_DAYS.map((day, i) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-14 rounded-t-lg bg-accent/80"
                style={{
                  height: \`\${Math.max(8, (WEEKLY_ACTIVITY[i] / max) * 100)}%\`,
                  opacity: WEEKLY_ACTIVITY[i] ? 1 : 0.25,
                }}
              />
              <span className="text-base text-slate-800">{day}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-base text-slate-800">
          ${H.fiveDays}
        </p>
      </section>
    </div>
  );
}
`
);

console.log("Dashboard emitted. Run remaining emitters or extend this script.");
