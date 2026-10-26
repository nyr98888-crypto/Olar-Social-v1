"use client";

import { useEffect, useRef, useState } from "react";
import { useResolvedMyPage, loadProfile } from "@/lib/olar/business-profile";
import {
  loadCurrentPost,
  saveCurrentPost,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { persistSelectedCardToActiveCampaign } from "@/lib/store/campaign-store";
import type { SaveCampaignInput } from "@/lib/olar/campaigns-client";
import { brandGuidelinesFromBusinessProfile } from "@/lib/ai/partner-memory";
import type { PlatformPosts, SocialPostFields } from "../../../../schemas/agent";
import { C } from "@/lib/olar/ui-copy";
import {
  legacyNicheFromCategory,
  normalizeCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import { getCategoryFallback } from "@/lib/olar/category-fallbacks";
import { CLIENT_IMAGE_TIMEOUT_MS } from "@/lib/api/fetch-with-retry";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "@/lib/speech-types";
import { BrandGlyph } from "../NetworkBrand";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { ExampleChips } from "@/components/olar/ExampleChips";
import { AgentAvatar } from "@/components/olar/AgentAvatar";
import { AiSendButton } from "@/components/olar/AiSendButton";
import {
  PREVIEW_CHANNEL_TABS,
  aspectRatioForChannel,
  formatChannelShareText,
  platformToCardData,
  previewChannelToNetwork,
  resolvePlatforms,
  whatsappCardShareHref,
  type PreviewChannel,
} from "@/lib/olar/multi-channel";
import {
  Copy,
  ImagePlus,
  Loader2,
  Mic,
  Share2,
  Sparkles,
} from "lucide-react";
import { stripCategoryLeak } from "@/lib/olar/strip-category";

/* ── Types ─────────────────────────────────────────── */

type Msg = {
  role: "user" | "assistant";
  content: string;
  showImageActions?: boolean;
};

/* ── Component ─────────────────────────────────────── */

export function YonaView({
  onNavigateToStudio,
}: {
  onNavigateToStudio?: (payload?: SaveCampaignInput) => void | Promise<void>;
} = {}) {
  const { page } = useResolvedMyPage();

  /* Chat state */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  /* Post + platform state */
  const [currentPost, setCurrentPost] = useState<SocialPostFields | null>(
    null
  );
  const [platforms, setPlatforms] = useState<PlatformPosts | null>(null);
  const [previewChannel, setPreviewChannel] =
    useState<PreviewChannel>("whatsapp");

  /* Image state */
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageIsFallback, setImageIsFallback] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<BusinessCategoryId | null>(null);
  const [filledFromChip, setFilledFromChip] = useState<string | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [imagePending, setImagePending] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(
    null
  );

  /* Speech */
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const basePromptRef = useRef("");
  const finalsRef = useRef("");
  const speechSupportedRef = useRef(false);

  /* UI */
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"preview" | "chat">("preview");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Effects ─────────────────────────────────────── */

  // Hydrate stored image on mount
  useEffect(() => {
    const stored = loadCurrentPost();
    if (stored?.image_url) setImageUrl(stored.image_url);
  }, []);

  // Proactive greeting
  useEffect(() => {
    setMessages([{ role: "assistant", content: C.yonaProactiveGreeting }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Toast dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Speech support check
  useEffect(() => {
    speechSupportedRef.current = Boolean(getSpeechRecognitionCtor());
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ── Derived ─────────────────────────────────────── */

  const previewPost = currentPost
    ? platformToCardData(currentPost, platforms, previewChannel)
    : null;
  const waHref =
    currentPost && previewChannel === "whatsapp"
      ? whatsappCardShareHref(currentPost, platforms, page)
      : null;

  /* ── Chat send (real /api/chat) ─────────────────── */

  async function send() {
    const text = prompt.trim();
    if (!text || busy) return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setPrompt("");
    setBusy(true);

    try {
      const profile = loadProfile();
      const brandGuidelines = profile
        ? brandGuidelinesFromBusinessProfile(profile, null)
        : null;

      // Sliding window: last 6 turns = 12 messages
      const slidingHistory = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: stripCategoryLeak(text),
          userText: stripCategoryLeak(text),
          category: selectedCategory,
          brandGuidelines,
          businessProfile: profile || undefined,
          history: slidingHistory,
          previousImagePrompt: pendingImagePrompt,
          currentPost: currentPost
            ? {
                headline: currentPost.headline,
                body: currentPost.body,
                bodyText: currentPost.body,
                cta: currentPost.call_to_action || "",
                ctaButton: currentPost.call_to_action || "",
                imageUrl,
                hashtags: currentPost.hashtags || [],
              }
            : null,
        }),
        signal: AbortSignal.timeout(12_000),
      });

      const data = (await res.json()) as {
        conversationId?: string;
        message?: {
          content?: string;
          social_post?: SocialPostFields | null;
          image_url?: string | null;
          image_seed?: number | null;
          image_prompt?: string | null;
          intent?: string;
        };
        output?: {
          chat_reply: string;
          intent: string;
          social_post: (SocialPostFields & { platforms?: PlatformPosts }) | null;
          image_task: {
            generate_image: boolean;
            prompt?: string;
            aspect_ratio?: string;
          };
        };
        image?: { url?: string; seed?: number; prompt?: string } | null;
        imagePending?: boolean;
      };

      if (data.conversationId) setConversationId(data.conversationId);

      const output = data.output;
      const chatReply =
        data.message?.content || output?.chat_reply || "...";
      const socialPost = output?.social_post ?? data.message?.social_post ?? null;
      const hasImagePending = Boolean(data.imagePending);

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: chatReply,
          showImageActions: hasImagePending,
        },
      ]);

      // Handle social_post → Live Preview + persistence (multi-channel from DNA)
      if (socialPost?.headline?.trim() && socialPost?.body?.trim()) {
        const cleaned = {
          ...socialPost,
          headline: stripCategoryLeak(socialPost.headline),
          body: stripCategoryLeak(socialPost.body),
          call_to_action: stripCategoryLeak(
            socialPost.call_to_action || ""
          ),
        };
        setCurrentPost(cleaned);
        const plats = resolvePlatforms(cleaned, page);
        setPlatforms(plats);

        const saved = saveCurrentPost({
          headline: cleaned.headline,
          body: cleaned.body,
          cta: cleaned.call_to_action || "",
          hashtags: cleaned.hashtags,
          image_url: imageUrl,
          network: previewChannelToNetwork(previewChannel),
        });
        void syncCurrentPostToServer(saved);
        // Keep studio handoff key in sync so "המשך לעריכה" never shows Missing Card
        persistSelectedCardToActiveCampaign({
          headline: cleaned.headline,
          bodyText: cleaned.body,
          body: cleaned.body,
          ctaButton: cleaned.call_to_action || "",
          imageUrl,
          hashtags: cleaned.hashtags,
          businessName: page.businessName || "",
        });
      }

      // Handle image already returned — never clear on channel switch
      if (data.image?.url) {
        setImageUrl(data.image.url);
        setImagePending(false);
        if (socialPost) {
          const saved = saveCurrentPost({
            headline: socialPost.headline,
            body: socialPost.body,
            cta: socialPost.call_to_action || "",
            hashtags: socialPost.hashtags,
            image_url: data.image.url,
            image_seed: data.image.seed ?? null,
            image_prompt: data.image.prompt ?? null,
            network: previewChannelToNetwork(previewChannel),
          });
          void syncCurrentPostToServer(saved);
          persistSelectedCardToActiveCampaign({
            headline: socialPost.headline,
            bodyText: socialPost.body,
            body: socialPost.body,
            ctaButton: socialPost.call_to_action || "",
            imageUrl: data.image.url,
            imagePrompt: data.image.prompt || "",
            hashtags: socialPost.hashtags,
            businessName: page.businessName || "",
          });
        }
      }

      // Handle pending image (deferred)
      if (hasImagePending) {
        setImagePending(true);
        setPendingImagePrompt(
          output?.image_task?.prompt ??
            data.message?.image_prompt ??
            null
        );
      }
    } catch {
      setToast(C.generateErrorRetry);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: C.generateErrorRetry },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /* ── Image generation ────────────────────────────── */

  async function generatePostImage() {
    const desc =
      pendingImagePrompt ||
      currentPost?.headline ||
      currentPost?.body ||
      prompt.trim();
    if (!desc) return;

    const profileNiche = loadProfile()?.niche;
    const category =
      selectedCategory ||
      normalizeCategory(profileNiche) ||
      null;
    const nicheForApi = category
      ? legacyNicheFromCategory(category)
      : profileNiche;

    const { withRegenAngleHint, bustImageUrl } = await import(
      "@/lib/olar/image-cache-bust"
    );
    const newSeed = Math.floor(Math.random() * 2147483647);
    const updatedPrompt = withRegenAngleHint(desc);
    setImageUrl(null);
    setImageLoading(true);
    setImagePending(false);
    setImageIsFallback(false);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: updatedPrompt,
          prompt: updatedPrompt,
          purpose: "post",
          aspectRatio: aspectRatioForChannel(previewChannel),
          businessName: page.businessName,
          niche: nicheForApi,
          category: category ?? undefined,
          seed: newSeed,
          bustCache: Date.now(),
          regenerate: true,
          previousPrompt: loadCurrentPost()?.image_prompt || null,
        }),
        signal: AbortSignal.timeout(CLIENT_IMAGE_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fallback?: boolean;
        isFallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
        imageUrl?: string;
      };
      let url = data.image?.url || data.imageUrl;
      if (url) url = bustImageUrl(url) || `${url}?t=${Date.now()}`;
      let usedClientFallback = false;
      if (!url || url.startsWith("data:image/svg")) {
        url = getCategoryFallback(category || profileNiche, desc);
        usedClientFallback = true;
      }
      const asFallback =
        Boolean(data.fallback || data.isFallback) || usedClientFallback;
      setImageUrl(url);
      setImageIsFallback(asFallback);
      if (currentPost) {
        const saved = saveCurrentPost({
          headline: currentPost.headline,
          body: currentPost.body,
          cta: currentPost.call_to_action || "",
          hashtags: currentPost.hashtags,
          image_url: asFallback ? null : url,
          image_seed: data.image?.seed ?? null,
          image_prompt: data.image?.prompt ?? null,
          network: previewChannelToNetwork(previewChannel),
        });
        void syncCurrentPostToServer(saved);
      }
    } catch {
      const url = getCategoryFallback(category || profileNiche);
      setImageUrl(url);
      setImageIsFallback(true);
    } finally {
      setImageLoading(false);
    }
  }

  /* ── Image upload ────────────────────────────────── */

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setImagePending(false);
      if (currentPost) {
        const saved = saveCurrentPost({
          headline: currentPost.headline,
          body: currentPost.body,
          cta: currentPost.call_to_action || "",
          hashtags: currentPost.hashtags,
          image_url: dataUrl,
          network: previewChannelToNetwork(previewChannel),
        });
        void syncCurrentPostToServer(saved);
      }
    };
    reader.readAsDataURL(file);
  }

  /* ── Copy / share adapted per channel ─────────────── */

  async function copyPlatformText() {
    if (!currentPost) return;
    const text = formatChannelShareText(
      currentPost,
      platforms,
      previewChannel,
      page
    );
    try {
      await navigator.clipboard.writeText(text);
      setToast(C.platformCopied);
    } catch {
      /* ignore */
    }
  }

  function sharePlatform() {
    if (!currentPost) return;
    if (previewChannel === "whatsapp") {
      const href = whatsappCardShareHref(currentPost, platforms, page);
      window.open(href, "_blank");
      return;
    }
    void copyPlatformText();
  }

  /* ── Speech recognition ──────────────────────────── */

  function stopSpeech() {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }

  function startSpeech() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      basePromptRef.current = prompt;
      setListening(true);
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    basePromptRef.current = prompt;
    finalsRef.current = "";
    rec.lang = "he-IL";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (event) => {
      let interim = "";
      let finals = finalsRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finals = `${finals}${piece}`.trim();
          finalsRef.current = finals;
        } else {
          interim += piece;
        }
      }
      const base = basePromptRef.current.trim();
      const spoken = `${finals}${interim ? (finals ? " " : "") + interim : ""}`.trim();
      const next = [base, spoken]
        .filter(Boolean)
        .join(base && spoken ? "\n" : "");
      setPrompt(next);
    };

    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      rec.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  }

  function toggleMic() {
    if (busy) return;
    if (listening) {
      const hadSpeech = Boolean(recognitionRef.current);
      stopSpeech();
      if (!hadSpeech && !speechSupportedRef.current) {
        const base = basePromptRef.current.trim();
        const next = [base, C.micFallbackDone].filter(Boolean).join("\n");
        setPrompt(next);
        inputRef.current?.focus();
      }
      return;
    }
    startSpeech();
  }

  /* ── Render ──────────────────────────────────────── */

  const previewCard = (
    <div className="flex w-full flex-col gap-3">
      {/* Multi-channel tabs — switch never resets image_url */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PREVIEW_CHANNEL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPreviewChannel(tab.id)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${
              previewChannel === tab.id
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <BrandGlyph id={tab.glyph} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-center text-base text-slate-800">
        {C.postCardPreview}
      </p>

      {previewPost && currentPost ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditDraft(
                  `${currentPost.headline}\n${currentPost.body}`.trim()
                );
                setEditingText(true);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium"
            >
              {C.editPostText}
            </button>
            <button
              type="button"
              disabled={imageLoading}
              onClick={() => void generatePostImage()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {imageLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {C.swapPostImage}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium"
            >
              {C.uploadPostImage}
            </button>
          </div>
          {editingText ? (
            <div className="space-y-2">
              <textarea
                dir="rtl"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-right text-base"
              />
              <button
                type="button"
                onClick={() => {
                  const [h, ...rest] = editDraft.split("\n");
                  const next = {
                    ...currentPost,
                    headline: stripCategoryLeak(h || currentPost.headline),
                    body: stripCategoryLeak(
                      rest.join("\n").trim() || currentPost.body
                    ),
                  };
                  setCurrentPost(next);
                  const saved = saveCurrentPost({
                    headline: next.headline,
                    body: next.body,
                    cta: next.call_to_action || "",
                    hashtags: next.hashtags,
                    image_url: imageUrl,
                    network: previewChannelToNetwork(previewChannel),
                  });
                  void syncCurrentPostToServer(saved);
                  setEditingText(false);
                }}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                {C.savePostText}
              </button>
            </div>
          ) : (
            <PostCardPreview
              network={previewChannelToNetwork(previewChannel)}
              businessName={page.businessName || C.myBiz}
              logoUrl={page.logoUrl || page.avatarUrl}
              post={previewPost}
              imageUrl={imageUrl}
              imageLoading={imageLoading}
              isFallback={imageIsFallback}
              onRetryImage={() => void generatePostImage()}
              waHref={waHref}
            />
          )}
        </>
      ) : (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-base text-slate-500">
          {C.postPreviewEmpty}
        </div>
      )}

      <button
        type="button"
        disabled={imageLoading || busy}
        onClick={() => void generatePostImage()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white text-base font-medium text-slate-900 disabled:opacity-50"
      >
        {imageLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        ) : (
          <Sparkles className="h-4 w-4 text-accent" />
        )}
        {imageLoading
          ? C.generatingPostImage
          : C.makePostImage || C.imgReady}
      </button>

      {previewPost && currentPost ? (
        <div className="flex flex-col gap-2">
          {onNavigateToStudio ? (
            <button
              type="button"
              onClick={() => {
                const payload: SaveCampaignInput = {
                  headline: currentPost.headline,
                  bodyText: currentPost.body,
                  body: currentPost.body,
                  imageUrl,
                  hashtags: currentPost.hashtags || [],
                  platform: "Instagram",
                };
                persistSelectedCardToActiveCampaign({
                  headline: currentPost.headline,
                  bodyText: currentPost.body,
                  body: currentPost.body,
                  ctaButton: currentPost.call_to_action || "",
                  imageUrl,
                  hashtags: currentPost.hashtags || [],
                  businessName: page.businessName || "",
                });
                const saved = saveCurrentPost({
                  headline: currentPost.headline,
                  body: currentPost.body,
                  cta: currentPost.call_to_action || "",
                  hashtags: currentPost.hashtags || [],
                  image_url: imageUrl,
                  network: previewChannelToNetwork(previewChannel),
                });
                void syncCurrentPostToServer(saved);
                void onNavigateToStudio?.(payload);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-base font-bold text-white shadow-md hover:bg-cyan-500"
            >
              <Sparkles className="h-4 w-4" />
              המשך לעריכה בסטודיו
            </button>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void copyPlatformText()}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-base font-medium text-slate-900 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4 text-slate-600" />
            {C.copyPlatformText}
          </button>
          {previewChannel === "whatsapp" ? (
            <button
              type="button"
              onClick={sharePlatform}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-medium text-white hover:brightness-110"
            >
              <Share2 className="h-4 w-4" />
              {C.sendWaCard || C.waSendCard}
            </button>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-hidden"
      dir="rtl"
    >
      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed start-1/2 top-20 z-[70] -translate-x-1/2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-medium text-white shadow-md">
          {toast}
        </div>
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Mobile pane switch — preview first by default */}
      <div className="mb-3 flex w-full shrink-0 gap-2 rounded-2xl bg-accent-soft/50 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-xl text-base font-bold transition ${
            mobilePane === "preview"
              ? "border border-accent bg-white text-slate-900 shadow-md"
              : "text-slate-700 hover:bg-white/70"
          }`}
        >
          תצוגה
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("chat")}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-xl text-base font-bold transition ${
            mobilePane === "chat"
              ? "border border-accent bg-white text-slate-900 shadow-md"
              : "text-slate-700 hover:bg-white/70"
          }`}
        >
          צ&apos;אט
        </button>
      </div>

      {/* Stack below lg; two columns from lg */}
      <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-x-hidden overflow-hidden lg:grid lg:grid-cols-2">
        {/* Preview */}
        <aside
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${
            mobilePane === "preview" ? "flex" : "hidden"
          } lg:order-2 lg:flex`}
        >
          <div className="flex h-full max-h-full flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 lg:max-h-[calc(100vh-120px)]">
            {previewCard}
          </div>
        </aside>

        {/* Chat column */}
        <section
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${
            mobilePane === "chat" ? "flex" : "hidden"
          } lg:order-1 lg:flex`}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
            {/* Header */}
            <div className="space-y-3 border-b border-slate-300 bg-white pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-4 text-sm font-semibold text-accent">
                  {C.humanNotBot}
                </span>
                <div className="flex items-center gap-3">
                  <h1 className="text-right text-xl font-bold text-slate-800 sm:text-2xl lg:text-3xl">
                    {C.yonaTitle}
                  </h1>
                  <AgentAvatar size="md" />
                </div>
              </div>
              <p className="text-base text-slate-600">{C.yonaPartnerSub}</p>
            </div>

            {/* Messages */}
            <div className="space-y-3" dir="rtl">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div
                    className={`flex ${
                      msg.role === "assistant"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] break-words rounded-2xl px-4 py-3 text-right text-base leading-relaxed ${
                        msg.role === "user"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-800"
                      }`}
                      style={{ textAlign: "right" }}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* Upload / generate image action buttons */}
                  {msg.showImageActions && msg.role === "assistant" && (
                    <div className="mt-2 flex justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-medium text-sky-800 hover:bg-sky-100"
                      >
                        <ImagePlus className="h-4 w-4" />
                        {C.yonaUploadPhoto}
                      </button>
                      <button
                        type="button"
                        disabled={imageLoading}
                        onClick={() => void generatePostImage()}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        {C.yonaGenImageOneClick}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right text-base text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      {C.generatingPostImage}
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input area */}
            <div className="space-y-3 border-t border-slate-300 bg-white py-4">
              <div className="flex min-w-0 gap-2" dir="rtl">
                <textarea
                  ref={inputRef}
                  dir="rtl"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={C.yonaChatPlaceholder}
                  rows={3}
                  className="min-h-20 min-w-0 flex-1 resize-y break-words rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  style={{ textAlign: "right" }}
                  disabled={busy}
                />
                <AiSendButton
                  onClick={() => void send()}
                  disabled={busy || !prompt.trim()}
                  loading={busy}
                  title={C.send}
                  className="h-14 w-14 rounded-2xl"
                />
              </div>

              <ExampleChips
                disabled={busy}
                selectedId={selectedCategory}
                onSelect={(text, id) => {
                  setSelectedCategory((prev) => {
                    if (id == null) return null;
                    return prev === id ? null : id;
                  });
                  const trimmed = prompt.trim();
                  const canFill =
                    !trimmed ||
                    (filledFromChip != null &&
                      trimmed === filledFromChip.trim());
                  if (id == null) {
                    if (canFill) {
                      setPrompt("");
                      setFilledFromChip(null);
                    }
                  } else if (canFill) {
                    setPrompt(text);
                    setFilledFromChip(text);
                  }
                  inputRef.current?.focus();
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={busy}
                  className={`flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-base font-medium text-white shadow-md transition ${
                    listening
                      ? "mic-recording-active bg-red-600"
                      : "bg-accent shadow-sky-600/20 hover:bg-accent-hover"
                  }`}
                  aria-label={
                    listening ? C.micRecordingTapEnd : C.micRecordIdea
                  }
                >
                  <Mic className="h-5 w-5" />
                  <span className="max-w-[14rem] truncate sm:max-w-none">
                    {listening ? C.micRecordingTapEnd : C.micRecordIdea}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}
