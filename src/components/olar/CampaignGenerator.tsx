"use client";

import { useEffect, useState } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import {
  isCampaignPostsArray,
  type CampaignPost,
} from "@/lib/olar/campaign-posts";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import { AiSendButton } from "@/components/olar/AiSendButton";
import { Copy, Loader2 } from "lucide-react";
import { stripCategoryLeak } from "@/lib/olar/strip-category";
import type { BusinessCategoryId } from "@/lib/olar/business-categories";

/** Preview shells only — switching never regenerates / clears image_url */
const NET_TAGS: {
  id: SocialNetwork;
  label: string;
  glyph: "whatsapp" | "instagram" | "facebook" | "google";
}[] = [
  { id: "whatsapp", label: "WhatsApp Card", glyph: "whatsapp" },
  { id: "instagram", label: "Instagram", glyph: "instagram" },
  { id: "facebook", label: "Facebook", glyph: "facebook" },
  { id: "google", label: "Google Business", glyph: "google" },
];

type ChatBubble = { role: "user" | "assistant"; content: string };

export function CampaignGenerator({
  initialTopic = "",
  previewNetwork,
  onPreviewNetworkChange,
  onActivePostChange,
  onPostReady,
  category,
  hideNetworkTabs = false,
}: {
  initialTopic?: string;
  previewNetwork?: SocialNetwork;
  onPreviewNetworkChange?: (n: SocialNetwork) => void;
  onActivePostChange?: (post: CampaignPost | null) => void;
  /** Fired after generate-post succeeds — parent should refresh preview + image */
  onPostReady?: (draft: {
    headline: string;
    body: string;
    cta: string;
    imagePrompt?: string;
    userText: string;
  }) => void;
  category?: BusinessCategoryId | null;
  hideNetworkTabs?: boolean;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<CampaignPost[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [chat, setChat] = useState<ChatBubble[]>([]);
  const [localNet, setLocalNet] = useState<SocialNetwork>(
    previewNetwork || "instagram"
  );
  const { message: aiProgress } = useAiProgressMessages(busy);

  const network = previewNetwork ?? localNet;

  useEffect(() => {
    if (previewNetwork) setLocalNet(previewNetwork);
  }, [previewNetwork]);

  useEffect(() => {
    if (initialTopic && !topic) setTopic(initialTopic);
  }, [initialTopic, topic]);

  useEffect(() => {
    const safe =
      posts && isCampaignPostsArray(posts) ? posts.slice(0, 3) : null;
    if (safe && safe[activeIdx]) {
      onActivePostChange?.(safe[activeIdx]!);
    }
  }, [posts, activeIdx, onActivePostChange]);

  function setNetwork(n: SocialNetwork) {
    setLocalNet(n);
    onPreviewNetworkChange?.(n);
  }

  async function generate() {
    const userMessage = stripCategoryLeak(topic.trim());
    if (!userMessage) {
      setToast(C.landNeedInput || "כתבו כמה מילים על העסק");
      return;
    }

    setBusy(true);
    setPosts(null);
    setToast(null);
    setActiveIdx(0);
    setChat((c) => [...c, { role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: userMessage,
          prompt: userMessage,
          category: category ?? undefined,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        headline?: string;
        bodyText?: string;
        ctaButton?: string;
        imagePrompt?: string;
        soft_message?: string;
        error?: string;
        chat_reply?: string;
      };

      if (!res.ok || data.ok === false) {
        console.error("[CampaignGenerator] generate-post failed", {
          status: res.status,
          errData: data,
        });
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            content:
              data.error ||
              C.generateErrorRetry ||
              "חלה שגיאה בייצור, אנא נסה שנית",
          },
        ]);
        setToast(data.error || C.generateErrorRetry);
        return;
      }

      const headline = stripCategoryLeak(data.headline || "").trim();
      const body = stripCategoryLeak(data.bodyText || "").trim();
      const cta = stripCategoryLeak(data.ctaButton || "").trim();

      if (!headline || !body) {
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            content: C.generateErrorRetry,
          },
        ]);
        setToast(C.generateErrorRetry);
        return;
      }

      const jachnunHint = /ג['׳]?חנון|jachnun/i.test(userMessage);
      const agentLine =
        data.chat_reply?.trim() ||
        (jachnunHint
          ? "הנה הפוסט והתמונה שהכנתי עבור הג'חנון של דניאל לשבת!"
          : `הנה הפוסט והתמונה שהכנתי עבור ${headline}!`);
      setChat((c) => [...c, { role: "assistant", content: agentLine }]);

      const campaignPost: CampaignPost = {
        title: headline,
        hook: "",
        body,
        cta: cta || "לתיאום בוואטסאפ",
      };
      setPosts([campaignPost]);
      onActivePostChange?.(campaignPost);
      onPostReady?.({
        headline,
        body,
        cta: campaignPost.cta,
        imagePrompt: data.imagePrompt,
        userText: userMessage,
      });
      setToast(data.soft_message || C.campaignReady || C.aiSoftReady);
    } catch (err) {
      console.error("[CampaignGenerator] generate threw", err);
      setChat((c) => [
        ...c,
        {
          role: "assistant",
          content: C.generateErrorRetry,
        },
      ]);
      setToast(C.generateErrorRetry);
    } finally {
      setBusy(false);
    }
  }

  async function copyPost(p: CampaignPost, index: number) {
    const text = [p.title, p.hook, p.body, p.cta].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  const safePosts =
    posts && isCampaignPostsArray(posts) ? posts.slice(0, 3) : null;

  const netForIndex = (i: number): SocialNetwork =>
    NET_TAGS[i % NET_TAGS.length]?.id || "instagram";

  return (
    <div className="w-full space-y-4 text-right" dir="rtl">
      <p className="break-words text-base text-slate-800">
        {C.campaignHint || C.pickSimple}
      </p>

      {!hideNetworkTabs ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {NET_TAGS.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setNetwork(n.id)}
              className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-base font-medium ${
                network === n.id
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-800"
              }`}
            >
              <BrandGlyph id={n.glyph} size={16} />
              {n.label}
            </button>
          ))}
        </div>
      ) : null}

      {chat.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {chat.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-accent">
              <Loader2 className="h-4 w-4 animate-spin" />
              {aiProgress || C.generatingPostImage}
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="block text-base font-medium text-slate-900">
        {C.tellUs}
        <div className="mt-2 flex gap-2" dir="rtl">
          <textarea
            dir="rtl"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void generate();
              }
            }}
            placeholder={C.phCampaign || C.placeholder}
            className="min-h-28 min-w-0 flex-1 break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            disabled={busy}
          />
          <AiSendButton
            onClick={() => void generate()}
            disabled={busy || !topic.trim()}
            loading={busy}
            title={C.send}
            className="h-14 w-14 self-end rounded-2xl"
          />
        </div>
      </label>

      {toast && !busy ? (
        <p
          className={`break-words rounded-2xl border px-4 py-3 text-center text-base font-medium ${
            toast === C.generateErrorRetry
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {toast}
        </p>
      ) : null}

      {safePosts ? (
        <ul className="grid w-full gap-4 md:grid-cols-1">
          {safePosts.map((p, i) => {
            if (
              typeof p.title !== "string" ||
              p.title.length < 2 ||
              typeof p.body !== "string" ||
              p.body.length < 4
            ) {
              return null;
            }
            const tagNet = netForIndex(i);
            const tagLabel =
              NET_TAGS.find((n) => n.id === tagNet)?.label || tagNet;
            return (
              <li
                key={`campaign-post-${i}-${p.title.slice(0, 12)}`}
                className={`flex flex-col rounded-2xl border bg-white p-4 text-right shadow-lg shadow-slate-200/40 ${
                  activeIdx === i
                    ? "border-accent ring-2 ring-accent"
                    : "border-sky-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveIdx(i);
                    setNetwork(tagNet);
                  }}
                  className="w-full text-right"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                    <BrandGlyph
                      id={
                        NET_TAGS.find((n) => n.id === tagNet)?.glyph ||
                        "instagram"
                      }
                      size={12}
                    />
                    {tagLabel}
                  </span>
                  <h3
                    className="mt-2 break-words text-lg font-bold text-slate-950"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {p.title}
                  </h3>
                  <p className="mt-3 flex-1 whitespace-pre-line break-words text-base leading-relaxed text-slate-800">
                    {p.body}
                  </p>
                  <p className="mt-3 break-words text-sm font-semibold text-emerald-700">
                    {p.cta}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void copyPost(p, i)}
                  className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-900 hover:bg-accent-soft"
                >
                  <Copy className="h-4 w-4" />
                  {copied === i
                    ? C.postCopied || C.copied
                    : C.copyPost || C.copied}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
