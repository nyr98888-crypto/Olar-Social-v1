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
import {
  legacyNicheFromCategory,
  type BusinessCategoryId,
} from "@/lib/olar/business-categories";
import {
  VAR_1_LABEL,
  VAR_2_LABEL,
  type CampaignVariation,
  type VariationId,
} from "@/lib/olar/ab-variations";
import {
  appendStudioMessage,
  clearStudioVariationImages,
  persistActivePost,
  setStudioImagesPending,
  setStudioLoading,
  setStudioMeta,
  setStudioPostType,
  setStudioVariations,
  updateVariationCopy,
  updateVariationImage,
  useStudioStore,
  type StudioApplyPatch,
} from "@/lib/store";
import {
  getCampaignState,
  persistSelectedCardToActiveCampaign,
  setCampaign,
  updateVariationImage as updateCampaignImage,
  updateVariationText as updateCampaignText,
} from "@/lib/store/campaign-store";
import {
  patchCampaignInDb,
  readActiveCampaignId,
} from "@/lib/olar/campaigns-client";
import {
  postTypeDefaultCtas,
  postTypePlaceholder,
} from "@/lib/olar/post-types";
import { consumeWingmanChipPrefill } from "@/hooks/useWingmanGreeting";
import { isBlockedStudioChatReply } from "@/lib/ai/golden-templates";
import { CLIENT_IMAGE_TIMEOUT_MS } from "@/lib/api/fetch-with-retry";

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
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [textBusy, setTextBusy] = useState(false);
  const busy = textBusy || studio.isLoading;
  const { message: aiProgress } = useAiProgressMessages(
    busy || studio.imagesPending
  );

  const network = previewNetwork ?? localNet;
  const chat = studio.messages;
  const postType = studio.postType;
  const pillarPlaceholder = postTypePlaceholder(postType);

  // Auto-scroll chat to bottom when Maya replies
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length, textBusy]);
  const defaultCtas = postTypeDefaultCtas(postType);

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

  function applyPatchToPreview(patch: StudioApplyPatch) {
    updateVariationCopy(0, {
      headline: patch.headline,
      bodyText: patch.bodyText,
      ctaButton: patch.ctaButton,
    });
    updateCampaignText(0, patch.headline, patch.bodyText);
    const v0 = {
      ...studio.variations?.[0],
      headline: patch.headline,
      bodyText: patch.bodyText,
      ctaButton: patch.ctaButton || studio.variations?.[0]?.ctaButton || "",
    };
    applyVariation(
      {
        id: "var_1",
        label: VAR_1_LABEL,
        headline: patch.headline,
        bodyText: patch.bodyText,
        ctaButton: patch.ctaButton || defaultCtas.var1,
        imagePrompt: v0.imagePrompt || "",
        imageUrl: (v0.imageUrl as string) || null,
      },
      studio.messages.filter((m) => m.role === "user").at(-1)?.content || ""
    );
    persistActivePost();
    setToast("הכרטיס עודכן מהצ'אט ✓");
  }

  /** Background single image fill — never blocks Maya chat bubble. */
  async function fillImagesInBackground(
    vars: CampaignVariation[],
    userMessage: string,
    anchors?: string
  ) {
    setStudioImagesPending(true);
    try {
      const v = vars[0]!;
      const seed = Math.floor(Math.random() * 10000000);
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: v.imagePrompt || userMessage,
            prompt: v.imagePrompt || userMessage,
            businessName: businessName || undefined,
            niche: category ? legacyNicheFromCategory(category) : undefined,
            category: category ?? undefined,
            purpose: "post",
            aspectRatio: "1:1",
            seed,
            bustCache: Date.now(),
            imageAnchorWords: anchors || undefined,
          }),
          signal: AbortSignal.timeout(CLIENT_IMAGE_TIMEOUT_MS),
        });
        const data = (await res.json().catch(() => ({}))) as {
          image?: { url?: string; prompt?: string };
          imageUrl?: string;
          english_prompt?: string;
        };
        const url = data.image?.url || data.imageUrl;
        if (url && !url.startsWith("data:image")) {
          const prompt =
            data.english_prompt || data.image?.prompt || v.imagePrompt;
          updateVariationImage(0, { imageUrl: url, imagePrompt: prompt });
          updateCampaignImage(0, url);
          // Keep store length-2 in sync
          updateVariationImage(1, { imageUrl: url, imagePrompt: prompt });
          updateCampaignImage(1, url);
        }
      } catch (err) {
        console.warn(
          "[CampaignGenerator] background image failed",
          err instanceof Error ? err.message : err
        );
      }
      persistActivePost();
    } finally {
      setStudioImagesPending(false);
    }
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
    setInputPrompt("");
    setToast(null);
    clearStudioVariationImages();
    const anchorsPayload = imageAnchorWords.trim() || undefined;
    setStudioMeta({
      businessName: businessName || undefined,
      category: category ?? undefined,
      postType,
      imageAnchorWords: anchorsPayload || "",
    });
    appendStudioMessage({ role: "user", content: userMessage });
    setTextBusy(true);
    setStudioLoading(true);

    try {
      // Phase A — Maya via OpenRouter; live left-card update (no Missing Card)
      const camp = getCampaignState();
      const isBad = (h?: string) =>
        !h?.trim() || /^missing\s*card/i.test(h.trim());
      const liveVar =
        studio.variations?.[studio.selectedVariationIndex] ||
        camp.activeCampaign?.variations?.[camp.activeVariationIndex ?? 0] ||
        null;
      const currentPost =
        liveVar && !isBad(liveVar.headline)
          ? {
              headline: liveVar.headline || "",
              bodyText: liveVar.bodyText || "",
              ctaButton: liveVar.ctaButton || "",
              imageUrl: liveVar.imageUrl || null,
            }
          : liveVar?.bodyText?.trim()
            ? {
                headline: liveVar.bodyText.slice(0, 48),
                bodyText: liveVar.bodyText || "",
                ctaButton: liveVar.ctaButton || "",
                imageUrl: liveVar.imageUrl || null,
              }
            : null;

      const currentCard = {
        title: currentPost?.headline || "",
        bodyText: currentPost?.bodyText || "",
      };
      const messages = chat
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const campaignId = readActiveCampaignId();
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: userMessage,
          prompt: userMessage,
          category: category ?? undefined,
          businessName: businessName || undefined,
          postType,
          imageAnchorWords: anchorsPayload,
          skipImages: true,
          messages,
          currentCard,
          currentPost,
          campaignId,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        replyMessage?: string;
        chat_reply?: string;
        soft_message?: string;
        error?: string;
        updatedTitle?: string;
        updatedBodyText?: string;
        reply?: string;
        cardUpdate?: {
          title?: string | null;
          bodyText?: string | null;
        } | null;
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
        const rawErr = (data.error || C.generateErrorRetry).trim();
        const hardFail =
          res.status === 429
            ? rawErr || "אנא המתן מספר שניות לפני יצירת פוסט נוסף."
            : isBlockedStudioChatReply(rawErr)
              ? C.generateErrorRetry
              : rawErr.trim() || C.generateErrorRetry;
        appendStudioMessage({ role: "assistant", content: hardFail });
        setToast(hardFail);
        setStudioLoading(false);
        setStudioImagesPending(false);
        return;
      }

      // Show Maya reply immediately — prefer `reply` contract
      let replyMessage =
        data.reply?.trim() ||
        data.replyMessage?.trim() ||
        data.chat_reply?.trim() ||
        "הכנתי לך פוסט מוכן — תראו משמאל.";
      if (isBlockedStudioChatReply(replyMessage)) {
        replyMessage = "הכנתי לך פוסט מוכן — תראו משמאל.";
      }

      // Soft cardUpdate-only path: keep current card, still show reply
      const cuOnly = data.cardUpdate;
      const hasCardOnlyPatch =
        (typeof cuOnly?.title === "string" && cuOnly.title.trim()) ||
        (typeof cuOnly?.bodyText === "string" && cuOnly.bodyText.trim()) ||
        Boolean(data.updatedTitle?.trim() || data.updatedBodyText?.trim());

      const single = data.post || data.postData || null;
      let nextVars: CampaignVariation[] = [];
      const fromApi = Array.isArray(data.variations) ? data.variations[0] : null;
      const cleaned = sanitizeVariationCopy({
        headline:
          (typeof cuOnly?.title === "string" && cuOnly.title.trim()) ||
          data.updatedTitle?.trim() ||
          fromApi?.headline ||
          single?.headline ||
          data.headline ||
          studio.variations?.[0]?.headline ||
          "",
        bodyText:
          (typeof cuOnly?.bodyText === "string" && cuOnly.bodyText.trim()) ||
          data.updatedBodyText?.trim() ||
          fromApi?.bodyText ||
          single?.bodyText ||
          single?.body ||
          data.bodyText ||
          studio.variations?.[0]?.bodyText ||
          "",
        ctaButton:
          fromApi?.ctaButton ||
          single?.ctaButton ||
          data.ctaButton ||
          studio.variations?.[0]?.ctaButton ||
          "",
        fallbackCta: defaultCtas.var1,
      });

      if (!cleaned.headline || !cleaned.bodyText) {
        // Still show reply bubble — never hang with "no response"
        appendStudioMessage({ role: "assistant", content: replyMessage });
        if (!hasCardOnlyPatch) {
          setToast(C.generateErrorRetry);
        }
        setStudioLoading(false);
        setStudioImagesPending(false);
        return;
      }

      nextVars = [
        {
          id: "var_1",
          label: VAR_1_LABEL,
          headline: cleaned.headline,
          bodyText: cleaned.bodyText,
          ctaButton: cleaned.ctaButton || defaultCtas.var1,
          imagePrompt:
            fromApi?.imagePrompt ||
            single?.imagePrompt ||
            data.imagePrompt ||
            userMessage,
          imageUrl: null,
          hashtags: fromApi?.hashtags || [],
        },
        {
          id: "var_2",
          label: VAR_2_LABEL,
          headline: cleaned.headline,
          bodyText: cleaned.bodyText,
          ctaButton: cleaned.ctaButton || defaultCtas.var1,
          imagePrompt:
            fromApi?.imagePrompt ||
            single?.imagePrompt ||
            data.imagePrompt ||
            userMessage,
          imageUrl: null,
          hashtags: fromApi?.hashtags || [],
        },
      ];

      if (!nextVars[0]?.headline || !nextVars[0]?.bodyText) {
        appendStudioMessage({
          role: "assistant",
          content: C.generateErrorRetry,
        });
        setToast(C.generateErrorRetry);
        setStudioLoading(false);
        setStudioImagesPending(false);
        return;
      }

      const applyPatch: StudioApplyPatch = {
        headline: nextVars[0]!.headline,
        bodyText: nextVars[0]!.bodyText,
        ctaButton: nextVars[0]!.ctaButton,
      };

      // Keep prior image on soft edits when API returned null
      const keepImg0 =
        nextVars[0]!.imageUrl ||
        studio.variations?.[0]?.imageUrl ||
        currentPost?.imageUrl ||
        null;

      const liveVars: [CampaignVariation, CampaignVariation] = [
        { ...nextVars[0]!, imageUrl: keepImg0 },
        { ...nextVars[1]!, imageUrl: keepImg0 },
      ];

      // Live left card FIRST — user sees the change immediately
      setStudioVariations(liveVars);
      setCampaign({
        businessName: businessName || "",
        prompt: userMessage,
        imageAnchorWords: anchorsPayload || "",
        variations: [
          {
            id: "var_1" as const,
            label: liveVars[0].label,
            headline: liveVars[0].headline,
            bodyText: liveVars[0].bodyText,
            ctaButton: liveVars[0].ctaButton,
            imageUrl: liveVars[0].imageUrl ?? null,
            imagePrompt: liveVars[0].imagePrompt || "",
          },
          {
            id: "var_2" as const,
            label: liveVars[1].label,
            headline: liveVars[1].headline,
            bodyText: liveVars[1].bodyText,
            ctaButton: liveVars[1].ctaButton,
            imageUrl: liveVars[1].imageUrl ?? null,
            imagePrompt: liveVars[1].imagePrompt || "",
          },
        ],
      });
      applyPatchToPreview(applyPatch);
      applyVariation(liveVars[0], userMessage);
      persistSelectedCardToActiveCampaign({
        headline: liveVars[0].headline,
        bodyText: liveVars[0].bodyText,
        body: liveVars[0].bodyText,
        ctaButton: liveVars[0].ctaButton,
        imageUrl: liveVars[0].imageUrl,
        imagePrompt: liveVars[0].imagePrompt,
        businessName: businessName || "",
      });

      // Persist Maya live edits to SQLite (source of truth)
      // Prefer cardUpdate contract; fall back to legacy updatedTitle/updatedBodyText
      const cu = data.cardUpdate;
      const patchTitle =
        (typeof cu?.title === "string" && cu.title.trim()) ||
        data.updatedTitle?.trim() ||
        liveVars[0].headline;
      const patchBody =
        (typeof cu?.bodyText === "string" && cu.bodyText.trim()) ||
        data.updatedBodyText?.trim() ||
        liveVars[0].bodyText;
      const hasCardPatch =
        (typeof cu?.title === "string" && cu.title.trim()) ||
        (typeof cu?.bodyText === "string" && cu.bodyText.trim()) ||
        Boolean(data.updatedTitle?.trim() || data.updatedBodyText?.trim());
      if (campaignId && hasCardPatch && (patchTitle || patchBody)) {
        void patchCampaignInDb(campaignId, {
          title: patchTitle,
          bodyText: patchBody,
          imageUrl: liveVars[0].imageUrl,
        });
      }

      appendStudioMessage({
        role: "assistant",
        content: replyMessage,
        applyPatch,
      });
      persistActivePost();
      onVariationsReady?.(liveVars, userMessage);

      setTextBusy(false);
      setStudioLoading(false);
      setToast(
        data.soft_message && !isBlockedStudioChatReply(data.soft_message)
          ? data.soft_message
          : "מכינה תמונה לכרטיס…"
      );

      // Phase B — single image in background (skip if soft-edit kept image)
      const needsImages =
        !liveVars[0]!.imageUrl ||
        liveVars[0]!.imageUrl.startsWith("data:image/svg");
      if (needsImages) {
        void fillImagesInBackground(liveVars, userMessage, anchorsPayload);
      } else {
        setToast("הכרטיס עודכן ✓");
        window.setTimeout(() => setToast(null), 2200);
      }
    } catch (err) {
      console.error("[CampaignGenerator] generate threw", err);
      appendStudioMessage({
        role: "assistant",
        content: C.generateErrorRetry,
      });
      setToast(C.generateErrorRetry);
      setStudioLoading(false);
      setStudioImagesPending(false);
    } finally {
      setTextBusy(false);
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

      {chat.length > 0 || textBusy ? (
        <div
          ref={chatScrollRef}
          className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3"
        >
          {chat.map((m, i) => (
            <div
              key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] space-y-2 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.role === "assistant" && m.applyPatch?.headline ? (
                  <button
                    type="button"
                    onClick={() => applyPatchToPreview(m.applyPatch!)}
                    className="mt-1 inline-flex min-h-9 items-center justify-center rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-700"
                  >
                    החל על הפוסט שלי
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {textBusy ? (
            <div className="flex justify-start">
              <p className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-accent">
                <Loader2 className="h-4 w-4 animate-spin" />
                {aiProgress || "מכינה את הפוסט..."}
              </p>
            </div>
          ) : studio.imagesPending ? (
            <div className="flex justify-start">
              <p className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                מעדכנת תמונה לכרטיס…
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Chat input — clean: no domain/pillar tag rows */}
      <label className="block text-base font-medium text-slate-900">
        {C.tellUs}
        <div className="mt-2 space-y-3" dir="rtl">
          <textarea
            dir="rtl"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && !sendingRef.current) void handleSendMessage();
              }
            }}
            placeholder={pillarPlaceholder || C.phCampaign || C.placeholder}
            className="min-h-32 w-full break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent disabled:opacity-60"
            disabled={busy}
          />
          <input
            type="text"
            value={imageAnchorWords}
            onChange={(e) => setImageAnchorWords(e.target.value)}
            placeholder="מילות תמונה (אופציונלי) — למשל: צלחת חמה על עץ"
            disabled={busy}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
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
