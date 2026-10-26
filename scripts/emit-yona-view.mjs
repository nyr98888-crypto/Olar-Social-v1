import fs from "fs";

const body = `"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  buildWaOpenMessage,
  hasFullAutomation,
  isPersonalPublish,
  useConnections,
} from "@/lib/olar/connections";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "../NetworkBrand";
import { BadgeCheck, Lightbulb, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
type MobileTab = "create" | "preview";
type PostState = {
  headline: string;
  body: string;
  hashtags: string[];
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
    body += \`\\n\\n\${rules.contact}\`;
    body = appendWaCta(body, waPhone, C.waCtaLine, waMsg);
    return {
      headline: idea.headline,
      body,
      hashtags: [...idea.hashtags, ...rules.hashtags].slice(0, 5),
      meta: rules,
    };
  }

  const core = freeText?.trim() || DEMO_POST.body.split("\\n")[0];
  let body = \`\${core}\`;
  if (body.length > rules.maxChars) {
    body = body.slice(0, rules.maxChars - 1) + "...";
  }
  body += \`\\n\\n\${rules.contact}\`;
  body = appendWaCta(body, waPhone, C.waCtaLine, waMsg);
  return {
    headline:
      freeText && freeText.length < 48 ? freeText : DEMO_POST.headline,
    body,
    hashtags: rules.hashtags,
    meta: rules,
  };
}

function PhonePreview({
  network,
  post,
}: {
  network: SocialNetwork;
  post: PostState;
}) {
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="overflow-hidden rounded-[2.25rem] border-[12px] border-slate-900 bg-white shadow-[var(--shadow)]">
        <div className="flex items-center justify-center bg-slate-900 py-2.5">
          <div className="h-1.5 w-16 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center gap-2 border-b border-line px-3 py-3">
          <div className="h-9 w-9 rounded-full bg-accent-soft" />
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-base font-semibold text-slate-900">
              {C.myBiz}
            </p>
            <p className="text-sm text-slate-800">{post.meta.label}</p>
          </div>
          <BrandGlyph
            id={
              network === "reels"
                ? "instagram"
                : network === "twitter"
                  ? "twitter"
                  : network
            }
            size={18}
          />
        </div>
        <div className="aspect-[4/5] bg-gradient-to-br from-accent-soft via-slate-100 to-white p-5">
          <div className="flex h-full flex-col justify-end rounded-2xl bg-white/90 p-4">
            <p
              className="text-right text-xl leading-snug text-slate-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {post.headline}
            </p>
            <p className="mt-2 text-sm text-slate-800">{C.imgReady}</p>
          </div>
        </div>
        <div className="space-y-2 px-4 py-4 text-right">
          <p className="whitespace-pre-line text-base leading-relaxed text-slate-900">
            {post.body}
          </p>
          <p className="text-sm leading-relaxed text-accent">
            {post.hashtags.join(" ")}
          </p>
        </div>
        <div className="flex justify-center bg-slate-900 py-2.5">
          <div className="h-1 w-28 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  );
}

export function YonaView() {
  const { networks } = useConnections();
  const [network, setNetwork] = useState<SocialNetwork>("instagram");
  const [mode, setMode] = useState<AutomationMode>("semi");
  const [messages, setMessages] = useState<Msg[]>(YONA_STARTER_MESSAGES);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeIdea, setActiveIdea] = useState<ContentIdea | null>(null);
  const [freeTopic, setFreeTopic] = useState<string | undefined>();
  const [mobileTab, setMobileTab] = useState<MobileTab>("create");
  const [published, setPublished] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const waPhone = networks.whatsapp.phone || "050-0000000";
  const fullAuto = hasFullAutomation(networks, network);
  const personal = isPersonalPublish(networks, network);

  const post = useMemo(
    () => buildPost(network, waPhone, activeIdea, freeTopic),
    [network, waPhone, activeIdea, freeTopic]
  );

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

  async function applyIdea(idea: ContentIdea) {
    setPublished(false);
    setActiveIdea(idea);
    setFreeTopic(undefined);
    setMessages((m) => [
      ...m,
      { role: "user", content: \`\${C.pleaseIdea} \${idea.title}\` },
    ]);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: \`\${C.madePost}\${PLATFORM_COPY[network].label}: "\${idea.headline}" \${C.withTextImg}\`,
      },
    ]);
    setBusy(false);
    setMobileTab("preview");
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPublished(false);
    setActiveIdea(null);
    setFreeTopic(text);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: \`\${C.wroteShort}\${PLATFORM_COPY[network].label} \${C.lookPreview}\`,
      },
    ]);
    setBusy(false);
    setMobileTab("preview");
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
        content: \`\${C.markedPublish}\${post.meta.label}. \${C.inMode} "\${modeLabel}" - \${C.asYouChose}\`,
      },
    ]);
  }

  async function publishPersonal() {
    const text = \`\${post.headline}\\n\\n\${post.body}\\n\\n\${post.hashtags.join(" ")}\`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    // Mock image download
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, 0, 400, 500);
        ctx.fillStyle = "#0f172a";
        ctx.font = "20px sans-serif";
        ctx.fillText(post.headline.slice(0, 28), 24, 60);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "olar-post.png";
        a.click();
      }
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
        content: \`\${C.markedPublish}\${post.meta.label}. \${C.asYouChose}\`,
      },
    ]);
  }

  const personalLabel =
    network === "facebook" ? C.copyOpenFb : C.copyOpenIg;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col" dir="rtl">
      {toast && (
        <div className="fixed start-1/2 top-20 z-[70] -translate-x-1/2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-medium text-white shadow-[var(--shadow)]">
          {toast}
        </div>
      )}
      {guide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center text-lg font-medium text-slate-900 shadow-[var(--shadow)]">
            {C.personalGuide}
          </div>
        </div>
      )}

      <div className="w-full shrink-0 space-y-3 border-b border-line bg-white px-6 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-4 text-sm font-semibold text-accent">
            <BadgeCheck className="h-4 w-4" />
            {C.humanNotBot}
          </span>
          <h1
            className="text-2xl font-semibold text-slate-900 sm:text-3xl"
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
              onClick={() => setNetwork(n.id)}
              className={\`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-base font-medium \${
                network === n.id
                  ? "bg-slate-900 text-white"
                  : "border border-line bg-white text-slate-800"
              }\`}
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
              className={\`min-h-12 shrink-0 rounded-xl px-4 text-base font-medium \${
                mode === m.id
                  ? "bg-accent text-white"
                  : "border border-line bg-white text-slate-800"
              }\`}
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
                onClick={() => void applyIdea(idea)}
                className={\`min-h-[5rem] min-w-[12rem] max-w-[15rem] shrink-0 rounded-2xl border px-4 py-3 text-right transition \${
                  activeIdea?.id === idea.id
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-white hover:bg-slate-50"
                }\`}
              >
                <p className="text-base font-semibold text-slate-900">
                  {idea.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                  {idea.blurb}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 md:hidden">
          {(
            [
              { id: "create" as const, label: C.write },
              { id: "preview" as const, label: C.howLooks },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobileTab(t.id)}
              className={\`min-h-12 rounded-lg text-base font-medium \${
                mobileTab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-800"
              }\`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 w-full flex-1 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <section
          className={\`flex min-h-0 flex-col border-line lg:border-e \${
            mobileTab === "create" ? "flex" : "hidden md:flex"
          }\`}
        >
          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5 lg:px-8"
            dir="rtl"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={\`flex \${
                  msg.role === "assistant" ? "justify-start" : "justify-end"
                }\`}
              >
                <div
                  className={\`max-w-[88%] rounded-2xl px-4 py-3 text-right text-base leading-relaxed \${
                    msg.role === "user"
                      ? "bg-slate-900 text-white"
                      : "border border-line bg-slate-50 text-slate-900"
                  }\`}
                  style={{ textAlign: "right" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-right text-base text-slate-800">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 status-dot text-accent" />
                    {C.yonaWriting}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="shrink-0 border-t border-line bg-white p-4 px-6 lg:px-8">
            <div className="flex gap-2" dir="rtl">
              <input
                dir="rtl"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={C.placeholder}
                className="min-h-14 flex-1 rounded-xl border border-line bg-slate-50 px-4 text-right text-base text-slate-900 outline-none focus:border-accent"
                style={{ textAlign: "right" }}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
                aria-label={C.send}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        <section
          className={\`min-h-0 overflow-y-auto bg-slate-100 px-6 py-6 lg:px-8 \${
            mobileTab === "preview" ? "block" : "hidden md:block"
          }\`}
        >
          <p className="mb-4 text-center text-base text-slate-800">
            {C.phonePreview} | {post.meta.label}
          </p>
          <PhonePreview network={network} post={post} />
          <button
            type="button"
            onClick={() => {
              if (fullAuto) publishAuto();
              else if (personal) void publishPersonal();
              else publishFallback();
            }}
            className={\`mx-auto mt-6 flex min-h-14 w-full max-w-[380px] items-center justify-center rounded-2xl text-lg font-medium text-white hover:opacity-90 \${
              fullAuto
                ? "bg-emerald-600"
                : personal
                  ? "bg-blue-600"
                  : "bg-slate-900"
            }\`}
          >
            {published
              ? C.readyPublish
              : fullAuto
                ? C.publishAutoNow
                : personal
                  ? personalLabel
                  : \`\${C.confirmPublish}\${post.meta.label}\`}
          </button>
        </section>
      </div>

      <div className="safe-bottom sticky bottom-14 z-30 border-t border-line bg-white/95 px-6 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => {
            setMobileTab("preview");
            if (fullAuto) publishAuto();
            else if (personal) void publishPersonal();
            else publishFallback();
          }}
          className={\`flex min-h-14 w-full items-center justify-center rounded-2xl text-lg font-medium text-white \${
            fullAuto
              ? "bg-emerald-600"
              : personal
                ? "bg-blue-600"
                : "bg-slate-900"
          }\`}
        >
          {published
            ? C.readyPublish
            : fullAuto
              ? C.publishAutoNow
              : personal
                ? personalLabel
                : \`\${C.confirmUpload}\${post.meta.label}\`}
        </button>
      </div>
    </div>
  );
}
`;

fs.writeFileSync("src/components/olar/views/YonaView.tsx", body, "utf8");
console.log("YonaView written", fs.statSync("src/components/olar/views/YonaView.tsx").size);
