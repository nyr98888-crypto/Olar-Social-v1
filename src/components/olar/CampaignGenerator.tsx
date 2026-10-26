"use client";

import { useEffect, useState } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import {
  isCampaignPostsArray,
  parseCampaignPosts,
  type CampaignPost,
} from "@/lib/olar/campaign-posts";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import { Copy, Sparkles } from "lucide-react";

/** Preview shells only — switching never regenerates / clears image_url */
const NET_TAGS: { id: SocialNetwork; label: string }[] = [
  { id: "facebook", label: "פייסבוק" },
  { id: "instagram", label: "אינסטגרם" },
  { id: "whatsapp", label: "וואטסאפ" },
];

export function CampaignGenerator({
  initialTopic = "",
  previewNetwork,
  onPreviewNetworkChange,
  onActivePostChange,
}: {
  initialTopic?: string;
  previewNetwork?: SocialNetwork;
  onPreviewNetworkChange?: (n: SocialNetwork) => void;
  onActivePostChange?: (post: CampaignPost | null) => void;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<CampaignPost[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [localNet, setLocalNet] = useState<SocialNetwork>(
    previewNetwork || "instagram"
  );
  const { message: aiProgress } = useAiProgressMessages(busy);

  const network = previewNetwork ?? localNet;

  useEffect(() => {
    if (previewNetwork) setLocalNet(previewNetwork);
  }, [previewNetwork]);

  useEffect(() => {
    const safe =
      posts && isCampaignPostsArray(posts) ? posts.slice(0, 3) : null;
    if (safe && safe[activeIdx]) {
      onActivePostChange?.(safe[activeIdx]!);
    } else {
      onActivePostChange?.(null);
    }
  }, [posts, activeIdx, onActivePostChange]);

  function setNetwork(n: SocialNetwork) {
    setLocalNet(n);
    onPreviewNetworkChange?.(n);
  }

  async function generate() {
    setBusy(true);
    setPosts(null);
    setToast(null);
    setActiveIdx(0);
    try {
      const res = await fetch("/api/campaign/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        posts?: unknown;
        soft_message?: string;
      };
      const parsed = parseCampaignPosts(data.posts, topic);
      if (isCampaignPostsArray(parsed)) {
        setPosts(parsed);
      } else {
        setPosts(parseCampaignPosts(null, topic));
      }
      setToast(data.soft_message || C.campaignReady || C.aiSoftReady);
    } catch {
      setPosts(parseCampaignPosts(null, topic));
      setToast(C.campaignReady || C.aiSoftReady);
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
            <BrandGlyph
              id={
                n.id === "whatsapp"
                  ? "whatsapp"
                  : n.id === "facebook"
                    ? "facebook"
                    : "instagram"
              }
              size={16}
            />
            {n.label}
          </button>
        ))}
      </div>

      <label className="block text-base font-medium text-slate-900">
        {C.tellUs}
        <textarea
          dir="rtl"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={C.phCampaign || C.placeholder}
          className="mt-2 min-h-28 w-full break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void generate()}
        className="olar-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base disabled:opacity-50"
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        {busy ? aiProgress || C.making : C.makeCampaign || C.tabCampaign}
      </button>
      {busy ? (
        <p className="animate-rise text-center text-base font-medium text-accent">
          {aiProgress}
        </p>
      ) : null}
      {toast && !busy ? (
        <p className="break-words rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-base font-medium text-emerald-900">
          {toast}
        </p>
      ) : null}

      {safePosts ? (
        <ul className="grid w-full gap-4 md:grid-cols-3">
          {safePosts.map((p, i) => {
            // Guard: never render a single-character "title"
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
                        tagNet === "whatsapp"
                          ? "whatsapp"
                          : tagNet === "facebook"
                            ? "facebook"
                            : "instagram"
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
                  {p.hook ? (
                    <p className="mt-1 break-words text-sm font-medium text-slate-700">
                      {p.hook}
                    </p>
                  ) : null}
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
