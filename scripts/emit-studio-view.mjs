import fs from "fs";

/** ASCII-only StudioView — all Hebrew via C from ui-copy */
const body = `"use client";

import { useRef, useState } from "react";
import { BUSINESS_NAME } from "@/lib/olar/mock-data";
import { C } from "@/lib/olar/ui-copy";
import {
  Clapperboard,
  ImagePlus,
  PanelsTopLeft,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type StudioTab = "headshot" | "banner" | "logo" | "video";

const TABS: {
  id: StudioTab;
  labelKey: "tabHead" | "tabBanner" | "tabLogo" | "tabVideo";
}[] = [
  { id: "headshot", labelKey: "tabHead" },
  { id: "banner", labelKey: "tabBanner" },
  { id: "logo", labelKey: "tabLogo" },
  { id: "video", labelKey: "tabVideo" },
];

export function StudioView() {
  const faceRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<StudioTab>("headshot");
  const [prompt, setPrompt] = useState("");
  const [face, setFace] = useState<string | null>(null);
  const [bizName, setBizName] = useState(BUSINESS_NAME);
  const [niche, setNiche] = useState("");
  const [videoStyle, setVideoStyle] = useState<"reels" | "product">("reels");
  const [segments, setSegments] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [logoMark, setLogoMark] = useState<string | null>(null);

  function onFace(files: FileList | null) {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setFace(String(reader.result));
    reader.readAsDataURL(files[0]);
  }

  async function generate() {
    setGenerating(true);
    setResult(null);
    setLogoMark(null);
    const delay = tab === "logo" ? 3000 : 1400;
    await new Promise((r) => setTimeout(r, delay));
    if (tab === "headshot") {
      setResult(face ? "face" : null);
    } else if (tab === "banner") {
      setResult("banner");
    } else if (tab === "logo") {
      setLogoMark((bizName.trim() || BUSINESS_NAME).slice(0, 1));
      setResult("logo");
    } else {
      setResult("video");
    }
    setGenerating(false);
  }

  const placeholder =
    tab === "video"
      ? C.phVideo
      : tab === "banner"
        ? C.phBanner
        : tab === "logo"
          ? C.phLogo
          : C.phHead;

  const ctaLabel = generating
    ? C.making
    : tab === "video"
      ? C.makeVideo
      : tab === "banner"
        ? C.makeBanner
        : tab === "logo"
          ? C.makeLogo
          : C.makeHead;

  const canGenerate =
    !generating &&
    (tab === "headshot"
      ? Boolean(face)
      : tab === "logo"
        ? Boolean(bizName.trim())
        : true);

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="text-right">
        <h1
          className="text-3xl font-bold text-slate-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.studioTitle}
        </h1>
        <p className="mt-1 text-lg text-slate-800">{C.studioSub}</p>
      </header>

      <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-sky-50/50 p-1 sm:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setResult(null);
              setLogoMark(null);
            }}
            className={\`min-h-14 rounded-xl text-base font-medium transition \${
              tab === t.id
                ? "border border-sky-600 bg-white text-slate-900 shadow-md ring-2 ring-sky-600"
                : "text-slate-800 hover:bg-white/70"
            }\`}
          >
            {C[t.labelKey]}
          </button>
        ))}
      </div>

      {(tab === "headshot" || tab === "banner" || tab === "video") && (
        <label className="block w-full text-right text-base font-medium text-slate-900">
          {C.tellUs}
          <textarea
            dir="rtl"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            className="mt-2 min-h-28 w-full rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
          />
        </label>
      )}

      {tab === "headshot" && (
        <div
          className="w-full rounded-2xl border-2 border-dashed border-sky-100 bg-white p-6 text-center shadow-lg shadow-slate-200/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFace(e.dataTransfer.files);
          }}
        >
          {face ? (
            <div className="relative mx-auto max-w-xs overflow-hidden rounded-2xl border border-sky-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={face} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => setFace(null)}
                className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/70 text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <ImagePlus className="mx-auto h-10 w-10 text-sky-600" />
              <p className="mt-3 text-base font-bold text-slate-900">
                {C.uploadFace}
              </p>
              <p className="mt-1 text-base text-slate-800">{C.uploadFaceHelp}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => faceRef.current?.click()}
            className="olar-cta mt-4 inline-flex min-h-14 items-center gap-2 rounded-xl px-6 text-base"
          >
            <Upload className="h-4 w-4" />
            {C.uploadBtn}
          </button>
          <input
            ref={faceRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFace(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "banner" && (
        <div className="rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-end gap-2 text-sky-600">
            <p className="text-base font-medium text-slate-800">{C.bannerHelp}</p>
            <PanelsTopLeft className="h-5 w-5" />
          </div>
          <div className="mt-4 flex aspect-[3/1] items-center justify-center rounded-xl bg-gradient-to-l from-sky-700 to-sky-600 text-lg font-bold text-white">
            {bizName || C.myBiz}
          </div>
        </div>
      )}

      {tab === "logo" && (
        <div className="space-y-4 rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
          <label className="block text-base font-medium text-slate-900">
            {C.logoBizName}
            <input
              dir="rtl"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder={C.logoBizNamePh}
              className="mt-1.5 min-h-14 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
            />
          </label>
          <label className="block text-base font-medium text-slate-900">
            {C.logoNiche}
            <input
              dir="rtl"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={C.logoNichePh}
              className="mt-1.5 min-h-14 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600"
            />
          </label>
        </div>
      )}

      {tab === "video" && (
        <div className="w-full space-y-4 rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "reels" as const, label: C.reelsStory },
                { id: "product" as const, label: C.productVideo },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setVideoStyle(s.id)}
                className={\`min-h-12 rounded-xl px-4 text-base font-bold \${
                  videoStyle === s.id
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                    : "border border-sky-100 text-slate-800"
                }\`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="block text-base text-slate-900">
            {C.segments} {segments}
            <input
              type="range"
              min={2}
              max={6}
              value={segments}
              onChange={(e) => setSegments(Number(e.target.value))}
              className="mt-2 w-full accent-sky-600"
            />
          </label>
          <ul className="space-y-2 text-base text-slate-800">
            {Array.from({ length: segments }, (_, i) => (
              <li
                key={i}
                className="rounded-xl bg-sky-50/50 px-3 py-2 text-right"
              >
                {C.seg} {i + 1}:{" "}
                {i === 0
                  ? C.segHook
                  : i === segments - 1
                    ? C.segCta
                    : C.segValue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={!canGenerate}
        onClick={() => void generate()}
        className="olar-cta flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg disabled:opacity-50"
      >
        {tab === "video" ? (
          <Clapperboard className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        {ctaLabel}
      </button>

      {tab === "headshot" && result === "face" && face ? (
        <div className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg shadow-slate-200/50">
          <div className="border-b border-sky-100 px-4 py-3 text-right text-base font-bold text-slate-900">
            {C.resultDemo} - {C.headReady}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={face}
            alt=""
            className="aspect-square max-h-[28rem] w-full bg-sky-50 object-cover"
          />
        </div>
      ) : null}

      {result === "banner" && (
        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg shadow-slate-200/50">
          <div className="border-b border-sky-100 px-4 py-3 text-right text-base font-bold text-slate-900">
            {C.resultDemo} - {C.bannerReady}
          </div>
          <div className="flex aspect-[3/1] items-end bg-gradient-to-l from-sky-800 via-sky-600 to-sky-500 p-6">
            <div className="rounded-xl bg-white/95 px-4 py-3 text-right">
              <p className="text-xl font-bold text-slate-900">
                {bizName || C.myBiz}
              </p>
              <p className="text-base text-slate-800">
                {prompt || C.bannerHelp}
              </p>
            </div>
          </div>
        </div>
      )}

      {result === "logo" && (
        <div className="rounded-2xl border border-sky-100 bg-white p-6 text-right shadow-lg shadow-slate-200/50">
          <p className="text-base font-bold text-slate-900">
            {C.resultDemo} - {C.logoReady}
          </p>
          <div className="mx-auto mt-4 flex h-36 w-36 items-center justify-center rounded-3xl bg-sky-600 text-5xl font-bold text-white shadow-md shadow-sky-600/25">
            {logoMark}
          </div>
          <p className="mt-3 text-center text-lg font-bold text-slate-900">
            {bizName}
          </p>
          {niche ? (
            <p className="text-center text-base text-slate-800">{niche}</p>
          ) : null}
        </div>
      )}

      {result === "video" && (
        <div className="w-full rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
          <p className="text-lg font-bold text-slate-900">
            {C.script} {videoStyle === "reels" ? C.reels : C.product} -{" "}
            {segments} {C.segmentsWord}
          </p>
          <p className="mt-2 text-base text-slate-800">
            {prompt || C.videoReady}
          </p>
          <div className="mt-4 flex aspect-[9/16] max-w-[220px] items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Clapperboard className="h-10 w-10 opacity-70" />
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("src/components/olar/views/StudioView.tsx", body, "utf8");
const t = fs.readFileSync("src/components/olar/views/StudioView.tsx");
console.log(
  "studio",
  t.length,
  "utf8_ok",
  Buffer.from(t.toString("utf8"), "utf8").equals(t)
);
