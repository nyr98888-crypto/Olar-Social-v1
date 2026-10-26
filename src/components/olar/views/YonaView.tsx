"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { useResolvedMyPage, loadProfile } from "@/lib/olar/business-profile";
import {
  loadCurrentPost,
  saveCurrentPost,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { brandGuidelinesFromBusinessProfile } from "@/lib/ai/partner-memory";
import {
  derivePlatformsFromPost,
  type PlatformPosts,
  type SocialPostFields,
} from "../../../../schemas/agent";
import {
  buildWaInquiryLink,
  buildWaOpenMessage,
} from "@/lib/olar/connections";
import { C } from "@/lib/olar/ui-copy";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "@/lib/speech-types";
import { BrandGlyph } from "../NetworkBrand";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { ExampleChips } from "@/components/olar/ExampleChips";
import { Copy, ImagePlus, Mic, Send, Sparkles } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

type Msg = {
  role: "user" | "assistant";
  content: string;
  showImageActions?: boolean;
};

type PreviewPlatform = "facebook" | "instagram" | "whatsapp" | "google";

const PREVIEW_TABS: { id: PreviewPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "google", label: "Google Business" },
];

/* ── Helpers ───────────────────────────────────────── */

function platformPostData(
  post: SocialPostFields,
  platforms: PlatformPosts | null,
  network: PreviewPlatform
) {
  const key = network === "google" ? "google_business" : network;
  const plat = platforms?.[key as keyof PlatformPosts];

  if (!plat) {
    return {
      headline: post.headline,
      body: post.body,
      hashtags: network === "instagram" ? post.hashtags : [],
      call_to_action: post.call_to_action,
    };
  }

  const lines = plat.text.split("\n").filter((l) => l.trim());
  return {
    headline: lines[0] || post.headline,
    body: lines.slice(1).join("\n") || post.body,
    hashtags: plat.hashtags ?? (network === "instagram" ? post.hashtags : []),
    call_to_action: plat.cta || post.call_to_action,
  };
}

function aspectRatioForPlatform(p: PreviewPlatform): string {
  if (p === "instagram") return "4:5";
  if (p === "google" || p === "facebook") return "16:9";
  return "1:1";
}

/* ── Component ─────────────────────────────────────── */

export function YonaView() {
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
  const [previewPlatform, setPreviewPlatform] =
    useState<PreviewPlatform>("instagram");

  /* Image state */
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
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

  const waPhone = page.whatsapp || "";
  const previewPost = currentPost
    ? platformPostData(currentPost, platforms, previewPlatform)
    : null;
  const waHref = waPhone
    ? buildWaInquiryLink(
        waPhone,
        buildWaOpenMessage(
          C.waOpenMsgTopic,
          previewPost?.headline || page.businessName
        )
      )
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
          message: text,
          brandGuidelines,
          businessProfile: profile || undefined,
          history: slidingHistory,
          previousImagePrompt: pendingImagePrompt,
        }),
        signal: AbortSignal.timeout(55_000),
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

      // Handle social_post → Live Preview + persistence
      if (socialPost) {
        setCurrentPost(socialPost);
        const plats =
          socialPost.platforms ?? derivePlatformsFromPost(socialPost);
        setPlatforms(plats);

        const saved = saveCurrentPost({
          headline: socialPost.headline,
          body: socialPost.body,
          cta: socialPost.call_to_action || "",
          hashtags: socialPost.hashtags,
          image_url: imageUrl,
          network: previewPlatform,
        });
        void syncCurrentPostToServer(saved);
      }

      // Handle image already returned
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
            network: previewPlatform,
          });
          void syncCurrentPostToServer(saved);
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
      setMessages((m) => [
        ...m,
        { role: "assistant", content: C.chatError },
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

    setImageLoading(true);
    setImagePending(false);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          purpose: "post",
          aspectRatio: aspectRatioForPlatform(previewPlatform),
          businessName: page.businessName,
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
      };
      if (data.image?.url && !data.fallback) {
        setImageUrl(data.image.url);
        if (currentPost) {
          const saved = saveCurrentPost({
            headline: currentPost.headline,
            body: currentPost.body,
            cta: currentPost.call_to_action || "",
            hashtags: currentPost.hashtags,
            image_url: data.image.url,
            image_seed: data.image.seed ?? null,
            image_prompt: data.image.prompt ?? null,
            network: previewPlatform,
          });
          void syncCurrentPostToServer(saved);
        }
      }
    } catch {
      /* soft fail */
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
          network: previewPlatform,
        });
        void syncCurrentPostToServer(saved);
      }
    };
    reader.readAsDataURL(file);
  }

  /* ── Copy platform text ──────────────────────────── */

  async function copyPlatformText() {
    if (!previewPost) return;
    let text = `${previewPost.headline}\n\n${previewPost.body}`;
    if (previewPost.hashtags?.length && previewPlatform === "instagram") {
      text += `\n\n${previewPost.hashtags.join(" ")}`;
    }
    if (previewPost.call_to_action) {
      text += `\n\n${previewPost.call_to_action}`;
    }
    if (previewPlatform === "whatsapp" && waHref) {
      text += `\n${waHref}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast(C.platformCopied);
    } catch {
      /* ignore */
    }
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
      {/* Platform tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PREVIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPreviewPlatform(tab.id)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${
              previewPlatform === tab.id
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <BrandGlyph
              id={tab.id === "google" ? "google" : tab.id}
              size={14}
            />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preview heading */}
      <p className="text-center text-base text-slate-800">
        {C.postCardPreview}
      </p>

      {/* Post card */}
      {previewPost ? (
        <PostCardPreview
          network={previewPlatform as SocialNetwork}
          businessName={page.businessName || C.myBiz}
          post={{
            headline: previewPost.headline,
            body: previewPost.body,
            hashtags: previewPost.hashtags,
            call_to_action: previewPost.call_to_action,
          }}
          imageUrl={imageUrl}
          imageLoading={imageLoading}
          waHref={waHref}
        />
      ) : (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-base text-slate-500">
          {C.yonaPartnerSub}
        </div>
      )}

      {/* Generate / copy buttons */}
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

      {previewPost && (
        <button
          type="button"
          onClick={() => void copyPlatformText()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-base font-medium text-slate-900 hover:bg-slate-50"
        >
          <Copy className="h-4 w-4 text-slate-600" />
          {C.copyPlatformText}
        </button>
      )}
    </div>
  );

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-x-hidden"
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

      {/* Desktop: side-by-side. Mobile: single column */}
      <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden lg:flex-row">
        {/* Chat column */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:flex-[1.2]">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
            {/* Header */}
            <div className="space-y-3 border-b border-slate-300 bg-white pb-4">
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
                      <Sparkles className="h-4 w-4 status-dot text-accent" />
                      {C.yonaWriting}
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
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || !prompt.trim()}
                  className="olar-cta flex h-14 w-14 shrink-0 items-center justify-center self-end rounded-2xl disabled:opacity-40"
                  aria-label={C.send}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>

              <ExampleChips
                disabled={busy}
                onSelect={(text) => {
                  setPrompt(text);
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

            {/* Mobile: preview below form */}
            <div className="pb-28 pt-4 lg:hidden">{previewCard}</div>
          </div>
        </section>

        {/* Desktop sticky Live Preview */}
        <aside className="hidden min-h-0 lg:flex lg:flex-[0.8] lg:flex-col">
          <div className="flex h-full flex-col lg:max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
            {previewCard}
          </div>
        </aside>
      </div>
    </div>
  );
}
