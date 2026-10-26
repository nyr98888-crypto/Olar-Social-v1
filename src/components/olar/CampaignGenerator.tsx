"use client";

import { useEffect, useRef, useState } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import type { CampaignPost } from "@/lib/olar/campaign-posts";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import { AiSendButton } from "@/components/olar/AiSendButton";
import { Loader2 } from "lucide-react";
import {
  sanitizeMarketingCopy,
  sanitizeVariationCopy,
} from "@/lib/olar/sanitize-marketing-copy";
import type { BusinessCategoryId } from "@/lib/olar/business-categories";
import {
  VAR_1_LABEL,
  VAR_2_LABEL,
  normalizeVariationId,
  type CampaignVariation,
  type VariationId,
} from "@/lib/olar/ab-variations";
import {
  appendStudioMessage,
  setStudioLoading,
  setStudioMeta,
  setStudioPostType,
  setStudioVariations,
  useStudioStore,
} from "@/lib/store";
import { ContentPillarTabs } from "@/components/olar/ContentPillarTabs";
import {
  postTypeDefaultCtas,
  postTypePlaceholder,
  type PostTypeId,
} from "@/lib/olar/post-types";
import { consumeWingmanChipPrefill } from "@/hooks/useWingmanGreeting";
import { isBlockedStudioChatReply } from "@/lib/ai/golden-templates";

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

const QUICK_SENDS = [
  { id: "offer", label: "עדכון מבצע", text: "תכיני פוסט עם עדכון מבצע אטרקטיבי לעסק שלי" },
  { id: "tip", label: "טיפ מקצועי", text: "תכיני פוסט עם טיפ מקצועי שימושי ללקוחות שלי" },
] as const;

export type StudioPostData = {
  headline: string;
  body: string;
  cta: string;
  imagePrompt?: string;
  imageUrl?: string | null;
  userText: string;
  variationId?: VariationId;
};

export function CampaignGenerator({
  initialTopic = "",
  previewNetwork,
  onPreviewNetworkChange,
  onActivePostChange,
  onPostReady,
  onVariationsReady,
  category,
  businessName,
  hideNetworkTabs = false,
}: {
  initialTopic?: string;
  previewNetwork?: SocialNetwork;
  onPreviewNetworkChange?: (n: SocialNetwork) => void;
  onActivePostChange?: (post: CampaignPost | null) => void;
  onPostReady?: (draft: StudioPostData) => void;
  onVariationsReady?: (
    variations: CampaignVariation[],
    userText: string
  ) => void;
  category?: BusinessCategoryId | null;
  businessName?: string;
  hideNetworkTabs?: boolean;
}) {
  const studio = useStudioStore();
  const [inputPrompt, setInputPrompt] = useState("");
  const [imageAnchorWords, setImageAnchorWords] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [localNet, setLocalNet] = useState<SocialNetwork>(
    previewNetwork || "instagram"
  );
  const sendingRef = useRef(false);
  const busy = studio.isLoading;
  const { message: aiProgress } = useAiProgressMessages(busy);

  const network = previewNetwork ?? localNet;
  const chat = studio.messages;
  const postType = studio.postType;
  const pillarPlaceholder = postTypePlaceholder(postType);
  const defaultCtas = postTypeDefaultCtas(postType);

  function onPostTypeChange(id: PostTypeId) {
    setStudioPostType(id);
  }

  useEffect(() => {
    if (previewNetwork) setLocalNet(previewNetwork);
  }, [previewNetwork]);

  useEffect(() => {
    if (!seeded && initialTopic.trim()) {
      setInputPrompt(initialTopic);
      setSeeded(true);
    }
  }, [initialTopic, seeded]);

  // Wingman chip → set postType + prefill prompt once
  useEffect(() => {
    const prefill = consumeWingmanChipPrefill();
    if (!prefill) return;
    setStudioPostType(prefill.postType);
    if (prefill.promptHint?.trim()) {
      setInputPrompt(prefill.promptHint.trim());
      setSeeded(true);
    }
  }, []);

  useEffect(() => {
    setStudioMeta({
      businessName: businessName || "",
      category: category || "",
    });
  }, [businessName, category]);

  function setNetwork(n: SocialNetwork) {
    setLocalNet(n);
    onPreviewNetworkChange?.(n);
  }

  function applyVariation(v: CampaignVariation, userText: string) {
    const campaignPost: CampaignPost = {
      title: v.headline,
      hook: "",
      body: v.bodyText,
      cta: v.ctaButton,
    };
    onActivePostChange?.(campaignPost);
    onPostReady?.({
      headline: v.headline,
      body: v.bodyText,
      cta: v.ctaButton,
      imagePrompt: v.imagePrompt,
      imageUrl: v.imageUrl || null,
      userText,
      variationId: v.id,
    });
  }

  async function handleSendMessage(overrideText?: string) {
    const userMessage = sanitizeMarketingCopy(
      (overrideText ?? inputPrompt).trim()
    );
    if (!userMessage || busy || sendingRef.current) {
      if (!userMessage && !overrideText) {
        setToast(C.landNeedInput || "כתבו כמה מילים על העסק");
      }
      return;
    }

    sendingRef.current = true;
    // Clear textarea immediately; append user bubble; set loading
    setInputPrompt("");
    setToast(null);
    appendStudioMessage({ role: "user", content: userMessage });
    setStudioLoading(true);

    try {
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: userMessage,
          prompt: userMessage,
          category: category ?? undefined,
          businessName: businessName || undefined,
          postType,
          imageAnchorWords: imageAnchorWords.trim() || undefined,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        replyMessage?: string;
        chat_reply?: string;
        soft_message?: string;
        error?: string;
        variations?: Array<{
          id?: string;
          label?: string;
          headline?: string;
          bodyText?: string;
          ctaButton?: string;
          imageUrl?: string | null;
          imagePrompt?: string;
          hashtags?: string[];
        }>;
        post?: {
          headline?: string;
          bodyText?: string;
          body?: string;
          ctaButton?: string;
          imageUrl?: string | null;
          imagePrompt?: string;
        };
        postData?: {
          headline?: string;
          bodyText?: string;
          body?: string;
          ctaButton?: string;
          imageUrl?: string | null;
          imagePrompt?: string;
        };
        headline?: string;
        bodyText?: string;
        ctaButton?: string;
        imagePrompt?: string;
        imageUrl?: string | null;
      };

      if (!res.ok || data.ok === false) {
        // Soft retry only on true hard failure — never lecture about ready-made text
        const rawErr = (data.error || C.generateErrorRetry).trim();
        const hardFail = isBlockedStudioChatReply(rawErr)
          ? C.generateErrorRetry
          : rawErr.replace(
              /בלי טקסט מוכן מראש\.?|טקסט מוכן מראש\.?|לא הצלחתי לייצר פוסט כרגע\.?/gi,
              ""
            ).trim() || C.generateErrorRetry;
        appendStudioMessage({
          role: "assistant",
          content: hardFail,
        });
        setToast(C.generateErrorRetry);
        return;
      }

      let replyMessage =
        data.replyMessage?.trim() ||
        data.chat_reply?.trim() ||
        "הכנו שתי אופציות שונות — בחרו את מה שמדבר אליכם!";
      if (isBlockedStudioChatReply(replyMessage)) {
        replyMessage =
          "הכנו שתי אופציות שונות — בחרו את מה שמדבר אליכם!";
      }

      const single =
        data.post || data.postData || null;

      let nextVars: CampaignVariation[] = [];
      if (Array.isArray(data.variations) && data.variations.length >= 2) {
        nextVars = data.variations.slice(0, 2).map((v, i) => {
          const cleaned = sanitizeVariationCopy({
            headline: v.headline || "",
            bodyText: v.bodyText || "",
            ctaButton: v.ctaButton || "",
            fallbackCta: i === 0 ? defaultCtas.var1 : defaultCtas.var2,
          });
          return {
            id: normalizeVariationId(v.id, i),
            label: v.label || (i === 0 ? VAR_1_LABEL : VAR_2_LABEL),
            headline: cleaned.headline,
            bodyText: cleaned.bodyText,
            ctaButton: cleaned.ctaButton || (i === 0 ? defaultCtas.var1 : defaultCtas.var2),
            imagePrompt: v.imagePrompt || "",
            imageUrl: v.imageUrl || null,
            hashtags: v.hashtags || [],
          };
        });
      } else {
        const cleaned = sanitizeVariationCopy({
          headline: single?.headline || data.headline || "",
          bodyText:
            single?.bodyText || single?.body || data.bodyText || "",
          ctaButton: single?.ctaButton || data.ctaButton || "",
          fallbackCta: defaultCtas.var1,
        });
        const headline = cleaned.headline;
        const body = cleaned.bodyText;
        if (!headline || !body) {
          appendStudioMessage({
            role: "assistant",
            content: C.generateErrorRetry,
          });
          setToast(C.generateErrorRetry);
          return;
        }
        nextVars = [
          {
            id: "var_1",
            label: VAR_1_LABEL,
            headline,
            bodyText: body,
            ctaButton: cleaned.ctaButton || defaultCtas.var1,
            imagePrompt: single?.imagePrompt || data.imagePrompt || "",
            imageUrl: single?.imageUrl || data.imageUrl || null,
          },
          {
            id: "var_2",
            label: VAR_2_LABEL,
            headline,
            bodyText: body,
            ctaButton: defaultCtas.var2,
            imagePrompt: single?.imagePrompt || data.imagePrompt || "",
            imageUrl: single?.imageUrl || data.imageUrl || null,
          },
        ];
      }

      if (!nextVars[0]?.headline || !nextVars[0]?.bodyText) {
        appendStudioMessage({
          role: "assistant",
          content: C.generateErrorRetry,
        });
        setToast(C.generateErrorRetry);
        return;
      }

      // Maya bubble + central store — live preview updates instantly (never Missing Card)
      appendStudioMessage({ role: "assistant", content: replyMessage });
      setStudioVariations(nextVars as [CampaignVariation, CampaignVariation]);
      onVariationsReady?.(nextVars, userMessage);
      applyVariation(nextVars[0]!, userMessage);
      const softToast =
        data.soft_message && !isBlockedStudioChatReply(data.soft_message)
          ? data.soft_message
          : C.abOptionsHeader || "שתי אופציות מוכנות — שתיהן בתצוגה המקדימה";
      setToast(softToast);
    } catch (err) {
      console.error("[CampaignGenerator] generate threw", err);
      appendStudioMessage({
        role: "assistant",
        content: C.generateErrorRetry,
      });
      setToast(C.generateErrorRetry);
    } finally {
      setStudioLoading(false);
      sendingRef.current = false;
    }
  }

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

      {chat.length > 0 || busy ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {chat.map((m, i) => (
            <div
              key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
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
            <div className="flex justify-start">
              <p className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-accent">
                <Loader2 className="h-4 w-4 animate-spin" />
                {aiProgress || "מכינה שתי אופציות..."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {QUICK_SENDS.map((q) => (
          <button
            key={q.id}
            type="button"
            disabled={busy}
            onClick={() => void handleSendMessage(q.text)}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      <ContentPillarTabs
        value={postType}
        onChange={onPostTypeChange}
        disabled={busy}
      />

      <label className="block text-base font-medium text-slate-900">
        {C.tellUs}
        <div className="mt-2 space-y-2" dir="rtl">
          <textarea
            dir="rtl"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder={pillarPlaceholder || C.phCampaign || C.placeholder}
            className="min-h-28 w-full break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            disabled={busy}
          />
          <div className="w-full text-right">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold text-slate-700">💡 רוצים תמונה בול?</span>
              <span>זרקו 3-4 מילים על מה שנראה (אופציונלי):</span>
            </div>
            <input
              type="text"
              value={imageAnchorWords}
              onChange={(e) => setImageAnchorWords(e.target.value)}
              placeholder="למשל: סטודיו מואר עם צבעים, צלחת חמה על עץ, רכב מבריק..."
              disabled={busy}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex justify-start">
            <AiSendButton
              onClick={() => void handleSendMessage()}
              disabled={busy || !inputPrompt.trim()}
              loading={busy}
              title={C.send}
              className="h-14 w-14 rounded-2xl"
            />
          </div>
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
    </div>
  );
}
