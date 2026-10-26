"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadProfile, useResolvedMyPage } from "@/lib/olar/business-profile";
import {
  loadCurrentPost,
  saveCurrentPost,
  saveCurrentPostImage,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { C } from "@/lib/olar/ui-copy";
import {
  legacyNicheFromCategory,
  normalizeCategory,
} from "@/lib/olar/business-categories";
import { getCategoryFallback } from "@/lib/olar/category-fallbacks";
import { CampaignGenerator } from "@/components/olar/CampaignGenerator";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import type { CampaignPost } from "@/lib/olar/campaign-posts";
import type {
  PlatformPosts,
  SocialPostFields,
} from "../../../../schemas/agent";
import {
  PREVIEW_CHANNEL_TABS,
  aspectRatioForChannel,
  formatChannelShareText,
  networkToPreviewChannel,
  platformToCardData,
  previewChannelToNetwork,
  resolvePlatforms,
  whatsappCardShareHref,
  type PreviewChannel,
} from "@/lib/olar/multi-channel";
import {
  Copy,
  ImagePlus,
  PanelsTopLeft,
  Share2,
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
  const [imageIsFallback, setImageIsFallback] = useState(false);
  const [logoMark, setLogoMark] = useState<string | null>(null);
  const [softToast, setSoftToast] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] =
    useState<PreviewChannel>("whatsapp");
  const [platforms, setPlatforms] = useState<PlatformPosts | null>(null);
  const [campaignPreview, setCampaignPreview] =
    useState<SocialPostFields | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const { message: aiProgress } = useAiProgressMessages(
    generating || imageLoading
  );

  // Hydrate from persisted current_business_post (never lose FAL URL on remount)
  useEffect(() => {
    const stored = loadCurrentPost();
    if (stored?.image_url) setImageUrl(stored.image_url);
    if (stored?.network) {
      setPreviewChannel(networkToPreviewChannel(stored.network));
    }
    if (stored && (stored.headline || stored.body)) {
      const post: SocialPostFields = {
        headline: stored.headline,
        body: stored.body,
        hashtags: stored.hashtags || [],
        call_to_action: stored.cta,
      };
      setCampaignPreview(post);
      setPlatforms(resolvePlatforms(post, page));
    }
  }, [page]);

  useEffect(() => {
    if (!bizName && page.businessName) setBizName(page.businessName);
  }, [page.businessName, bizName]);

  const onActivePostChange = useCallback(
    (p: CampaignPost | null) => {
      if (!p) {
        setCampaignPreview(null);
        setPlatforms(null);
        return;
      }
      const next: SocialPostFields = {
        headline: p.title,
        body: p.body,
        hashtags: loadCurrentPost()?.hashtags || page.firstPost?.hashtags || [],
        call_to_action: p.cta,
      };
      setCampaignPreview((prev) => {
        if (
          prev &&
          prev.headline === next.headline &&
          prev.body === next.body &&
          prev.call_to_action === next.call_to_action
        ) {
          return prev;
        }
        return next;
      });
      setPlatforms(resolvePlatforms(next, page));
      // Persist text; keep existing image_url
      const saved = saveCurrentPost({
        headline: p.title,
        body: p.body,
        cta: p.cta || "",
        hashtags: next.hashtags,
        offer: p.hook,
        network: previewChannelToNetwork(previewChannel),
      });
      void syncCurrentPostToServer(saved);
    },
    [page, previewChannel]
  );

  function onFace(files: FileList | null) {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setFace(String(reader.result));
    reader.readAsDataURL(files[0]!);
  }

  async function handleRegenerateImage(opts?: {
    descriptionOverride?: string;
  }) {
    const profileNiche = loadProfile()?.niche;
    const category =
      normalizeCategory(niche) ||
      normalizeCategory(profileNiche) ||
      null;
    const nicheForApi = category
      ? legacyNicheFromCategory(category)
      : niche || profileNiche || page.tagline;
    const stored = loadCurrentPost();
    const description = (
      opts?.descriptionOverride ||
      prompt.trim() ||
      [campaignPreview?.headline, campaignPreview?.body, stored?.offer]
        .filter(Boolean)
        .join("\n") ||
      `${page.businessName} ${page.tagline}`.trim() ||
      "local business"
    ).trim();
    const seed = Math.floor(Math.random() * 1_000_000);

    setImageLoading(true);
    setSoftToast(null);
    setImageIsFallback(false);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: description,
          description,
          category: category ?? undefined,
          businessName: bizName || page.businessName,
          niche: nicheForApi,
          purpose:
            tab === "headshot" ? "headshot" : tab === "banner" ? "banner" : "post",
          aspectRatio:
            tab === "campaign"
              ? aspectRatioForChannel(previewChannel)
              : tab === "headshot"
                ? "1:1"
                : "16:9",
          seed,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        soft_message?: string;
        fallback?: boolean;
        isFallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
        imageUrl?: string;
      };
      let url = data.image?.url || data.imageUrl;
      let usedClientFallback = false;
      if (!url || url.startsWith("data:image/svg")) {
        url = getCategoryFallback(category || profileNiche, description);
        usedClientFallback = true;
      }
      const asFallback =
        Boolean(data.fallback || data.isFallback) || usedClientFallback;
      setImageUrl(url);
      setResult(url);
      setImageIsFallback(asFallback);
      const preview = campaignPreview || {
        headline: bizName || page.businessName || "",
        body: prompt || page.tagline || page.description || "",
        hashtags: page.firstPost?.hashtags || [],
        call_to_action: page.firstPost?.cta,
      };
      const saved = saveCurrentPost({
        headline: preview.headline,
        body: preview.body,
        cta: preview.call_to_action || "",
        hashtags: preview.hashtags || page.firstPost?.hashtags || [],
        image_url: asFallback ? null : url,
        image_seed: data.image?.seed ?? seed,
        image_prompt: data.image?.prompt ?? null,
        network: previewChannelToNetwork(previewChannel),
      });
      saveCurrentPostImage({
        image_url: url,
        image_seed: data.image?.seed ?? seed,
        image_prompt: data.image?.prompt ?? null,
        fallback: asFallback,
      });
      void syncCurrentPostToServer(saved);
      setSoftToast(data.soft_message || C.aiSoftReady);
    } catch (err) {
      console.error("[Studio] generate-image failed", err);
      const url = getCategoryFallback(category || profileNiche, description);
      setImageUrl(url);
      setResult(url);
      setImageIsFallback(true);
      setSoftToast(C.generateErrorRetry);
    } finally {
      setImageLoading(false);
    }
  }

  async function generatePostImage() {
    await handleRegenerateImage();
  }

  function onPostReady(draft: {
    headline: string;
    body: string;
    cta: string;
    imagePrompt?: string;
    userText: string;
  }) {
    setPrompt(draft.userText);
    const next: SocialPostFields = {
      headline: draft.headline,
      body: draft.body,
      hashtags: loadCurrentPost()?.hashtags || page.firstPost?.hashtags || [],
      call_to_action: draft.cta,
    };
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));
    const saved = saveCurrentPost({
      headline: draft.headline,
      body: draft.body,
      cta: draft.cta,
      hashtags: next.hashtags,
      offer: draft.userText,
      network: previewChannelToNetwork(previewChannel),
    });
    void syncCurrentPostToServer(saved);
    void handleRegenerateImage({
      descriptionOverride: [
        draft.userText,
        draft.headline,
        draft.body,
        draft.imagePrompt,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  async function generate() {
    if (tab === "campaign") return;
    setGenerating(true);
    setResult(null);
    setLogoMark(null);
    setSoftToast(null);

    try {
      if (tab === "banner" || tab === "headshot") {
        await generatePostImage();
        return;
      }

      await new Promise((r) => setTimeout(r, 800));
      if (tab === "logo") {
        setLogoMark((bizName.trim() || page.businessName || "A").slice(0, 1));
        setResult("logo");
      }
      setSoftToast(C.aiSoftReady);
    } catch {
      setSoftToast(C.generateErrorRetry);
    } finally {
      setGenerating(false);
    }
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

  const fallbackPost: SocialPostFields = {
    headline: bizName || page.businessName || C.myBiz,
    body: prompt || page.tagline || page.description,
    hashtags: page.firstPost?.hashtags || [],
    call_to_action: page.firstPost?.cta,
  };
  const activePost = campaignPreview || fallbackPost;
  const activePlatforms =
    platforms || resolvePlatforms(activePost, page);
  const previewPost = platformToCardData(
    activePost,
    activePlatforms,
    previewChannel
  );

  // Prefer persisted FAL URL; face preview only for headshot shell when no FAL yet
  const previewImage =
    imageUrl ||
    (typeof result === "string" &&
    (result.startsWith("http") || result.startsWith("data:"))
      ? result
      : face && tab === "headshot"
        ? face
        : null);

  function selectPreviewChannel(ch: PreviewChannel) {
    // UI shell only — never reset image_url
    setPreviewChannel(ch);
    const stored = loadCurrentPost();
    if (stored) {
      saveCurrentPost({
        ...stored,
        network: previewChannelToNetwork(ch),
      });
    }
  }

  async function copyChannelText() {
    const text = formatChannelShareText(
      activePost,
      activePlatforms,
      previewChannel,
      page
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyToast(C.platformCopied);
      window.setTimeout(() => setCopyToast(null), 1800);
    } catch {
      /* ignore */
    }
  }

  function shareChannel() {
    if (previewChannel === "whatsapp") {
      window.open(
        whatsappCardShareHref(activePost, activePlatforms, page),
        "_blank"
      );
      return;
    }
    void copyChannelText();
  }

  const previewCard = (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PREVIEW_CHANNEL_TABS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => selectPreviewChannel(n.id)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${
              previewChannel === n.id
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-800"
            }`}
          >
            <BrandGlyph id={n.glyph} size={14} />
            {n.label}
          </button>
        ))}
      </div>
      <PostCardPreview
        network={previewChannelToNetwork(previewChannel)}
        businessName={bizName || page.businessName || C.myBiz}
        logoUrl={page.logoUrl || page.avatarUrl}
        post={previewPost}
        imageUrl={previewImage}
        imageLoading={imageLoading}
        isFallback={imageIsFallback}
        onRetryImage={() => void handleRegenerateImage()}
        waHref={
          previewChannel === "whatsapp"
            ? whatsappCardShareHref(activePost, activePlatforms, page)
            : null
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copyChannelText()}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-base font-medium text-slate-900 hover:bg-slate-50"
        >
          <Copy className="h-4 w-4 text-slate-600" />
          {copyToast || C.copyPlatformText}
        </button>
        {previewChannel === "whatsapp" ? (
          <button
            type="button"
            onClick={shareChannel}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-medium text-white hover:brightness-110"
          >
            <Share2 className="h-4 w-4" />
            {C.sendWaCard || C.waSendCard}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      dir="rtl"
    >
      <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:flex-[1.2]">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-28 lg:pb-8 animate-rise">
            <header className="text-right">
              <h1 className="text-right text-xl font-bold text-slate-800">
                {C.yonaTitle}
              </h1>
              <p className="mt-1 break-words text-lg text-slate-800">
                {C.studioTitle}
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
                    // Keep imageUrl — tab switch must not wipe the FAL image
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
                previewNetwork={previewChannelToNetwork(previewChannel)}
                onPreviewNetworkChange={(n) =>
                  selectPreviewChannel(networkToPreviewChannel(n))
                }
                onActivePostChange={onActivePostChange}
                onPostReady={onPostReady}
                category={
                  normalizeCategory(niche) ||
                  normalizeCategory(loadProfile()?.niche) ||
                  null
                }
                hideNetworkTabs
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

            <div className="pt-2 lg:hidden">{previewCard}</div>
          </div>
        </section>

        {/* Sticky Live Preview — single scroll on left; aside does not scroll */}
        <aside className="hidden min-h-0 lg:flex lg:flex-[0.8] lg:flex-col">
          <div className="flex h-full flex-col lg:max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
            {previewCard}
          </div>
        </aside>
      </div>
    </div>
  );
}
