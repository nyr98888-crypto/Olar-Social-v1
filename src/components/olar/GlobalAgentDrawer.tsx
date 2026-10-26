"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useClientAuth } from "@/lib/olar/auth-client";
import {
  loadCurrentPost,
  saveCurrentPost,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { C } from "@/lib/olar/ui-copy";
import {
  Send,
  Sparkles,
  X,
  ChevronDown,
  Clapperboard,
} from "lucide-react";
import { PostCardPreview } from "./PostCardPreview";
import type { OlarView } from "@/lib/olar/types";

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
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  social_post?: {
    headline: string;
    body: string;
    hashtags: string[];
    call_to_action?: string;
  } | null;
  image_url?: string | null;
  image_seed?: number | null;
  image_prompt?: string | null;
  intent?: string;
};

type Props = {
  activeView: OlarView;
  onNavigateToStudio?: () => void;
};

export function GlobalAgentDrawer({ activeView, onNavigateToStudio }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [previousImagePrompt, setPreviousImagePrompt] = useState<
    string | null
  >(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { page } = useResolvedMyPage();
  const { isGuest } = useClientAuth();
  const prevViewRef = useRef(activeView);

  /* Auto-scroll chat */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  /* Focus input on open */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  /* Add greeting when view changes while drawer is open */
  useEffect(() => {
    if (prevViewRef.current !== activeView && open && messages.length === 0) {
      const greeting = VIEW_GREETINGS[activeView] ?? VIEW_GREETINGS.home;
      setMessages([
        {
          id: `greeting-${Date.now()}`,
          role: "assistant",
          content: greeting,
        },
      ]);
    }
    prevViewRef.current = activeView;
  }, [activeView, open, messages.length]);

  /* Add greeting on first open */
  const handleOpen = useCallback(() => {
    setOpen(true);
    if (messages.length === 0) {
      const greeting = VIEW_GREETINGS[activeView] ?? VIEW_GREETINGS.home;
      setMessages([
        {
          id: `greeting-${Date.now()}`,
          role: "assistant",
          content: greeting,
        },
      ]);
    }
  }, [messages.length, activeView]);

  /* Send message to /api/chat */
  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Msg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);

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

      const assistantMsg: Msg = {
        id: data.message?.id ?? `asst-${Date.now()}`,
        role: "assistant",
        content:
          data.message?.content ?? data.output?.chat_reply ?? "סליחה, משהו השתבש. נסו שוב.",
        social_post: data.message?.social_post ?? data.output?.social_post ?? null,
        image_url: data.message?.image_url ?? data.image?.url ?? null,
        image_seed: data.message?.image_seed ?? data.image?.seed ?? null,
        image_prompt:
          data.message?.image_prompt ?? data.image?.prompt ?? null,
        intent: data.message?.intent ?? data.output?.intent,
      };

      if (assistantMsg.image_prompt) {
        setPreviousImagePrompt(assistantMsg.image_prompt);
      }

      setMessages((m) => [...m, assistantMsg]);

      /* Deferred image fetch when imagePending */
      if (data.imagePending && assistantMsg.image_prompt) {
        void fetchDeferredImage(
          assistantMsg.id,
          assistantMsg.image_prompt,
          assistantMsg.social_post
        );
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "סליחה, לא הצלחתי להתחבר. נסו שוב בעוד רגע.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function fetchDeferredImage(
    msgId: string,
    imagePrompt: string,
    socialPost: Msg["social_post"]
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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  image_url: data.image!.url!,
                  image_seed: data.image!.seed ?? null,
                  image_prompt: data.image!.prompt ?? imagePrompt,
                }
              : m
          )
        );
      }
    } catch {
      /* soft fail */
    }
  }

  /* Save social_post to current_business_post and navigate to studio */
  function openInStudio(msg: Msg) {
    if (!msg.social_post) return;
    const saved = saveCurrentPost({
      headline: msg.social_post.headline,
      body: msg.social_post.body,
      cta: msg.social_post.call_to_action || "",
      hashtags: msg.social_post.hashtags,
      image_url: msg.image_url ?? null,
      image_seed: msg.image_seed ?? null,
      image_prompt: msg.image_prompt ?? null,
    });
    void syncCurrentPostToServer(saved);
    setOpen(false);
    onNavigateToStudio?.();
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
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-sky-600/30 transition-transform group-hover:scale-105">
            {/* Avatar — Yona marketing manager */}
            <span className="text-2xl" role="img" aria-label="יונה">
              👩‍💼
            </span>
            {/* Green "connected" badge */}
            <span className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
          </div>
          {/* Hover label — desktop only */}
          <span className="hidden rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-md group-hover:block">
            דבר איתי
          </span>
        </button>
      )}

      {/* ——— Backdrop ——— */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 ${
          open
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* ——— Desktop: side drawer from start (right in RTL) ——— */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 hidden w-[min(100%,400px)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:flex ${
          open ? "translate-x-0" : "pointer-events-none -translate-x-full rtl:translate-x-full"
        }`}
        role="dialog"
        aria-modal={open}
        aria-label="צ׳אט עם יונה"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
              <span className="text-xl">👩‍💼</span>
              <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-slate-950">
                {C.yonaTitle}
              </p>
              <p className="text-xs text-emerald-600 font-medium">מחוברת</p>
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

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3" dir="rtl">
          {messages.map((msg) => (
            <div key={msg.id}>
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

              {/* social_post preview card */}
              {msg.role === "assistant" && msg.social_post && (
                <div className="mt-2 space-y-2">
                  <PostCardPreview
                    network="instagram"
                    businessName={page.businessName || C.myBiz}
                    post={{
                      headline: msg.social_post.headline,
                      body: msg.social_post.body,
                      hashtags: msg.social_post.hashtags,
                      call_to_action: msg.social_post.call_to_action,
                    }}
                    imageUrl={msg.image_url}
                    imageLoading={!msg.image_url && !!msg.image_prompt}
                    className="max-w-full"
                  />
                  {onNavigateToStudio && (
                    <button
                      type="button"
                      onClick={() => openInStudio(msg)}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
                    >
                      <Clapperboard className="h-4 w-4" />
                      פתח וערוך בסטודיו
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3" dir="rtl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
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
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
              aria-label={C.send}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ——— Mobile: bottom sheet ——— */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          open
            ? "translate-y-0"
            : "pointer-events-none translate-y-full"
        }`}
        style={{ height: "85dvh", maxHeight: "85dvh" }}
        role="dialog"
        aria-modal={open}
        aria-label="צ׳אט עם יונה"
        aria-hidden={!open}
      >
        {/* Drag handle + header */}
        <div className="shrink-0">
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
                <span className="text-lg">👩‍💼</span>
                <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-950">
                  {C.yonaTitle}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium">
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

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3" dir="rtl">
          {messages.map((msg) => (
            <div key={msg.id}>
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

              {msg.role === "assistant" && msg.social_post && (
                <div className="mt-2 space-y-2">
                  <PostCardPreview
                    network="instagram"
                    businessName={page.businessName || C.myBiz}
                    post={{
                      headline: msg.social_post.headline,
                      body: msg.social_post.body,
                      hashtags: msg.social_post.hashtags,
                      call_to_action: msg.social_post.call_to_action,
                    }}
                    imageUrl={msg.image_url}
                    imageLoading={!msg.image_url && !!msg.image_prompt}
                    className="max-w-full"
                  />
                  {onNavigateToStudio && (
                    <button
                      type="button"
                      onClick={() => openInStudio(msg)}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
                    >
                      <Clapperboard className="h-4 w-4" />
                      פתח וערוך בסטודיו
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="safe-bottom shrink-0 border-t border-slate-200 bg-white p-3" dir="rtl">
          <div className="flex items-end gap-2">
            <textarea
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
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
              aria-label={C.send}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
