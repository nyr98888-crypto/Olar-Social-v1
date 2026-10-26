"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useClientAuth } from "@/lib/olar/auth-client";
import {
  loadCurrentPost,
  saveCurrentPost,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { C } from "@/lib/olar/ui-copy";
import {
  Sparkles,
  X,
  ChevronDown,
  Clapperboard,
} from "lucide-react";
import { PostCardPreview } from "./PostCardPreview";
import { AgentAvatar } from "./AgentAvatar";
import { AiSendButton } from "./AiSendButton";
import type { OlarView } from "@/lib/olar/types";
import { VAR_1_LABEL, VAR_2_LABEL } from "@/lib/olar/ab-variations";
import {
  appendStudioMessage,
  setStudioLoading,
  setStudioVariations,
  updateVariationImage,
  useSelectedVariation,
  useStudioStore,
} from "@/lib/store";

/* ——— Route-context view labels ——— */
const VIEW_LABELS: Record<string, string> = {
  home: "מסך הבית",
  yona: "צ׳אט עם יונה",
  studio: "הסטודיו",
  calendar: "יומן פרסום",
  leads: "לידים ופניות",
  reviews: "ביקורות",
  analytics: "אנליטיקה",
  mypage: "הדף שלי",
  settings: "חיבור רשתות",
  dna: "DNA העסק",
};

const VIEW_GREETINGS: Record<string, string> = {
  home: "היי! מה נעשה היום?",
  yona: "היי! אני כאן — ספרו לי מה חדש בעסק.",
  studio: "רוצה ליצור תמונה חדשה או לערוך את הפוסט?",
  calendar: "צריך עזרה לתכנן את הפרסומים השבוע?",
  leads: "רוצה שאעזור לך לענות למישהו?",
  reviews: "רוצה תשובה מנוסחת לביקורת?",
  analytics: "רוצה שנמצא מה עבד הכי טוב השבוע?",
  mypage: "רוצה לשנות משהו בדף שלך?",
  settings: "צריך עזרה עם חיבור רשת?",
  dna: "רוצה לעדכן את ה-DNA של העסק?",
};

type Props = {
  activeView: OlarView;
  onNavigateToStudio?: () => void;
};

export function GlobalAgentDrawer({ activeView, onNavigateToStudio }: Props) {
  const studio = useStudioStore();
  const selected = useSelectedVariation();
  const busy = studio.isLoading;
  const messages = studio.messages;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [previousImagePrompt, setPreviousImagePrompt] = useState<
    string | null
  >(null);
  /** Ephemeral route hello — never written to studio store */
  const [routeGreeting, setRouteGreeting] = useState<string | null>(null);
  const [imagePending, setImagePending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const endRefMobile = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { page } = useResolvedMyPage();
  const { isGuest } = useClientAuth();
  const prevViewRef = useRef(activeView);

  /* Auto-scroll chat */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    endRefMobile.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, routeGreeting, selected?.imageUrl, imagePending]);

  /* Focus input on open */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  /* Drop local greeting once store has real chat (e.g. from Studio) */
  useEffect(() => {
    if (messages.length > 0) setRouteGreeting(null);
  }, [messages.length]);

  /* Soft greeting when view changes while open and store is empty */
  useEffect(() => {
    if (prevViewRef.current !== activeView && open && messages.length === 0) {
      setRouteGreeting(VIEW_GREETINGS[activeView] ?? VIEW_GREETINGS.home);
    }
    prevViewRef.current = activeView;
  }, [activeView, open, messages.length]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (messages.length === 0) {
      setRouteGreeting(VIEW_GREETINGS[activeView] ?? VIEW_GREETINGS.home);
    } else {
      setRouteGreeting(null);
    }
  }, [messages.length, activeView]);

  function writeCampaignToStore(opts: {
    headline: string;
    body: string;
    cta?: string;
    hashtags?: string[];
    imageUrl?: string | null;
    imagePrompt?: string | null;
  }) {
    const headline = opts.headline.trim();
    const bodyText = opts.body.trim();
    if (!headline || !bodyText) return;

    const imageUrl = opts.imageUrl || "";
    const imagePrompt = opts.imagePrompt || "";
    const cta1 = (opts.cta || "").trim() || "להזמנה מהירה בוואטסאפ";
    setStudioVariations([
      {
        id: "var_1",
        label: VAR_1_LABEL,
        headline,
        bodyText,
        imageUrl,
        imagePrompt,
        ctaButton: cta1,
      },
      {
        id: "var_2",
        label: VAR_2_LABEL,
        headline,
        bodyText,
        imageUrl,
        imagePrompt,
        ctaButton: "לפרטים ותיאום ישיר",
      },
    ]);

    const saved = saveCurrentPost({
      headline,
      body: bodyText,
      cta: cta1,
      hashtags: opts.hashtags || [],
      image_url: opts.imageUrl ?? null,
      image_prompt: opts.imagePrompt ?? null,
    });
    void syncCurrentPostToServer(saved);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setRouteGreeting(null);
    setInput("");
    appendStudioMessage({ role: "user", content: text });
    setStudioLoading(true);

    try {
      const profileRaw = localStorage.getItem("olar-business-profile");
      let businessProfile = null;
      try {
        businessProfile = profileRaw ? JSON.parse(profileRaw) : null;
      } catch {
        /* ignore */
      }

      const history = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const routeLabel = VIEW_LABELS[activeView] ?? activeView;
      const routeHint = `[המשתמש נמצא כרגע במסך: ${routeLabel}]`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          history: isGuest ? history : undefined,
          previousImagePrompt,
          businessProfile: isGuest ? businessProfile : undefined,
          routeContext: activeView,
          routeHint,
        }),
        signal: AbortSignal.timeout(55_000),
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const reply =
        data.message?.content ??
        data.output?.chat_reply ??
        "סליחה, משהו השתבש. נסו שוב.";
      appendStudioMessage({ role: "assistant", content: reply });

      const socialPost =
        data.message?.social_post ?? data.output?.social_post ?? null;
      const imageUrl =
        data.message?.image_url ?? data.image?.url ?? null;
      const imagePrompt =
        data.message?.image_prompt ?? data.image?.prompt ?? null;

      if (imagePrompt) {
        setPreviousImagePrompt(imagePrompt);
      }

      if (socialPost?.headline?.trim() && socialPost?.body?.trim()) {
        writeCampaignToStore({
          headline: socialPost.headline,
          body: socialPost.body,
          cta: socialPost.call_to_action || "",
          hashtags: socialPost.hashtags,
          imageUrl,
          imagePrompt,
        });
      }

      if (data.imagePending && imagePrompt) {
        setImagePending(true);
        void fetchDeferredImage(imagePrompt, socialPost);
      }
    } catch {
      appendStudioMessage({
        role: "assistant",
        content: "סליחה, לא הצלחתי להתחבר. נסו שוב בעוד רגע.",
      });
    } finally {
      setStudioLoading(false);
    }
  }

  async function fetchDeferredImage(
    imagePrompt: string,
    socialPost: {
      headline?: string;
      body?: string;
      hashtags?: string[];
      call_to_action?: string;
    } | null
  ) {
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: imagePrompt,
          purpose: "post",
          aspectRatio: "1:1",
          businessName: page.businessName,
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json()) as {
        fallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
      };
      if (data.image?.url && !data.fallback) {
        const url = data.image.url;
        const prompt = data.image.prompt ?? imagePrompt;
        updateVariationImage(0, { imageUrl: url, imagePrompt: prompt });
        updateVariationImage(1, { imageUrl: url, imagePrompt: prompt });
        setPreviousImagePrompt(prompt);

        const cur = loadCurrentPost();
        const saved = saveCurrentPost({
          headline: socialPost?.headline || cur?.headline || "",
          body: socialPost?.body || cur?.body || "",
          cta: socialPost?.call_to_action || cur?.cta || "",
          hashtags: socialPost?.hashtags || cur?.hashtags || [],
          image_url: url,
          image_prompt: prompt,
        });
        void syncCurrentPostToServer(saved);
      }
    } catch {
      /* soft fail */
    } finally {
      setImagePending(false);
    }
  }

  function openInStudio() {
    if (!selected) return;
    const saved = saveCurrentPost({
      headline: selected.headline,
      body: selected.bodyText,
      cta: selected.ctaButton || "",
      hashtags: loadCurrentPost()?.hashtags || [],
      image_url: selected.imageUrl || null,
      image_prompt: selected.imagePrompt || null,
    });
    void syncCurrentPostToServer(saved);
    setOpen(false);
    onNavigateToStudio?.();
  }

  function renderChatBody(scrollRef: RefObject<HTMLDivElement | null>) {
    return (
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
        dir="rtl"
      >
        {routeGreeting ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] break-words rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm leading-relaxed text-slate-800">
              {routeGreeting}
            </div>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}>
            <div
              className={`flex ${
                msg.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-right text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Shared studio preview — never a divergent local-only post */}
        {selected ? (
          <div className="mt-2 space-y-2">
            <PostCardPreview
              network="instagram"
              businessName={page.businessName || C.myBiz}
              post={{
                headline: selected.headline,
                body: selected.bodyText,
                hashtags: loadCurrentPost()?.hashtags || [],
                call_to_action: selected.ctaButton,
              }}
              imageUrl={selected.imageUrl || null}
              imageLoading={
                imagePending ||
                (!selected.imageUrl && !!selected.imagePrompt)
              }
              className="max-w-full"
            />
            {onNavigateToStudio && (
              <button
                type="button"
                onClick={openInStudio}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
              >
                <Clapperboard className="h-4 w-4" />
                פתח וערוך בסטודיו
              </button>
            )}
          </div>
        ) : null}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-pulse text-accent" />
                {C.yonaWriting}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    );
  }

  function renderInput(ref?: RefObject<HTMLTextAreaElement | null>) {
    return (
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          dir="rtl"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={C.yonaChatPlaceholder}
          rows={1}
          className="min-h-[44px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-sm text-slate-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          disabled={busy}
        />
        <AiSendButton
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          loading={busy}
          title={C.send}
        />
      </div>
    );
  }

  return (
    <>
      {/* ——— FAB ——— */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          className="group fixed bottom-20 start-6 z-50 flex items-center gap-2 md:bottom-6"
          aria-label="דבר איתי"
        >
          <div className="transition-transform group-hover:scale-105">
            <AgentAvatar size="lg" />
          </div>
          <span className="hidden rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-md group-hover:block">
            דבר איתי
          </span>
        </button>
      )}

      {/* ——— Backdrop ——— */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* ——— Desktop: side drawer ——— */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 hidden w-[min(100%,400px)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:flex ${
          open
            ? "translate-x-0"
            : "pointer-events-none -translate-x-full rtl:translate-x-full"
        }`}
        role="dialog"
        aria-modal={open}
        aria-label="צ׳אט עם יונה"
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <AgentAvatar size="md" />
            <div className="text-right">
              <p className="text-base font-bold text-slate-950">{C.yonaTitle}</p>
              <p className="text-xs font-medium text-emerald-600">מחוברת</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label={C.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {renderChatBody(endRef)}

        <div className="shrink-0 border-t border-slate-200 bg-white p-3" dir="rtl">
          {renderInput(inputRef)}
        </div>
      </aside>

      {/* ——— Mobile: bottom sheet ——— */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
        style={{ height: "85dvh", maxHeight: "85dvh" }}
        role="dialog"
        aria-modal={open}
        aria-label="צ׳אט עם יונה"
        aria-hidden={!open}
      >
        <div className="shrink-0">
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-3">
            <div className="flex items-center gap-3">
              <AgentAvatar size="sm" />
              <div className="text-right">
                <p className="text-sm font-bold text-slate-950">{C.yonaTitle}</p>
                <p className="text-[11px] font-medium text-emerald-600">
                  מחוברת
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
              aria-label={C.close}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        {renderChatBody(endRefMobile)}

        <div
          className="safe-bottom shrink-0 border-t border-slate-200 bg-white p-3"
          dir="rtl"
        >
          {renderInput()}
        </div>
      </div>
    </>
  );
}
