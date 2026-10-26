"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadProfile, useResolvedMyPage } from "@/lib/olar/business-profile";
import {
  loadCurrentPost,
  saveCurrentPost,
  saveCurrentPostImage,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { C } from "@/lib/olar/ui-copy";
import {
  legacyNicheFromCategory,
  normalizeCategory,
} from "@/lib/olar/business-categories";
import { getCategoryFallback } from "@/lib/olar/category-fallbacks";
import { CLIENT_IMAGE_TIMEOUT_MS } from "@/lib/api/fetch-with-retry";
import { CampaignGenerator } from "@/components/olar/CampaignGenerator";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { AssistedPublishModal } from "@/components/olar/AssistedPublishModal";
import { PublishPlatformButtons } from "@/components/olar/PublishPlatformButtons";
import { BrandGlyph } from "@/components/olar/NetworkBrand";
import { FooterBrand } from "@/components/olar/FooterBrand";
import { WingmanGreetingCard } from "@/components/olar/WingmanGreetingCard";
import { useClientAuth } from "@/lib/olar/auth-client";
import { useWingmanGreeting } from "@/hooks/useWingmanGreeting";
import { useConnections } from "@/lib/olar/connections";
import {
  getSocialAccount,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";
import { executeAssistedPublish } from "@/lib/assisted-publishing";
import type { CampaignPost } from "@/lib/olar/campaign-posts";
import type {
  PlatformPosts,
  SocialPostFields,
} from "../../../../schemas/agent";
import {
  PREVIEW_CHANNEL_TABS,
  aspectRatioForChannel,
  formatChannelShareText,
  networkToPreviewChannel,
  platformToCardData,
  previewChannelToNetwork,
  resolvePlatforms,
  whatsappCardShareHref,
  type PreviewChannel,
} from "@/lib/olar/multi-channel";
import {
  type CampaignVariation,
  type VariationId,
} from "@/lib/olar/ab-variations";
import {
  getStudioState,
  hydrateStudioFromActivePost,
  loadActivePost,
  persistActivePost,
  postToCampaignVariation,
  selectVariationIndex,
  setStudioMeta,
  setStudioVariations,
  updateVariationCopy,
  updateVariationImage,
  useSelectedVariation,
  useStudioStore,
} from "@/lib/store";
import {
  getCampaignState,
  hydrateCampaignFromStorage,
  persistSelectedCardToActiveCampaign,
  schedulePost,
  updateVariationText as updateCampaignVariationText,
  useActiveCampaignVariation,
  useCampaignStore,
} from "@/lib/store/campaign-store";
import {
  fetchCampaignById,
  fetchLatestCampaign,
  postCampaignToDb,
  readActiveCampaignId,
} from "@/lib/olar/campaigns-client";
import { downloadImageDirect } from "@/lib/utils/download-image";
import { createCalendarEvent } from "@/lib/olar/calendar-client";
import {
  downloadIcsBlob,
  buildIcsCalendar,
  googleCalendarUrl,
} from "@/lib/olar/calendar-events";
import {
  CalendarPlus,
  Copy,
  Download,
  ImagePlus,
  PanelsTopLeft,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type StudioTab = "campaign" | "headshot" | "banner" | "logo";

const TABS: {
  id: StudioTab;
  labelKey: "tabCampaign" | "tabHead" | "tabBanner" | "tabLogo";
}[] = [
  { id: "campaign", labelKey: "tabCampaign" },
  { id: "headshot", labelKey: "tabHead" },
  { id: "banner", labelKey: "tabBanner" },
  { id: "logo", labelKey: "tabLogo" },
];

export function StudioView() {
  const { page } = useResolvedMyPage();
  const { isGuest, ready: authReady } = useClientAuth();
  const { networks } = useConnections();
  const studio = useStudioStore();
  const selectedVariation = useSelectedVariation();
  const campaignState = useCampaignStore();
  const activeCampaignVar = useActiveCampaignVariation();
  const faceRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<StudioTab>("campaign");
  const [prompt, setPrompt] = useState("");
  const [face, setFace] = useState<string | null>(null);
  const [bizName, setBizName] = useState("");
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const wingman = useWingmanGreeting({
    enabled: authReady && !isGuest,
    appendToStudio: true,
  });
  const [result, setResult] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  /** Which A/B card is regenerating an image (null = none / legacy single). */
  const [imageLoadingIndex, setImageLoadingIndex] = useState<number | null>(
    null
  );
  const [imageIsFallback, setImageIsFallback] = useState(false);
  const [logoMark, setLogoMark] = useState<string | null>(null);
  const [softToast, setSoftToast] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] =
    useState<PreviewChannel>("whatsapp");
  const [platforms, setPlatforms] = useState<PlatformPosts | null>(null);
  const [campaignPreview, setCampaignPreview] =
    useState<SocialPostFields | null>(null);
  const [lastUserText, setLastUserText] = useState("");
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [assistedOpen, setAssistedOpen] = useState(false);
  const [assistedPlatform, setAssistedPlatform] =
    useState<SocialPlatform | null>(null);
  const [assistedMeta, setAssistedMeta] = useState<{
    clipboardOk?: boolean;
    downloadOk?: boolean;
    imageOpenedInTab?: boolean;
  }>({});
  /** Mobile (< lg): toggle between post preview and Maya chat/tabs. */
  const [mobilePane, setMobilePane] = useState<"preview" | "chat">("preview");
  const variations: CampaignVariation[] = (
    studio.variations
      ? studio.variations.map(postToCampaignVariation)
      : campaignState.activeCampaign?.variations
        ? [...campaignState.activeCampaign.variations]
        : []
  ).filter((v) => {
    const h = (v.headline || "").trim();
    if (/^missing\s*card/i.test(h)) return false;
    return Boolean(h || v.bodyText?.trim());
  });
  const selectedVarId: VariationId =
    studio.selectedVariationIndex === 1 ? "var_2" : "var_1";
  const { message: aiProgress } = useAiProgressMessages(
    generating || imageLoading || studio.isLoading
  );

  // Hydrate left card: SQLite (?id / latest) source of truth, then localStorage cache
  useEffect(() => {
    const isBadHeadline = (h?: string | null) => {
      const t = (h || "").trim();
      return !t || /^missing\s*card/i.test(t);
    };

    hydrateCampaignFromStorage();
    const camp = getCampaignState();
    const campVars = camp.activeCampaign?.variations;
    const campGood =
      Boolean(campVars?.[0]) &&
      (!isBadHeadline(campVars![0].headline) ||
        Boolean(campVars![0].bodyText?.trim()));

    if (campGood && campVars) {
      // Prefer home→studio handoff over stale current_active_post
      setStudioVariations(campVars);
      selectVariationIndex(camp.activeVariationIndex === 1 ? 1 : 0);
    } else {
      hydrateStudioFromActivePost();
      const stored = loadCurrentPost();
      if (
        stored &&
        (stored.headline?.trim() || stored.body?.trim()) &&
        !isBadHeadline(stored.headline)
      ) {
        persistSelectedCardToActiveCampaign({
          headline: stored.headline || "",
          bodyText: stored.body || "",
          body: stored.body || "",
          ctaButton: stored.cta || "",
          imageUrl: stored.image_url,
          imagePrompt: stored.image_prompt || "",
          hashtags: stored.hashtags || [],
        });
        const again = getCampaignState().activeCampaign?.variations;
        if (again) {
          setStudioVariations(again);
          selectVariationIndex(0);
        }
      }
    }

    const active = loadActivePost();
    const liveCamp = getCampaignState();
    const fromCampaign =
      liveCamp.activeCampaign?.variations?.[
        liveCamp.activeVariationIndex === 1 ? 1 : 0
      ] || null;
    const liveStudio = getStudioState();
    const fromStore =
      liveStudio.variations?.[liveStudio.selectedVariationIndex];
    const fromActive = active?.variations?.[active.selectedVariationIndex ?? 0];
    const stored = loadCurrentPost();

    let headline =
      (!isBadHeadline(fromCampaign?.headline) && fromCampaign?.headline) ||
      (!isBadHeadline(fromStore?.headline) && fromStore?.headline) ||
      (!isBadHeadline(fromActive?.headline) && fromActive?.headline) ||
      (!isBadHeadline(stored?.headline) && stored?.headline) ||
      "";
    if (isBadHeadline(headline)) headline = "";
    const body =
      fromCampaign?.bodyText ||
      fromStore?.bodyText ||
      fromActive?.bodyText ||
      stored?.body ||
      "";
    const cta =
      fromCampaign?.ctaButton ||
      fromStore?.ctaButton ||
      fromActive?.ctaButton ||
      stored?.cta ||
      "";
    const img =
      (fromCampaign?.imageUrl &&
      !fromCampaign.imageUrl.startsWith("data:image/svg")
        ? fromCampaign.imageUrl
        : null) ||
      (fromStore?.imageUrl && !fromStore.imageUrl.startsWith("data:image/svg")
        ? fromStore.imageUrl
        : null) ||
      (fromActive?.imageUrl &&
      typeof fromActive.imageUrl === "string" &&
      !fromActive.imageUrl.startsWith("data:image/svg")
        ? fromActive.imageUrl
        : null) ||
      stored?.image_url ||
      null;

    if (img) {
      setImageUrl(img);
      setResult(img);
      setImageIsFallback(false);
    }
    if (stored?.network) {
      setPreviewChannel(networkToPreviewChannel(stored.network));
    }
    if (headline.trim() || body.trim()) {
      const post: SocialPostFields = {
        headline: headline.trim() || bizName || page.businessName || C.myBiz,
        body: body.trim(),
        hashtags: stored?.hashtags || [],
        call_to_action: cta,
      };
      setCampaignPreview(post);
      setPlatforms(resolvePlatforms(post, page));
    }

    // SQLite source of truth — overwrite cache when DB row resolves
    let cancelled = false;
    async function hydrateFromDb() {
      let idNum = NaN;
      try {
        const q = new URLSearchParams(window.location.search).get("id");
        if (q) idNum = Number.parseInt(q, 10);
      } catch {
        /* ignore */
      }
      if (!Number.isFinite(idNum) || idNum <= 0) {
        const remembered = readActiveCampaignId();
        if (remembered) idNum = remembered;
      }
      const fromDb =
        Number.isFinite(idNum) && idNum > 0
          ? await fetchCampaignById(idNum)
          : await fetchLatestCampaign();
      if (cancelled || !fromDb) return;
      const dbTitle = (fromDb.title || "").trim();
      const dbBody = (fromDb.bodyText || "").trim();
      if (!dbTitle && !dbBody) return;
      if (/^missing\s*card/i.test(dbTitle)) return;
      const safeHeadline = dbTitle || dbBody.slice(0, 48);
      persistSelectedCardToActiveCampaign({
        headline: safeHeadline,
        bodyText: dbBody,
        body: dbBody,
        imageUrl: fromDb.imageUrl || null,
        hashtags: fromDb.hashtags
          ? fromDb.hashtags.split(/\s+/).filter(Boolean)
          : [],
      });
      setStudioVariations([
        {
          id: "var_1",
          label: "אופציה 1",
          headline: safeHeadline,
          bodyText: dbBody,
          ctaButton: "",
          imageUrl: fromDb.imageUrl || null,
          imagePrompt: "",
        },
        {
          id: "var_2",
          label: "אופציה 2",
          headline: safeHeadline,
          bodyText: dbBody,
          ctaButton: "",
          imageUrl: fromDb.imageUrl || null,
          imagePrompt: "",
        },
      ]);
      selectVariationIndex(0);
      if (fromDb.imageUrl) {
        setImageUrl(fromDb.imageUrl);
        setResult(fromDb.imageUrl);
        setImageIsFallback(false);
      }
      const dbPost: SocialPostFields = {
        headline: safeHeadline,
        body: dbBody,
        hashtags: fromDb.hashtags
          ? fromDb.hashtags.split(/\s+/).filter(Boolean)
          : [],
        call_to_action: "",
      };
      setCampaignPreview(dbPost);
      setPlatforms(resolvePlatforms(dbPost, page));
    }
    void hydrateFromDb();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / page identity only
  }, [page]);

  // Live sync: campaign-store text/image → left preview (Maya updates)
  useEffect(() => {
    if (!activeCampaignVar) return;
    if (
      !activeCampaignVar.headline?.trim() &&
      !activeCampaignVar.bodyText?.trim()
    ) {
      return;
    }
    const next: SocialPostFields = {
      headline: activeCampaignVar.headline,
      body: activeCampaignVar.bodyText,
      hashtags: loadCurrentPost()?.hashtags || [],
      call_to_action: activeCampaignVar.ctaButton,
    };
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));
    if (
      activeCampaignVar.imageUrl &&
      !activeCampaignVar.imageUrl.startsWith("data:image/svg")
    ) {
      setImageUrl(activeCampaignVar.imageUrl);
      setResult(activeCampaignVar.imageUrl);
      setImageIsFallback(false);
    }
  }, [
    activeCampaignVar?.headline,
    activeCampaignVar?.bodyText,
    activeCampaignVar?.ctaButton,
    activeCampaignVar?.imageUrl,
    page,
  ]);

  // While generating a new post: clear local preview image so old FAL URLs never flash
  useEffect(() => {
    if (!studio.isLoading) return;
    setImageUrl(null);
    setResult(null);
    setImageIsFallback(false);
  }, [studio.isLoading]);

  useEffect(() => {
    if (!bizName && page.businessName) setBizName(page.businessName);
  }, [page.businessName, bizName]);

  useEffect(() => {
    setStudioMeta({
      businessName: bizName || page.businessName || "",
      category: niche || "",
    });
  }, [bizName, niche, page.businessName]);

  // Keep live preview in sync when store selection / variations change
  useEffect(() => {
    if (!selectedVariation) return;
    const next: SocialPostFields = {
      headline: selectedVariation.headline,
      body: selectedVariation.bodyText,
      hashtags: loadCurrentPost()?.hashtags || [],
      call_to_action: selectedVariation.ctaButton,
    };
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));
    if (
      selectedVariation.imageUrl &&
      !selectedVariation.imageUrl.startsWith("data:image/svg")
    ) {
      setImageUrl(selectedVariation.imageUrl);
      setResult(selectedVariation.imageUrl);
      setImageIsFallback(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page identity churns; text/image fields are the sync source
  }, [
    selectedVariation?.id,
    selectedVariation?.headline,
    selectedVariation?.bodyText,
    selectedVariation?.ctaButton,
    selectedVariation?.imageUrl,
  ]);

  const onActivePostChange = useCallback(
    (p: CampaignPost | null) => {
      if (!p) {
        setCampaignPreview(null);
        setPlatforms(null);
        return;
      }
      const next: SocialPostFields = {
        headline: p.title,
        body: p.body,
        hashtags: loadCurrentPost()?.hashtags || page.firstPost?.hashtags || [],
        call_to_action: p.cta,
      };
      setCampaignPreview((prev) => {
        if (
          prev &&
          prev.headline === next.headline &&
          prev.body === next.body &&
          prev.call_to_action === next.call_to_action
        ) {
          return prev;
        }
        return next;
      });
      setPlatforms(resolvePlatforms(next, page));
      // Persist text; keep existing image_url
      const saved = saveCurrentPost({
        headline: p.title,
        body: p.body,
        cta: p.cta || "",
        hashtags: next.hashtags,
        offer: p.hook,
        network: previewChannelToNetwork(previewChannel),
      });
      void syncCurrentPostToServer(saved);
    },
    [page, previewChannel]
  );

  function onFace(files: FileList | null) {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setFace(String(reader.result));
    reader.readAsDataURL(files[0]!);
  }

  function applyVariationToPreview(v: CampaignVariation, userText?: string) {
    const next: SocialPostFields = {
      headline: v.headline,
      body: v.bodyText,
      hashtags: v.hashtags || loadCurrentPost()?.hashtags || [],
      call_to_action: v.ctaButton,
    };
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));
    if (v.imageUrl && !v.imageUrl.startsWith("data:image/svg")) {
      const stamped = v.imageUrl.includes("?")
        ? `${v.imageUrl}&t=${Date.now()}`
        : `${v.imageUrl}?t=${Date.now()}`;
      setImageUrl(stamped);
      setResult(stamped);
      setImageIsFallback(false);
    }
    const saved = saveCurrentPost({
      headline: v.headline,
      body: v.bodyText,
      cta: v.ctaButton,
      hashtags: next.hashtags,
      offer: userText || lastUserText || loadCurrentPost()?.offer || "",
      image_url: v.imageUrl || loadCurrentPost()?.image_url || null,
      image_prompt: v.imagePrompt || null,
      network: previewChannelToNetwork(previewChannel),
    });
    void syncCurrentPostToServer(saved);
  }

  function selectVariation(id: VariationId) {
    selectVariationIndex(id === "var_2" ? 1 : 0);
    const v = variations.find((x) => x.id === id);
    if (v) applyVariationToPreview(v);
  }

  function onInlineEditVariation(
    index: number,
    patch: { headline?: string; bodyText?: string }
  ) {
    const i = index === 1 ? 1 : 0;
    const v = variations[i];
    if (!v) return;
    updateVariationCopy(i, patch);
    const nextHeadline = patch.headline ?? v.headline;
    const nextBody = patch.bodyText ?? v.bodyText;
    // Central campaign store + localStorage (one_loop_active_campaign)
    updateCampaignVariationText(i, nextHeadline, nextBody);
    selectVariationIndex(i);
    const next: SocialPostFields = {
      headline: nextHeadline,
      body: nextBody,
      hashtags: v.hashtags || loadCurrentPost()?.hashtags || [],
      call_to_action: v.ctaButton,
    };
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));
    if (v.imageUrl && !v.imageUrl.startsWith("data:image/svg")) {
      setImageUrl(v.imageUrl);
      setResult(v.imageUrl);
    }
    const saved = saveCurrentPost({
      headline: nextHeadline,
      body: nextBody,
      cta: v.ctaButton,
      hashtags: next.hashtags,
      offer: lastUserText || loadCurrentPost()?.offer || "",
      image_url: v.imageUrl || loadCurrentPost()?.image_url || null,
      image_prompt: v.imagePrompt || null,
      network: previewChannelToNetwork(previewChannel),
    });
    void syncCurrentPostToServer(saved);
  }

  async function handleRegenerateImage(opts?: {
    descriptionOverride?: string;
    /** Regenerate ONLY this A/B card (0 or 1). Defaults to selected. */
    variationIndex?: number;
  }) {
    const profileNiche = loadProfile()?.niche;
    const category =
      normalizeCategory(niche) ||
      normalizeCategory(profileNiche) ||
      null;
    const nicheForApi = category
      ? legacyNicheFromCategory(category)
      : niche || profileNiche || page.tagline;
    const stored = loadCurrentPost();
    const targetIndex =
      opts?.variationIndex === 1
        ? 1
        : opts?.variationIndex === 0
          ? 0
          : studio.selectedVariationIndex;
    const activeVar =
      variations[targetIndex] ||
      variations.find((v) => v.id === selectedVarId);
    const description = (
      opts?.descriptionOverride ||
      activeVar?.imagePrompt ||
      prompt.trim() ||
      [campaignPreview?.headline, campaignPreview?.body, stored?.offer]
        .filter(Boolean)
        .join("\n") ||
      `${page.businessName} ${page.tagline}`.trim() ||
      "local business"
    ).trim();
    const { randomImageSeed, withRegenAngleHint, bustImageUrl } = await import(
      "@/lib/olar/image-cache-bust"
    );
    const newSeed = randomImageSeed();
    const updatedPrompt = withRegenAngleHint(description);
    const previousPrompt =
      activeVar?.imagePrompt || stored?.image_prompt || null;
    const anchorsPayload = studio.imageAnchorWords?.trim() || undefined;

    // Keep previous image visible under skeleton — avoid "empty / broken" flash
    setImageLoading(true);
    setImageLoadingIndex(targetIndex);
    setSoftToast(null);
    setImageIsFallback(false);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: updatedPrompt,
          description: updatedPrompt,
          category: category ?? undefined,
          businessName: bizName || page.businessName,
          niche: nicheForApi,
          purpose:
            tab === "headshot" ? "headshot" : tab === "banner" ? "banner" : "post",
          aspectRatio:
            tab === "campaign"
              ? aspectRatioForChannel(previewChannel)
              : tab === "headshot"
                ? "1:1"
                : "16:9",
          seed: newSeed,
          bustCache: Date.now(),
          regenerate: true,
          previousPrompt,
          imageAnchorWords: anchorsPayload,
        }),
        signal: AbortSignal.timeout(CLIENT_IMAGE_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as {
        soft_message?: string;
        fallback?: boolean;
        isFallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
        imageUrl?: string;
      };
      let url = data.image?.url || data.imageUrl;
      let usedClientFallback = false;
      if (!url || url.startsWith("data:image/svg")) {
        url = getCategoryFallback(
          category || profileNiche,
          description,
          newSeed
        );
        usedClientFallback = true;
      }
      // Display bust for browser cache; persist clean URL
      const { cleanImageUrl } = await import("@/lib/olar/image-cache-bust");
      const displayUrl = bustImageUrl(url) || `${url}?t=${Date.now()}`;
      const persistUrl = cleanImageUrl(url) || url;
      const asFallback =
        Boolean(data.fallback || data.isFallback) || usedClientFallback;
      // Update ONLY this card's image in central store
      const stampedPersist = `${persistUrl}${persistUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      updateVariationImage(targetIndex, {
        imageUrl: stampedPersist,
        imagePrompt: data.image?.prompt ?? updatedPrompt,
      });
      if (targetIndex === studio.selectedVariationIndex) {
        setImageUrl(displayUrl);
        setResult(displayUrl);
        setImageIsFallback(asFallback);
      }
      const preview = campaignPreview || {
        headline: bizName || page.businessName || "",
        body: prompt || page.tagline || page.description || "",
        hashtags: page.firstPost?.hashtags || [],
        call_to_action: page.firstPost?.cta,
      };
      const saved = saveCurrentPost({
        headline: preview.headline,
        body: preview.body,
        cta: preview.call_to_action || "",
        hashtags: preview.hashtags || page.firstPost?.hashtags || [],
        image_url: asFallback ? null : persistUrl,
        image_seed: data.image?.seed ?? newSeed,
        image_prompt: data.image?.prompt ?? updatedPrompt,
        network: previewChannelToNetwork(previewChannel),
      });
      saveCurrentPostImage({
        image_url: persistUrl,
        image_seed: data.image?.seed ?? newSeed,
        image_prompt: data.image?.prompt ?? updatedPrompt,
        fallback: asFallback,
      });
      void syncCurrentPostToServer(saved);
      setSoftToast(data.soft_message || C.aiSoftReady);
    } catch (err) {
      console.error("[Studio] generate-image failed", err);
      const { bustImageUrl: bust } = await import("@/lib/olar/image-cache-bust");
      const url =
        bust(
          getCategoryFallback(category || profileNiche, description, newSeed)
        ) || getCategoryFallback(category || profileNiche, description, newSeed);
      if (targetIndex === studio.selectedVariationIndex) {
        setImageUrl(url);
        setResult(url);
        setImageIsFallback(true);
      }
      updateVariationImage(targetIndex, {
        imageUrl: url,
        imagePrompt: updatedPrompt,
      });
      setSoftToast(C.generateErrorRetry);
    } finally {
      setImageLoading(false);
      setImageLoadingIndex(null);
    }
  }

  async function generatePostImage() {
    await handleRegenerateImage();
  }

  function onVariationsReady(
    nextVars: CampaignVariation[],
    userText: string
  ) {
    // Variations already written to central store by CampaignGenerator
    setLastUserText(userText);
    setPrompt(userText);
    persistActivePost();
    const firstImg = nextVars[0]?.imageUrl;
    if (firstImg && !firstImg.startsWith("data:image/svg")) {
      setImageUrl(firstImg);
      setResult(firstImg);
      setImageIsFallback(false);
    }
  }

  function onPostReady(draft: {
    headline: string;
    body: string;
    cta: string;
    imagePrompt?: string;
    imageUrl?: string | null;
    userText: string;
    variationId?: VariationId;
  }) {
    // Immediately populate Live Preview — never leave empty / "Missing Card"
    setLastUserText(draft.userText);
    if (draft.variationId) {
      selectVariationIndex(draft.variationId === "var_2" ? 1 : 0);
    }
    const next: SocialPostFields = {
      headline: draft.headline,
      body: draft.body,
      hashtags: loadCurrentPost()?.hashtags || page.firstPost?.hashtags || [],
      call_to_action: draft.cta,
    };
    setPrompt(draft.userText);
    setCampaignPreview(next);
    setPlatforms(resolvePlatforms(next, page));

    const hasAbImage =
      Boolean(draft.imageUrl) &&
      !draft.imageUrl!.startsWith("data:image/svg");

    if (hasAbImage) {
      const stamped = draft.imageUrl!.includes("?")
        ? `${draft.imageUrl}&t=${Date.now()}`
        : `${draft.imageUrl}?t=${Date.now()}`;
      setImageUrl(stamped);
      setResult(stamped);
      setImageIsFallback(false);
      setImageLoading(false);
    }

    const saved = saveCurrentPost({
      headline: draft.headline,
      body: draft.body,
      cta: draft.cta,
      hashtags: next.hashtags,
      offer: draft.userText,
      image_url: hasAbImage
        ? draft.imageUrl!
        : loadCurrentPost()?.image_url || null,
      image_prompt: draft.imagePrompt || null,
      network: previewChannelToNetwork(previewChannel),
    });
    void syncCurrentPostToServer(saved);

    // A/B already shipped two images — only regenerate if missing
    if (!hasAbImage) {
      void handleRegenerateImage({
        descriptionOverride: [
          draft.userText,
          draft.headline,
          draft.body,
          draft.imagePrompt,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
  }

  async function generate() {
    if (tab === "campaign") return;
    setGenerating(true);
    setResult(null);
    setLogoMark(null);
    setSoftToast(null);

    try {
      if (tab === "banner" || tab === "headshot") {
        await generatePostImage();
        return;
      }

      await new Promise((r) => setTimeout(r, 800));
      if (tab === "logo") {
        setLogoMark((bizName.trim() || page.businessName || "A").slice(0, 1));
        setResult("logo");
      }
      setSoftToast(C.aiSoftReady);
    } catch {
      setSoftToast(C.generateErrorRetry);
    } finally {
      setGenerating(false);
    }
  }

  const placeholder =
    tab === "banner" ? C.phBanner : tab === "logo" ? C.phLogo : C.phHead;

  const ctaLabel =
    generating || imageLoading
      ? aiProgress || C.making
      : tab === "banner"
        ? C.makeBanner
        : tab === "logo"
          ? C.makeLogo
          : C.makeHead;

  const canGenerate =
    !generating &&
    !imageLoading &&
    (tab === "headshot"
      ? Boolean(face) || Boolean(prompt.trim())
      : tab === "logo"
        ? Boolean(bizName.trim())
        : true);

  // Never show Missing Card — prefer live variation / campaign / last saved
  const hasLivePost = Boolean(
    (studio.variations &&
      studio.variations[0]?.headline?.trim() &&
      studio.variations[0]?.bodyText?.trim()) ||
      (activeCampaignVar?.headline?.trim() &&
        activeCampaignVar?.bodyText?.trim()) ||
      (campaignPreview?.headline?.trim() && campaignPreview?.body?.trim())
  );
  const fallbackPost: SocialPostFields = {
    headline:
      activeCampaignVar?.headline?.trim() ||
      loadCurrentPost()?.headline ||
      bizName ||
      page.businessName ||
      C.myBiz,
    body:
      activeCampaignVar?.bodyText?.trim() ||
      loadCurrentPost()?.body ||
      prompt ||
      page.tagline ||
      page.description ||
      "",
    hashtags: page.firstPost?.hashtags || loadCurrentPost()?.hashtags || [],
    call_to_action:
      activeCampaignVar?.ctaButton ||
      loadCurrentPost()?.cta ||
      page.firstPost?.cta,
  };
  // Ban empty / "Missing Card" shells — always show real copy when available
  const activePost: SocialPostFields = (() => {
    const raw = campaignPreview || fallbackPost;
    const headline = (raw.headline || "").trim();
    const body = (raw.body || "").trim();
    if (
      !headline ||
      /^missing\s*card/i.test(headline) ||
      headline === "Missing Card 0"
    ) {
      return {
        ...raw,
        headline:
          selectedVariation?.headline?.trim() ||
          activeCampaignVar?.headline?.trim() ||
          loadCurrentPost()?.headline?.trim() ||
          bizName ||
          page.businessName ||
          C.myBiz,
        body:
          body ||
          selectedVariation?.bodyText?.trim() ||
          activeCampaignVar?.bodyText?.trim() ||
          loadCurrentPost()?.body?.trim() ||
          page.tagline ||
          "",
      };
    }
    return raw;
  })();
  const activePlatforms =
    platforms || resolvePlatforms(activePost, page);
  const previewPost = platformToCardData(
    activePost,
    activePlatforms,
    previewChannel
  );

  // Prefer persisted FAL URL; face preview only for headshot shell when no FAL yet
  const previewImage =
    imageUrl ||
    (typeof result === "string" &&
    (result.startsWith("http") || result.startsWith("data:"))
      ? result
      : face && tab === "headshot"
        ? face
        : null);

  function selectPreviewChannel(ch: PreviewChannel) {
    // UI shell only — never reset image_url
    setPreviewChannel(ch);
    const stored = loadCurrentPost();
    if (stored) {
      saveCurrentPost({
        ...stored,
        network: previewChannelToNetwork(ch),
      });
    }
  }

  async function copyChannelText() {
    const text = formatChannelShareText(
      activePost,
      activePlatforms,
      previewChannel,
      page
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyToast(C.platformCopied);
      window.setTimeout(() => setCopyToast(null), 1800);
    } catch {
      /* ignore */
    }
  }

  function shareChannel() {
    if (previewChannel === "whatsapp") {
      const postText = formatChannelShareText(
        activePost,
        activePlatforms,
        "whatsapp",
        page
      );
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(postText)}`,
        "_blank"
      );
      return;
    }
    void copyChannelText();
  }

  async function downloadActiveImage() {
    const url =
      previewImage ||
      selectedVariation?.imageUrl ||
      studio.variations?.[studio.selectedVariationIndex]?.imageUrl ||
      null;
    if (!url || url.startsWith("data:image/svg")) {
      setSoftToast("אין תמונה להורדה עדיין — המתינו לסיום היצירה.");
      return;
    }
    const result = await downloadImageDirect(
      url,
      `oneloop-post-${Date.now()}.png`
    );
    setSoftToast(
      result.ok
        ? "התמונה הורדה ✓"
        : result.openedInTab
          ? "נפתח חלון חדש — שמרו את התמונה ידנית (Ctrl+S)"
          : "ההורדה נכשלה — נסו שוב"
    );
    window.setTimeout(() => setSoftToast(null), 2800);
  }

  async function schedulePostToCalendar() {
    const headline =
      selectedVariation?.headline?.trim() ||
      activePost.headline?.trim() ||
      "פוסט חדש";
    const body =
      selectedVariation?.bodyText?.trim() || activePost.body?.trim() || "";
    const cta =
      selectedVariation?.ctaButton?.trim() ||
      activePost.call_to_action?.trim() ||
      "";
    const imageUrl =
      previewImage ||
      selectedVariation?.imageUrl ||
      studio.variations?.[studio.selectedVariationIndex]?.imageUrl ||
      null;

    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 2);

    // Also persist to SQLite campaigns (שמור ותזמן ליומן)
    void postCampaignToDb({
      title: headline,
      bodyText: body,
      imageUrl:
        imageUrl && !imageUrl.startsWith("data:image/svg") ? imageUrl : "",
      hashtags: activePost.hashtags || [],
      platform: "Instagram",
    });

    // Primary: persist under localStorage `one_loop_scheduled_posts`
    const local = schedulePost({
      headline,
      bodyText: body,
      ctaButton: cta,
      imageUrl: imageUrl && !imageUrl.startsWith("data:image/svg") ? imageUrl : null,
      scheduledAt: start,
    });

    // Best-effort: also sync to server calendar + ICS / Google
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const ev = await createCalendarEvent({
      title: `פוסט: ${headline.slice(0, 80)}`,
      description: [body, imageUrl ? `תמונה: ${imageUrl}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      event_type: "post",
      status: "scheduled",
      reminder_minutes: 30,
      service_type: "פוסט מתוזמן",
    });
    if (ev) {
      try {
        downloadIcsBlob(buildIcsCalendar([ev]), `oneloop-post-${ev.id}.ics`);
      } catch {
        /* soft */
      }
      try {
        window.open(googleCalendarUrl(ev), "_blank", "noopener,noreferrer");
      } catch {
        /* soft */
      }
    }

    const whenLabel = new Date(local.scheduledAt).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
    setSoftToast(
      ev
        ? `תוזמן ליומן ✓ · ${whenLabel}`
        : `נשמר ביומן המקומי ✓ · ${whenLabel}`
    );
    window.setTimeout(() => setSoftToast(null), 3200);
  }

  const fbAccount = getSocialAccount(networks, "facebook");
  const igAccount = getSocialAccount(networks, "instagram");

  async function handlePublishClick(
    platform: SocialPlatform,
    opts?: {
      caption?: string;
      imageUrl?: string | null;
    }
  ) {
    const account = getSocialAccount(networks, platform);
    const caption =
      opts?.caption ??
      formatChannelShareText(
        activePost,
        activePlatforms,
        platform,
        page
      );
    const rawImg = opts?.imageUrl !== undefined ? opts.imageUrl : previewImage;
    const img =
      rawImg &&
      (rawImg.startsWith("http") || rawImg.startsWith("data:"))
        ? rawImg
        : null;

    if (account.mode === "assisted_personal") {
      setPublishBusy(true);
      try {
        const result = await executeAssistedPublish({
          platform,
          text: caption,
          imageUrl: img,
          profileUrl: account.profileUrl || networks[platform]?.pageUrl,
        });
        setAssistedMeta({
          clipboardOk: result.clipboardOk,
          downloadOk: result.downloadOk,
          imageOpenedInTab: result.imageOpenedInTab,
        });
        setAssistedPlatform(platform);
        setAssistedOpen(true);
      } finally {
        setPublishBusy(false);
      }
      return;
    }

    if (!img || !img.startsWith("http")) {
      setSoftToast(
        "לפרסום אוטומטי נדרשת תמונה עם קישור http — נסו שוב אחרי יצירת תמונה, או עברו למצב 3 קליקים"
      );
      window.setTimeout(() => setSoftToast(null), 4000);
      return;
    }

    setPublishBusy(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          caption,
          imageUrl: img,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;
      if (data?.ok) {
        setSoftToast(data.message || C.publishApiOk || "פורסם בהצלחה");
      } else {
        setSoftToast(
          data?.error || C.publishApiFail || "הפרסום האוטומטי נכשל"
        );
      }
      window.setTimeout(() => setSoftToast(null), 4500);
    } catch {
      setSoftToast(C.publishApiFail || "הפרסום האוטומטי נכשל");
      window.setTimeout(() => setSoftToast(null), 4500);
    } finally {
      setPublishBusy(false);
    }
  }

  const publishBar = (
    <PublishPlatformButtons
      facebookMode={fbAccount.mode}
      instagramMode={igAccount.mode}
      busy={publishBusy}
      onPublish={(p) => void handlePublishClick(p)}
    />
  );

  const channelTabs = (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PREVIEW_CHANNEL_TABS.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => selectPreviewChannel(n.id)}
          className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${
            previewChannel === n.id
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-800"
          }`}
        >
          <BrandGlyph id={n.glyph} size={14} />
          {n.label}
        </button>
      ))}
    </div>
  );

  const shareActions = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button
        type="button"
        onClick={() => void copyChannelText()}
        className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-900 hover:bg-slate-50 sm:w-auto"
      >
        <Copy className="h-4 w-4 text-slate-600" />
        {copyToast || C.copyPlatformText}
      </button>
      <button
        type="button"
        onClick={() => void downloadActiveImage()}
        className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-base font-medium text-sky-900 hover:bg-sky-100 sm:w-auto"
      >
        <Download className="h-4 w-4" />
        הורד תמונה (PNG)
      </button>
      <button
        type="button"
        onClick={() => void schedulePostToCalendar()}
        className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-base font-medium text-violet-900 hover:bg-violet-100 sm:w-auto"
      >
        <CalendarPlus className="h-4 w-4" />
        שמור ותזמן ליומן
      </button>
      {previewChannel === "whatsapp" ? (
        <button
          type="button"
          onClick={shareChannel}
          className="flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-base font-medium text-white hover:brightness-110 sm:w-auto"
        >
          <Share2 className="h-4 w-4" />
          {C.sendWaCard || C.waSendCard}
        </button>
      ) : null}
    </div>
  );

  // Single-card flow — never show dual A/B Option 1 / Option 2 grid
  const showAbGrid = false;

  const previewCard = (
    <div className="flex w-full flex-col gap-3">
      {channelTabs}

      {showAbGrid ? (
        <>
          <p className="text-right text-base font-semibold text-slate-800">
            {C.abOptionsHeader}
          </p>
          {/* Quick tabs — swap selection instantly; both cards stay visible below */}
          <div className="grid grid-cols-2 gap-2" dir="rtl">
            {variations.slice(0, 2).map((v, i) => {
              const isSelected = selectedVarId === v.id;
              return (
                <button
                  key={`tab-${v.id}`}
                  type="button"
                  onClick={() => selectVariation(v.id)}
                  className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${
                    isSelected
                      ? i === 0
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "bg-purple-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {i === 0 ? "✨ אופציה 1" : "🎯 אופציה 2"}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            {variations.slice(0, 2).map((v, i) => {
              const isSelected = selectedVarId === v.id;
              const cardPost: SocialPostFields = {
                headline: v.headline,
                body: v.bodyText,
                hashtags: v.hashtags || [],
                call_to_action: v.ctaButton,
              };
              const cardPlatforms = resolvePlatforms(cardPost, page);
              const cardPreview = platformToCardData(
                cardPost,
                cardPlatforms,
                previewChannel
              );
              const cardImage =
                v.imageUrl && !v.imageUrl.startsWith("data:image/svg")
                  ? v.imageUrl
                  : isSelected
                    ? previewImage
                    : null;
              return (
                <div
                  key={v.id}
                  className={`flex h-full flex-col gap-3 rounded-2xl p-1 transition ${
                    isSelected
                      ? "ring-2 ring-offset-2 " +
                        (i === 0 ? "ring-cyan-500" : "ring-purple-500")
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectVariation(v.id)}
                    className={`inline-flex w-fit shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-white ${
                      i === 0 ? "bg-cyan-600" : "bg-purple-600"
                    }`}
                  >
                    {i === 0 ? C.option1Badge : C.option2Badge}
                  </button>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectVariation(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectVariation(v.id);
                      }
                    }}
                    className="min-h-0 w-full flex-1 text-right"
                  >
                    <PostCardPreview
                      className="h-full max-w-none"
                      squareImage
                      network={previewChannelToNetwork(previewChannel)}
                      businessName={bizName || page.businessName || C.myBiz}
                      logoUrl={page.logoUrl || page.avatarUrl}
                      post={cardPreview}
                      imageUrl={cardImage}
                        imageLoading={
                          imageLoadingIndex === i ||
                          ((studio.isLoading || studio.imagesPending) &&
                            !cardImage)
                        }
                      isFallback={isSelected ? imageIsFallback : false}
                      editable={previewChannel !== "whatsapp"}
                      onHeadlineChange={(headline) =>
                        onInlineEditVariation(i, { headline })
                      }
                      onBodyChange={(bodyText) =>
                        onInlineEditVariation(i, { bodyText })
                      }
                      waHref={
                        previewChannel === "whatsapp"
                          ? whatsappCardShareHref(
                              cardPost,
                              cardPlatforms,
                              page
                            )
                          : null
                      }
                    />
                  </div>
                  <div className="mt-auto flex shrink-0 flex-col gap-2">
                    {previewChannel !== "whatsapp" ? (
                      <PublishPlatformButtons
                        facebookMode={fbAccount.mode}
                        instagramMode={igAccount.mode}
                        busy={publishBusy}
                        onPublish={(p) => {
                          selectVariation(v.id);
                          const live = variations[i] || v;
                          const livePost: SocialPostFields = {
                            headline: live.headline,
                            body: live.bodyText,
                            hashtags: live.hashtags || [],
                            call_to_action: live.ctaButton,
                          };
                          const caps = resolvePlatforms(livePost, page);
                          const cap = formatChannelShareText(
                            livePost,
                            caps,
                            p,
                            page
                          );
                          void handlePublishClick(p, {
                            caption: cap,
                            imageUrl: cardImage,
                          });
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={imageLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectVariation(v.id);
                        void handleRegenerateImage({
                          variationIndex: i,
                          descriptionOverride: v.imagePrompt || undefined,
                        });
                      }}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {C.swapThisImage}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {shareActions}
        </>
      ) : hasLivePost || previewPost.headline?.trim() ? (
        <>
          <PostCardPreview
            className="w-full max-w-full"
            squareImage
            network={previewChannelToNetwork(previewChannel)}
            businessName={bizName || page.businessName || C.myBiz}
            logoUrl={page.logoUrl || page.avatarUrl}
            post={previewPost}
            imageUrl={previewImage}
            imageLoading={
              imageLoading ||
              ((studio.isLoading || studio.imagesPending) && !previewImage)
            }
            isFallback={imageIsFallback}
            editable={previewChannel !== "whatsapp"}
            onHeadlineChange={(headline) => {
              if (variations.length >= 1) {
                onInlineEditVariation(
                  selectedVarId === "var_2" ? 1 : 0,
                  { headline }
                );
              } else {
                setCampaignPreview((prev) =>
                  prev ? { ...prev, headline } : prev
                );
                const saved = saveCurrentPost({
                  headline,
                  body: activePost.body,
                  cta: activePost.call_to_action || "",
                  hashtags: activePost.hashtags,
                  image_url: previewImage,
                  network: previewChannelToNetwork(previewChannel),
                });
                void syncCurrentPostToServer(saved);
              }
            }}
            onBodyChange={(body) => {
              if (variations.length >= 1) {
                onInlineEditVariation(
                  selectedVarId === "var_2" ? 1 : 0,
                  { bodyText: body }
                );
              } else {
                setCampaignPreview((prev) =>
                  prev ? { ...prev, body } : prev
                );
                const saved = saveCurrentPost({
                  headline: activePost.headline,
                  body,
                  cta: activePost.call_to_action || "",
                  hashtags: activePost.hashtags,
                  image_url: previewImage,
                  network: previewChannelToNetwork(previewChannel),
                });
                void syncCurrentPostToServer(saved);
              }
            }}
            onRetryImage={() => void handleRegenerateImage()}
            waHref={
              previewChannel === "whatsapp"
                ? whatsappCardShareHref(activePost, activePlatforms, page)
                : null
            }
            publishActions={
              previewChannel !== "whatsapp" ? publishBar : undefined
            }
          />
          {shareActions}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <p className="text-base font-semibold text-slate-800">
            שלחו הודעה בסטודיו — הכרטיס יופיע כאן מיד
          </p>
          <p className="mt-2 text-sm text-slate-600">
            כתבו על העסק ולחצו שליחה — התצוגה תתעדכן מיד.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-hidden"
      dir="rtl"
    >
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

      <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-x-hidden overflow-hidden lg:grid lg:grid-cols-2">
        {/* Preview — top on mobile toggle; right column on lg+ */}
        <aside
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${
            mobilePane === "preview" ? "flex" : "hidden"
          } lg:order-2 lg:flex`}
        >
          <div className="flex h-full max-h-full flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 lg:max-h-[calc(100vh-120px)]">
            {previewCard}
          </div>
        </aside>

        {/* Maya chat / tabs */}
        <section
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${
            mobilePane === "chat" ? "flex" : "hidden"
          } lg:order-1 lg:flex`}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-28 lg:pb-8 animate-rise">
            <header className="text-right">
              <h1 className="text-right text-xl font-bold text-slate-800 sm:text-2xl lg:text-3xl">
                {C.yonaTitle}
              </h1>
              <p className="mt-1 break-words text-base text-slate-800 sm:text-lg">
                {C.studioTitle}
              </p>
            </header>

            <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-accent-soft/50 p-1 sm:grid-cols-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setResult(null);
                    setLogoMark(null);
                    // Keep imageUrl — tab switch must not wipe the FAL image
                  }}
                  className={`min-h-12 break-words rounded-xl text-base font-medium transition sm:min-h-14 ${
                    tab === t.id
                      ? "border border-accent bg-white text-slate-900 shadow-md ring-2 ring-accent"
                      : "text-slate-800 hover:bg-white/70"
                  }`}
                >
                  {C[t.labelKey]}
                </button>
              ))}
            </div>

            {tab === "campaign" &&
            wingman.shown &&
            wingman.replyMessage &&
            studio.messages.length <= 1 ? (
              <WingmanGreetingCard
                replyMessage={wingman.replyMessage}
                chips={[]}
              />
            ) : null}

            {tab === "campaign" ? (
              <CampaignGenerator
                initialTopic={
                  prompt || `${page.businessName} ${page.tagline}`.trim()
                }
                previewNetwork={previewChannelToNetwork(previewChannel)}
                onPreviewNetworkChange={(n) =>
                  selectPreviewChannel(networkToPreviewChannel(n))
                }
                onActivePostChange={onActivePostChange}
                onPostReady={onPostReady}
                onVariationsReady={onVariationsReady}
                category={
                  normalizeCategory(niche) ||
                  normalizeCategory(loadProfile()?.niche) ||
                  null
                }
                businessName={bizName || page.businessName}
                hideNetworkTabs
              />
            ) : null}

            {tab !== "campaign" && tab !== "logo" ? (
              <label className="block w-full text-right text-base font-medium text-slate-900">
                {C.tellUs}
                <textarea
                  dir="rtl"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={placeholder}
                  className="mt-2 min-h-28 w-full break-words rounded-2xl border border-sky-100 bg-white p-4 text-right text-base leading-relaxed text-slate-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                />
              </label>
            ) : null}

            {tab === "headshot" && (
              <div
                className="w-full rounded-2xl border-2 border-dashed border-sky-100 bg-white p-6 text-center shadow-lg shadow-slate-200/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFace(e.dataTransfer.files);
                }}
              >
                {face ? (
                  <div className="relative mx-auto max-w-xs overflow-hidden rounded-2xl border border-sky-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={face}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFace(null)}
                      className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/70 text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="mx-auto h-10 w-10 text-accent" />
                    <p className="mt-3 text-base font-bold text-slate-900">
                      {C.uploadFace}
                    </p>
                    <p className="mt-1 text-base text-slate-800">
                      {C.uploadFaceHelp}
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => faceRef.current?.click()}
                  className="olar-cta mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-base"
                >
                  <Upload className="h-4 w-4" />
                  {C.uploadBtn}
                </button>
                <input
                  ref={faceRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onFace(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {tab === "banner" && (
              <div className="rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
                <div className="flex items-center justify-end gap-2 text-accent">
                  <p className="break-words text-base font-medium text-slate-800">
                    {C.bannerHelp}
                  </p>
                  <PanelsTopLeft className="h-5 w-5 shrink-0" />
                </div>
              </div>
            )}

            {tab === "logo" && (
              <div className="space-y-4 rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-lg shadow-slate-200/50">
                <label className="block text-base font-medium text-slate-900">
                  {C.logoBizName}
                  <input
                    dir="rtl"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder={C.logoBizNamePh}
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="block text-base font-medium text-slate-900">
                  {C.logoNiche}
                  <input
                    dir="rtl"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder={C.logoNichePh}
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-right text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  />
                </label>
              </div>
            )}

            {tab !== "campaign" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                  className="olar-cta flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-center text-base disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="break-words leading-snug">{ctaLabel}</span>
                </button>
                {(tab === "banner" || tab === "headshot") && (
                  <button
                    type="button"
                    disabled={imageLoading}
                    onClick={() => void generatePostImage()}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 text-base font-medium text-slate-900 disabled:opacity-50"
                  >
                    <ImagePlus className="h-5 w-5" />
                    {imageLoading
                      ? C.imageLoading || C.making
                      : C.makePostImage || C.makeBanner}
                  </button>
                )}
              </div>
            ) : null}

            {generating || imageLoading ? (
              <p className="animate-rise text-center text-base font-medium text-accent">
                {aiProgress}
              </p>
            ) : null}
            {softToast && !generating && !imageLoading ? (
              <p className="break-words rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-base font-medium text-emerald-900">
                {softToast}
              </p>
            ) : null}

            {result === "logo" && (
              <div className="rounded-2xl border border-sky-100 bg-white p-6 text-right shadow-lg shadow-slate-200/50">
                <p className="text-base font-bold text-slate-900">
                  {C.resultDemo} - {C.logoReady}
                </p>
                <div className="mx-auto mt-4 flex h-36 w-36 items-center justify-center rounded-3xl bg-accent text-5xl font-bold text-white shadow-md shadow-sky-600/20">
                  {logoMark}
                </div>
                <p className="mt-3 break-words text-center text-lg font-bold text-slate-900">
                  {bizName}
                </p>
              </div>
            )}

            <FooterBrand />
          </div>
        </section>
      </div>

      <AssistedPublishModal
        open={assistedOpen}
        platform={assistedPlatform}
        clipboardOk={assistedMeta.clipboardOk}
        downloadOk={assistedMeta.downloadOk}
        imageOpenedInTab={assistedMeta.imageOpenedInTab}
        onClose={() => {
          setAssistedOpen(false);
          setAssistedPlatform(null);
        }}
      />
    </div>
  );
}
