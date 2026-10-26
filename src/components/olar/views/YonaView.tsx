"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutomationMode,
  ContentIdea,
  SocialNetwork,
} from "@/lib/olar/types";
import {
  AUTOMATION_MODES,
  CONTENT_IDEAS,
  DEMO_POST,
  NETWORKS,
  PLATFORM_COPY,
  YONA_STARTER_MESSAGES,
} from "@/lib/olar/mock-data";
import {
  appendWaCta,
  buildWaInquiryLink,
  buildWaOpenMessage,
  hasFullAutomation,
  isPersonalPublish,
  useConnections,
} from "@/lib/olar/connections";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { ideaPromptText, takeYonaIdea } from "@/lib/olar/yona-idea";
import { C } from "@/lib/olar/ui-copy";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "@/lib/speech-types";
import { BrandGlyph } from "../NetworkBrand";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { ExampleChips } from "@/components/olar/ExampleChips";
import { Lightbulb, Mic, Send, Sparkles, Wrench } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
type PostState = {
  headline: string;
  body: string;
  hashtags: string[];
  call_to_action?: string;
  meta: (typeof PLATFORM_COPY)[string];
};

function buildPost(
  network: SocialNetwork,
  waPhone: string,
  idea?: ContentIdea | null,
  freeText?: string
): PostState {
  const rules = PLATFORM_COPY[network] ?? PLATFORM_COPY.instagram;
  const topic = idea?.title || freeText?.trim() || DEMO_POST.headline;
  const waMsg = buildWaOpenMessage(C.waOpenMsgTopic, topic);

  if (idea) {
    let body = idea.body;
    if (body.length > rules.maxChars) {
      body = body.slice(0, rules.maxChars - 1) + "...";
    }
    body += `\n\n${rules.contact}`;
    body = appendWaCta(body, waPhone, C.waCtaLine, waMsg);
    return {
      headline: idea.headline,
      body,
      hashtags: [...idea.hashtags, ...rules.hashtags].slice(0, 5),
      meta: rules,
    };
  }

  const lines = (freeText?.trim() || DEMO_POST.body).split("\n");
  const headline =
    freeText && freeText.trim().length > 0 && freeText.trim().length < 64
      ? lines[0]!.trim()
      : freeText?.trim()
        ? lines[0]!.trim().slice(0, 48)
        : DEMO_POST.headline;
  let body = lines.slice(1).join("\n").trim() || lines[0] || DEMO_POST.body;
  if (body.length > rules.maxChars) {
    body = body.slice(0, rules.maxChars - 1) + "...";
  }
  body += `\n\n${rules.contact}`;
  body = appendWaCta(body, waPhone, C.waCtaLine, waMsg);
  return {
    headline,
    body,
    hashtags: rules.hashtags,
    meta: rules,
  };
}

function applyFixTransform(
  post: PostState,
  instruction: string
): PostState {
  const lower = instruction.toLowerCase();
  let { headline, body } = post;

  const shortenRe = new RegExp(
    "\u05ea\u05e7\u05e6\u05e8|\u05e7\u05e6\u05e8|shorten|short",
    "i"
  );
  const dealRe = new RegExp(
    "\u05de\u05d1\u05e6\u05e2|\u05d4\u05e0\u05d7\u05d4|sale|deal",
    "i"
  );
  const waRe = new RegExp(
    "\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4|whatsapp",
    "i"
  );

  if (shortenRe.test(lower) || shortenRe.test(instruction)) {
    body = body
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 3)
      .join("\n");
    if (headline.length > 36) headline = headline.slice(0, 34) + "...";
  } else if (dealRe.test(lower) || dealRe.test(instruction)) {
    headline = headline + " \u2014 " + "\u05de\u05d1\u05e6\u05e2";
    body = "\u05de\u05d1\u05e6\u05e2 \u05d4\u05e9\u05d1\u05d5\u05e2!" + "\n" + body;
  } else if (waRe.test(lower) || waRe.test(instruction)) {
    body =
      body +
      "\n\n" +
      "\u05db\u05ea\u05d1\u05d5 \u05dc\u05e0\u05d5 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4 \u05dc\u05ea\u05d0\u05d5\u05dd \u05de\u05d4\u05d9\u05e8.";
  } else {
    body = body + "\n\n(" + instruction + ")";
  }

  return { ...post, headline, body };
}

export function YonaView() {
  const { networks } = useConnections();
  const { page } = useResolvedMyPage();
  const [network, setNetwork] = useState<SocialNetwork>("instagram");
  const [mode, setMode] = useState<AutomationMode>("semi");
  const [messages, setMessages] = useState<Msg[]>(YONA_STARTER_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeIdea, setActiveIdea] = useState<ContentIdea | null>(null);
  const [published, setPublished] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [listening, setListening] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState("");
  const [postOverride, setPostOverride] = useState<PostState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const basePromptRef = useRef("");
  const finalsRef = useRef("");
  const speechSupportedRef = useRef(false);

  const waPhone = networks.whatsapp.phone || page.whatsapp || "";
  const fullAuto = hasFullAutomation(networks, network);
  const personal = isPersonalPublish(networks, network);

  const livePost = useMemo(
    () => buildPost(network, waPhone, activeIdea, prompt),
    [network, waPhone, activeIdea, prompt]
  );

  const post = postOverride ?? livePost;

  const waHref = waPhone
    ? buildWaInquiryLink(
        waPhone,
        buildWaOpenMessage(C.waOpenMsgTopic, post.headline)
      )
    : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!guide) return;
    const t = setTimeout(() => setGuide(false), 2000);
    return () => clearTimeout(t);
  }, [guide]);

  const selectIdea = useCallback((idea: ContentIdea) => {
    setPublished(false);
    setPostOverride(null);
    setActiveIdea(idea);
    setPrompt(ideaPromptText(idea));
    inputRef.current?.focus();
  }, []);

  const applyStashedIdea = useCallback(() => {
    const stashed = takeYonaIdea();
    if (!stashed) return;
    const match = CONTENT_IDEAS.find((i) => i.id === stashed.id);
    if (match) {
      selectIdea(match);
      return;
    }
    setPublished(false);
    setPostOverride(null);
    setActiveIdea(null);
    setPrompt(ideaPromptText(stashed));
    inputRef.current?.focus();
  }, [selectIdea]);

  useEffect(() => {
    applyStashedIdea();
    const onFocus = () => applyStashedIdea();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [applyStashedIdea]);

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

  function onPromptChange(value: string) {
    setPrompt(value);
    setPublished(false);
    setPostOverride(null);
    if (activeIdea) {
      const expected = ideaPromptText(activeIdea);
      if (value !== expected) setActiveIdea(null);
    }
  }

  async function generatePostImage() {
    const desc = prompt.trim() || post.headline || post.body;
    if (!desc) return;
    setImageLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          purpose: "post",
          aspectRatio: network === "google" ? "16:9" : "16:9",
          businessName: page.businessName,
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: { url?: string };
      };
      if (data.image?.url) setImageUrl(data.image.url);
    } catch {
      /* soft fail */
    } finally {
      setImageLoading(false);
    }
  }

  async function send() {
    const text = prompt.trim();
    if (!text || busy) return;
    setPublished(false);
    setPostOverride(null);
    setActiveIdea(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `${C.wroteShort}${PLATFORM_COPY[network].label} ${C.lookPreview}`,
      },
    ]);
    setBusy(false);
    void generatePostImage();
  }

  function applyFix() {
    const instruction = fixText.trim();
    if (!instruction) return;
    const next = applyFixTransform(post, instruction);
    setPostOverride(next);
    setPrompt(`${next.headline}\n${next.body.split("\n\n")[0] ?? next.body}`);
    setActiveIdea(null);
    setFixText("");
    setFixOpen(false);
  }

  function publishAuto() {
    setPublished(true);
    setToast(C.publishAutoOk);
    const modeLabel =
      AUTOMATION_MODES.find((x) => x.id === mode)?.label ?? "";
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `${C.markedPublish}${post.meta.label}. ${C.inMode} "${modeLabel}" - ${C.asYouChose}`,
      },
    ]);
  }

  async function publishPersonal() {
    const text = `${post.headline}\n\n${post.body}\n\n${post.hashtags.join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setGuide(true);
    setPublished(true);
    if (network === "facebook") {
      window.open("https://www.facebook.com/", "_blank");
    } else {
      window.open("https://www.instagram.com/", "_blank");
    }
  }

  function publishFallback() {
    setPublished(true);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `${C.markedPublish}${post.meta.label}. ${C.asYouChose}`,
      },
    ]);
  }

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
      const next = [base, spoken].filter(Boolean).join(base && spoken ? "\n" : "");
      onPromptChange(next);
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
        onPromptChange(next);
        inputRef.current?.focus();
      }
      return;
    }
    startSpeech();
  }

  const personalLabel =
    network === "facebook" ? C.copyOpenFb : C.copyOpenIg;

  function doPublish() {
    if (fullAuto) publishAuto();
    else if (personal) void publishPersonal();
    else publishFallback();
  }

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
        onClick={doPublish}
        className={`hidden min-h-12 w-full items-center justify-center rounded-2xl text-lg font-medium text-white hover:opacity-90 lg:flex ${
          fullAuto
            ? "bg-emerald-600"
            : personal
              ? "bg-accent"
              : "bg-slate-900"
        }`}
      >
        {published
          ? C.readyPublish
          : fullAuto
            ? C.publishAutoNow
            : personal
              ? personalLabel
              : `${C.confirmPublish}${post.meta.label}`}
      </button>
    </div>
  );

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-x-hidden"
      dir="rtl"
    >
      {toast && (
        <div className="pointer-events-none fixed start-1/2 top-20 z-[70] -translate-x-1/2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-medium text-white shadow-md">
          {toast}
        </div>
      )}
      {guide && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-6"
          onClick={() => setGuide(false)}
        >
          <div className="w-full max-w-md break-words rounded-3xl bg-white p-6 text-center text-lg font-medium text-slate-950 shadow-md">
            {C.personalGuide}
          </div>
        </div>
      )}

      {/* Desktop: side-by-side. Mobile: single column, preview below */}
      <div className="flex h-[calc(100vh-80px)] min-h-0 w-full flex-col gap-6 overflow-hidden lg:grid lg:grid-cols-12">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:col-span-7 xl:col-span-8">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
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

              <div className="flex gap-2 overflow-x-auto pb-1">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNetwork(n.id);
                      setPostOverride(null);
                    }}
                    className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-base font-medium ${
                      network === n.id
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-800"
                    }`}
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
                    className={`min-h-12 shrink-0 rounded-xl px-4 text-base font-medium ${
                      mode === m.id
                        ? "bg-accent text-white"
                        : "border border-slate-300 bg-white text-slate-800"
                    }`}
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
                      className={`min-h-[5rem] min-w-[12rem] max-w-[15rem] shrink-0 cursor-pointer rounded-2xl border px-4 py-3 text-right shadow-md transition hover:border-sky-600 hover:shadow-lg ${
                        activeIdea?.id === idea.id
                          ? "border-sky-600 bg-sky-50 ring-2 ring-sky-600"
                          : "border-slate-300 bg-white"
                      }`}
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

            <div className="space-y-3" dir="rtl">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "assistant" ? "justify-start" : "justify-end"
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

            <div className="space-y-3 border-t border-slate-300 bg-white py-4">
              <div className="flex min-w-0 gap-2" dir="rtl">
                <textarea
                  ref={inputRef}
                  dir="rtl"
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={C.placeholder}
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
                  onPromptChange(text);
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

                <button
                  type="button"
                  onClick={() => setFixOpen((v) => !v)}
                  disabled={busy}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-base font-medium text-slate-900 hover:bg-sky-50"
                >
                  <Wrench className="h-4 w-4 text-accent" />
                  {C.fixPostBtn}
                </button>
              </div>

              {fixOpen && (
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-right text-sm font-medium text-slate-800">
                    {C.fixPostHint}
                    <input
                      dir="rtl"
                      value={fixText}
                      onChange={(e) => setFixText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyFix();
                        }
                      }}
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-right text-base text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyFix}
                    disabled={!fixText.trim()}
                    className="olar-cta min-h-12 shrink-0 rounded-xl px-5 text-base disabled:opacity-40"
                  >
                    {C.fixPostApply}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: preview naturally below form */}
            <div className="border-t border-slate-200 pb-28 pt-4 lg:hidden">
              {previewCard}
            </div>
          </div>
        </section>

        {/* Desktop sticky preview */}
        <aside className="hidden min-h-0 overflow-hidden lg:col-span-5 lg:block xl:col-span-4">
          <div className="h-full overflow-y-auto overscroll-contain p-1">
            <div className="sticky top-0">{previewCard}</div>
          </div>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-14 z-30 border-t border-slate-300 bg-white/95 px-3 py-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={doPublish}
          className={`flex min-h-12 w-full items-center justify-center rounded-2xl text-lg font-medium text-white ${
            fullAuto
              ? "bg-emerald-600"
              : personal
                ? "bg-accent"
                : "bg-slate-900"
          }`}
        >
          {published
            ? C.readyPublish
            : fullAuto
              ? C.publishAutoNow
              : personal
                ? personalLabel
                : `${C.confirmUpload}${post.meta.label}`}
        </button>
      </div>
    </div>
  );
}
