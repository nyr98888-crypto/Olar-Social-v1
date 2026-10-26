"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { C } from "@/lib/olar/ui-copy";
import { NETWORKS } from "@/lib/olar/mock-data";
import { CampaignGenerator } from "@/components/olar/CampaignGenerator";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import {
  ImagePlus,
  PanelsTopLeft,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type StudioTab = "campaign" | "headshot" | "banner" | "logo";

const TABS: {
  id: StudioTab;
  labelKey: "tabCampaign" | "tabHead" | "tabBanner" | "tabLogo";
}[] = [
  { id: "campaign", labelKey: "tabCampaign" },
  { id: "headshot", labelKey: "tabHead" },
  { id: "banner", labelKey: "tabBanner" },
  { id: "logo", labelKey: "tabLogo" },
];

const PREVIEW_NETWORKS = NETWORKS.filter(
  (n) => n.id === "facebook" || n.id === "instagram" || n.id === "google"
);

export function StudioView() {
  const { page } = useResolvedMyPage();
  const faceRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<StudioTab>("campaign");
  const [prompt, setPrompt] = useState("");
  const [face, setFace] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [logoMark, setLogoMark] = useState<string | null>(null);
  const [softToast, setSoftToast] = useState<string | null>(null);
  const [previewNetwork, setPreviewNetwork] =
    useState<SocialNetwork>("instagram");
  const [campaignPreview, setCampaignPreview] = useState<{
    headline: string;
    body: string;
    hashtags?: string[];
    call_to_action?: string;
  } | null>(null);
  const { message: aiProgress } = useAiProgressMessages(
    generating || imageLoading
  );

  useEffect(() => {
    if (!bizName && page.businessName) setBizName(page.businessName);
  }, [page.businessName, bizName]);

  function onFace(files: FileList | null) {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setFace(String(reader.result));
    reader.readAsDataURL(files[0]!);
  }

  async function generatePostImage() {
    setImageLoading(true);
    setImageUrl(null);
    setSoftToast(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description:
            prompt.trim() ||
            `${page.businessName} ${page.tagline}`.trim() ||
            "local business",
          businessName: bizName || page.businessName,
          niche: niche || page.tagline,
          purpose:
            tab === "headshot" ? "headshot" : tab === "banner" ? "banner" : "post",
          aspectRatio: tab === "headshot" ? "1:1" : "16:9",
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        soft_message?: string;
        image?: { url?: string };
      };
      if (data.image?.url) {
        setImageUrl(data.image.url);
        setResult(data.image.url);
      }
      setSoftToast(data.soft_message || C.aiSoftReady);
    } catch {
      setSoftToast(C.aiSoftReady);
    } finally {
      setImageLoading(false);
    }
  }

  async function generate() {
    if (tab === "campaign") return;
    setGenerating(true);
    setResult(null);
    setLogoMark(null);
    setSoftToast(null);

    if (tab === "banner" || tab === "headshot") {
      await generatePostImage();
      setGenerating(false);
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, 1200));
      if (tab === "logo") {
        setLogoMark((bizName.trim() || page.businessName || "A").slice(0, 1));
        setResult("logo");
      }
      setSoftToast(C.aiSoftReady);
    } catch {
      setSoftToast(C.aiSoftReady);
    }
    setGenerating(false);
  }

  const placeholder =
    tab === "banner" ? C.phBanner : tab === "logo" ? C.phLogo : C.phHead;

  const ctaLabel =
    generating || imageLoading
      ? aiProgress || C.making
      : tab === "banner"
        ? C.makeBanner
        : tab === "logo"
          ? C.makeLogo
          : C.makeHead;

  const canGenerate =
    !generating &&
    !imageLoading &&
    (tab === "headshot"
      ? Boolean(face) || Boolean(prompt.trim())
      : tab === "logo"
        ? Boolean(bizName.trim())
        : true);

  const previewPost = campaignPreview || {
    headline: bizName || page.businessName || C.myBiz,
    body: prompt || page.tagline || page.description,
    hashtags: page.firstPost?.hashtags,
    call_to_action: page.firstPost?.cta,
  };

  const previewImage =
    imageUrl ||
    (typeof result === "string" &&
    (result.startsWith("http") || result.startsWith("data:"))
      ? result
      : face && tab === "headshot"
        ? face
        : null);

  const previewCard = (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PREVIEW_NETWORKS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setPreviewNetwork(n.id)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${
              previewNetwork === n.id
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-800"
            }`}
          >
            <BrandGlyph id={n.id === "google" ? "google" : n.id} size={14} />
            {n.label}
          </button>
        ))}
      </div>
      <PostCardPreview
        network={previewNetwork}
        businessName={bizName || page.businessName || C.myBiz}
        post={previewPost}
        imageUrl={previewImage}
        imageLoading={imageLoading}
      />
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-x-hidden"
      dir="rtl"
    >
      <div className="flex h-[calc(100vh-80px)] min-h-0 w-full flex-col gap-6 overflow-hidden lg:grid lg:grid-cols-12">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:col-span-7 xl:col-span-8">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-28 lg:pb-8 animate-rise">
            <header className="text-right">
              <h1
                className="break-words text-3xl font-bold text-slate-900"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {C.studioTitle}
              </h1>
              <p className="mt-1 break-words text-lg text-slate-800">
                {C.studioSub}
              </p>
            </header>

            <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-accent-soft/50 p-1 sm:grid-cols-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setResult(null);
                    setLogoMark(null);
                  }}
                  className={`min-h-12 break-words rounded-xl text-base font-medium transition sm:min-h-14 ${
                    tab === t.id
                      ? "border border-accent bg-white text-slate-900 shadow-md ring-2 ring-accent"
                      : "text-slate-800 hover:bg-white/70"
                  }`}
                >
                  {C[t.labelKey]}
                </button>
              ))}
            </div>

            {tab === "campaign" ? (
              <CampaignGenerator
                initialTopic={
                  prompt || `${page.businessName} ${page.tagline}`.trim()
                }
                previewNetwork={previewNetwork}
                onPreviewNetworkChange={setPreviewNetwork}
                onActivePostChange={(p) =>
                  setCampaignPreview(
                    p
                      ? {
                          headline: p.title,
                          body: p.body,
                          call_to_action: p.cta,
                        }
                      : null
                  )
                }
              />
            ) : null}

            {tab !== "campaign" && tab !== "logo" ? (
              <label className="block w-full text-right text-base font-medium text-slate-900">
                {C.tellUs}
                <textarea
                  dir="rtl"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={placeholder}
                  className="mt-2 min-h-28 w-full break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                />
              </label>
            ) : null}

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
                    <img
                      src={face}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
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
                    <ImagePlus className="mx-auto h-10 w-10 text-accent" />
                    <p className="mt-3 text-base font-bold text-slate-900">
                      {C.uploadFace}
                    </p>
                    <p className="mt-1 text-base text-slate-800">
                      {C.uploadFaceHelp}
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => faceRef.current?.click()}
                  className="olar-cta mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-base"
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
                <div className="flex items-center justify-end gap-2 text-accent">
                  <p className="break-words text-base font-medium text-slate-800">
                    {C.bannerHelp}
                  </p>
                  <PanelsTopLeft className="h-5 w-5 shrink-0" />
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
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="block text-base font-medium text-slate-900">
                  {C.logoNiche}
                  <input
                    dir="rtl"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder={C.logoNichePh}
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  />
                </label>
              </div>
            )}

            {tab !== "campaign" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                  className="olar-cta flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-center text-base disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="break-words leading-snug">{ctaLabel}</span>
                </button>
                {(tab === "banner" || tab === "headshot") && (
                  <button
                    type="button"
                    disabled={imageLoading}
                    onClick={() => void generatePostImage()}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 text-base font-medium text-slate-900 disabled:opacity-50"
                  >
                    <ImagePlus className="h-5 w-5" />
                    {imageLoading
                      ? C.imageLoading || C.making
                      : C.makePostImage || C.makeBanner}
                  </button>
                )}
              </div>
            ) : null}

            {generating || imageLoading ? (
              <p className="animate-rise text-center text-base font-medium text-accent">
                {aiProgress}
              </p>
            ) : null}
            {softToast && !generating && !imageLoading ? (
              <p className="break-words rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-base font-medium text-emerald-900">
                {softToast}
              </p>
            ) : null}

            {result === "logo" && (
              <div className="rounded-2xl border border-sky-100 bg-white p-6 text-right shadow-lg shadow-slate-200/50">
                <p className="text-base font-bold text-slate-900">
                  {C.resultDemo} - {C.logoReady}
                </p>
                <div className="mx-auto mt-4 flex h-36 w-36 items-center justify-center rounded-3xl bg-accent text-5xl font-bold text-white shadow-md shadow-sky-600/20">
                  {logoMark}
                </div>
                <p className="mt-3 break-words text-center text-lg font-bold text-slate-900">
                  {bizName}
                </p>
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 lg:hidden">
              {previewCard}
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-hidden lg:col-span-5 lg:block xl:col-span-4">
          <div className="h-full overflow-y-auto overscroll-contain p-1">
            <div className="sticky top-0">{previewCard}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
