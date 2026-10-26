"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ONBOARDING_KEY,
  buildProfileFromInput,
  clearOnboardingSession,
  markOnboardingDone,
  saveProfile,
  type BusinessProfile,
} from "@/lib/olar/business-profile";
import {
  saveCurrentPost,
  saveCurrentPostImage,
  syncCurrentPostToServer,
} from "@/lib/olar/current-post";
import {
  bindGuestSessionCleanup,
  stageOAuthBridgeFromSession,
  storageGet,
  storageSet,
} from "@/lib/olar/client-storage";
import { stripCategoryLeak } from "@/lib/olar/strip-category";
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { signInWithGoogle } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import {
  ExampleChips,
  type BusinessCategoryId,
} from "@/components/olar/ExampleChips";
import {
  categoryLabel,
  legacyNicheFromCategory,
} from "@/lib/olar/business-categories";
import { getCategoryFallback } from "@/lib/olar/category-fallbacks";
import { CLIENT_IMAGE_TIMEOUT_MS } from "@/lib/api/fetch-with-retry";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { DEFAULT_POST_TYPE } from "@/lib/olar/post-types";
import { FooterBrand } from "@/components/olar/FooterBrand";
import {
  VAR_1_LABEL,
  padVariationPair,
  singleGroundedVariation,
  type CampaignVariation,
} from "@/lib/olar/ab-variations";
import { sanitizeVariationCopy } from "@/lib/olar/sanitize-marketing-copy";
import {
  selectVariationIndex,
  setStudioMeta,
  setStudioVariations,
} from "@/lib/store";
import { saveCampaignAndGoToStudio } from "@/lib/olar/campaigns-client";
import { persistSelectedCardToActiveCampaign } from "@/lib/store/campaign-store";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Phone, Sparkles, X } from "lucide-react";

export function useOnboardingGate() {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    bindGuestSessionCleanup();
    try {
      const done =
        storageGet("onboarding-done") === "1" ||
        localStorage.getItem(ONBOARDING_KEY) === "1";
      setShow(!done);
    } catch {
      setShow(true);
    }
    setReady(true);
  }, []);

  function complete() {
    markOnboardingDone();
    setShow(false);
  }

  function restart() {
    clearOnboardingSession();
    setShow(true);
  }

  return { ready, show, complete, restart };
}

type Phase = "land" | "working" | "payoff";

const WORK_MS = 7000;
const LINE_MS = 2300;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("land");
  const [input, setInput] = useState("");
  const [imageAnchorWords, setImageAnchorWords] = useState("");
  const [studioBusy, setStudioBusy] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<BusinessCategoryId | null>(null);
  /** Last chip template auto-filled into textarea (for overwrite guard). */
  const [filledFromChip, setFilledFromChip] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [softToast, setSoftToast] = useState<string | null>(null);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postImageLoading, setPostImageLoading] = useState(false);
  const [imageIsFallback, setImageIsFallback] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  /** A/B variations from generate-post — both shown side-by-side on payoff. */
  const [variations, setVariations] = useState<CampaignVariation[]>([]);
  const [selectedVarIndex, setSelectedVarIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Prevents double-submit on land CTA / Enter before phase flips to working. */
  const magicBusyRef = useRef(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const working = phase === "working";
  const landLocked = magicBusy || working;
  const { message: aiProgress } = useAiProgressMessages(working);

  const workLines = useMemo(
    () => [
      "יוצר עבורך 2 אופציות ותמונות...",
      C.aiProgress1 || C.workLine1,
      C.aiProgress2 || C.workLine2,
      C.aiProgress3 || C.workLine3,
    ],
    []
  );

  useEffect(() => {
    if (phase !== "working") return;
    const lineTimer = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % workLines.length);
    }, LINE_MS);
    return () => {
      window.clearInterval(lineTimer);
    };
  }, [phase, workLines.length]);

  function persistPostDraft(
    p: BusinessProfile,
    imageUrl?: string | null,
    imageMeta?: {
      seed?: number | null;
      prompt?: string | null;
      fallback?: boolean;
    }
  ) {
    const saved = saveCurrentPost({
      headline: stripCategoryLeak(p.firstPost.headline),
      body: stripCategoryLeak(p.firstPost.body),
      cta: stripCategoryLeak(p.firstPost.cta),
      hashtags: p.firstPost.hashtags,
      offer: p.tagline,
      image_url:
        imageMeta?.fallback === true ? null : (imageUrl ?? undefined),
      image_seed: imageMeta?.seed ?? null,
      image_prompt: imageMeta?.prompt ?? null,
      network: "instagram",
    });
    void syncCurrentPostToServer(saved);
    return saved;
  }

  function profileFromVariation(
    base: BusinessProfile,
    v: CampaignVariation
  ): BusinessProfile {
    return {
      ...base,
      tagline: stripCategoryLeak(v.headline),
      description: stripCategoryLeak(v.bodyText).split("\n")[0] || "",
      firstPost: {
        headline: stripCategoryLeak(v.headline),
        body: stripCategoryLeak(v.bodyText),
        cta: stripCategoryLeak(v.ctaButton || ""),
        hashtags: v.hashtags || [],
      },
    };
  }

  function mapApiVariations(
    raw: Array<{
      id?: string;
      label?: string;
      headline?: string;
      bodyText?: string;
      ctaButton?: string;
      imageUrl?: string | null;
      imagePrompt?: string;
      hashtags?: string[];
    }>
  ): CampaignVariation[] {
    const v = raw[0];
    if (!v) return [];
    const cleaned = sanitizeVariationCopy({
      headline: v.headline || "",
      bodyText: v.bodyText || "",
      ctaButton: v.ctaButton || "",
      fallbackCta: "לפרטים בוואטסאפ",
    });
    if (!cleaned.headline || !cleaned.bodyText) return [];
    return padVariationPair({
      id: "var_1",
      label: v.label || VAR_1_LABEL,
      headline: cleaned.headline,
      bodyText: cleaned.bodyText,
      ctaButton: cleaned.ctaButton,
      imagePrompt: v.imagePrompt || "",
      imageUrl: v.imageUrl || null,
      hashtags: v.hashtags || [],
    });
  }

  function selectPayoffVariation(index: number, base?: BusinessProfile | null) {
    const i = index === 1 ? 1 : 0;
    const v = variations[i];
    const p = base || profile;
    if (!v || !p) return;
    setSelectedVarIndex(i);
    selectVariationIndex(i);
    const next = profileFromVariation(p, v);
    setProfile(next);
    const url = v.imageUrl || null;
    setPostImageUrl(url);
    setImageIsFallback(Boolean(url?.startsWith("data:image/svg")));
    persistPostDraft(next, url, {
      prompt: v.imagePrompt || null,
      fallback: Boolean(url?.startsWith("data:image/svg")),
    });
  }

  function updatePayoffCopy(
    index: number,
    patch: { headline?: string; bodyText?: string }
  ) {
    const i = index === 1 ? 1 : 0;
    setVariations((prev) => {
      if (!prev[i]) return prev;
      const nextVars = prev.map((v, idx) =>
        idx === i
          ? {
              ...v,
              headline:
                patch.headline !== undefined
                  ? stripCategoryLeak(patch.headline)
                  : v.headline,
              bodyText:
                patch.bodyText !== undefined
                  ? stripCategoryLeak(patch.bodyText)
                  : v.bodyText,
            }
          : v
      );
      const v = nextVars[i]!;
      if (profile) {
        const next = profileFromVariation(profile, v);
        setProfile(next);
        if (selectedVarIndex === i) {
          persistPostDraft(next, v.imageUrl || postImageUrl);
        }
      }
      return nextVars;
    });
    if (selectedVarIndex !== i) {
      setSelectedVarIndex(i);
      selectVariationIndex(i);
    }
  }

  async function fetchOneOnboardingImage(
    p: BusinessProfile,
    desc: string,
    anglePrompt: string
  ): Promise<{
    url: string;
    seed: number;
    prompt: string | null;
    fallback: boolean;
  }> {
    const category = selectedCategory;
    const { randomImageSeed, bustImageUrl } = await import(
      "@/lib/olar/image-cache-bust"
    );
    const randomSeed = randomImageSeed();
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: anglePrompt,
          prompt: anglePrompt,
          businessName: p.businessName,
          niche: category
            ? legacyNicheFromCategory(category)
            : p.niche,
          category: category ?? undefined,
          purpose: "post",
          aspectRatio: "1:1",
          seed: randomSeed,
          bustCache: Date.now(),
          regenerate: true,
          imageAnchorWords: imageAnchorWords.trim() || undefined,
        }),
        signal: AbortSignal.timeout(CLIENT_IMAGE_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fallback?: boolean;
        isFallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
        imageUrl?: string;
      };
      let url = data.image?.url || data.imageUrl;
      let usedClientFallback = false;
      if (!url || url.startsWith("data:image/svg")) {
        url = getCategoryFallback(category || p.niche, desc, randomSeed);
        usedClientFallback = true;
      }
      url = bustImageUrl(url) || url!;
      return {
        url,
        seed: data.image?.seed ?? randomSeed,
        prompt: data.image?.prompt ?? null,
        fallback: Boolean(data.fallback || data.isFallback) || usedClientFallback,
      };
    } catch {
      const url = getCategoryFallback(category || p.niche, desc, randomSeed);
      return { url, seed: randomSeed, prompt: null, fallback: true };
    }
  }

  async function generateOnboardingImage(
    p: BusinessProfile,
    opts?: { dual?: boolean; variationIndex?: number }
  ) {
    const category = selectedCategory;
    const desc = [
      p.rawInput,
      p.firstPost.headline,
      p.firstPost.body,
      p.businessName,
      p.tagline,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    const { withRegenAngleHint } = await import("@/lib/olar/image-cache-bust");
    setPostImageLoading(true);
    setImageIsFallback(false);
    try {
      if (opts?.dual) {
        // Single-card image fill (dual flag kept for callers; only one FAL image)
        const img0 = await fetchOneOnboardingImage(
          p,
          desc,
          withRegenAngleHint(desc)
        );
        setPostImageUrl(img0.url);
        setImageIsFallback(img0.fallback);
        setVariations((prev) => {
          if (prev.length < 1) return prev;
          const next = padVariationPair({
            ...prev[0]!,
            imageUrl: img0.url,
            imagePrompt: img0.prompt || prev[0]!.imagePrompt,
          });
          setStudioVariations(next);
          return next;
        });
        saveCurrentPostImage({
          image_url: img0.url,
          image_seed: img0.seed,
          image_prompt: img0.prompt,
          fallback: img0.fallback,
        });
        persistPostDraft(p, img0.url, {
          seed: img0.seed,
          prompt: img0.prompt,
          fallback: img0.fallback,
        });
        return;
      }

      // Single-card regen ("החלף תמונה") — update only the selected / requested index
      const target =
        opts?.variationIndex === 1
          ? 1
          : opts?.variationIndex === 0
            ? 0
            : selectedVarIndex === 1
              ? 1
              : 0;
      const img = await fetchOneOnboardingImage(
        p,
        desc,
        withRegenAngleHint(desc)
      );
      setPostImageUrl(img.url);
      setImageIsFallback(img.fallback);
      setVariations((prev) => {
        if (prev.length < 1) return prev;
        const next = prev.map((v, idx) =>
          idx === target
            ? {
                ...v,
                imageUrl: img.url,
                imagePrompt: img.prompt || v.imagePrompt,
              }
            : v
        );
        if (next.length >= 2) {
          setStudioVariations(next as [CampaignVariation, CampaignVariation]);
        }
        return next;
      });
      saveCurrentPostImage({
        image_url: img.url,
        image_seed: img.seed,
        image_prompt: img.prompt,
        fallback: img.fallback,
      });
      persistPostDraft(p, img.url, {
        seed: img.seed,
        prompt: img.prompt,
        fallback: img.fallback,
      });
    } catch (err) {
      console.error("[onboarding] generate-image failed", err);
      const url = getCategoryFallback(category || p.niche, desc);
      setPostImageUrl(url);
      setImageIsFallback(true);
      saveCurrentPostImage({
        image_url: url,
        image_seed: null,
        image_prompt: null,
        fallback: true,
      });
      persistPostDraft(p, url, { fallback: true });
    } finally {
      setPostImageLoading(false);
    }
  }

  function onChipSelect(text: string, id?: BusinessCategoryId | null) {
    setSelectedCategory((prev) => {
      if (id == null) return null;
      return prev === id ? null : id;
    });
    if (id) storageSet("selected-category", id);
    const trimmed = input.trim();
    const canFill =
      !trimmed || (filledFromChip != null && trimmed === filledFromChip.trim());
    if (id == null) {
      if (canFill) {
        setInput("");
        setFilledFromChip(null);
      }
    } else if (canFill) {
      setInput(text);
      setFilledFromChip(text);
    }
    inputRef.current?.focus();
  }

  async function startMagic() {
    if (magicBusyRef.current || phase === "working") return;

    const raw = stripCategoryLeak(input.trim());
    if (!raw) {
      setSoftToast(C.landNeedInput || "כתבו כמה מילים על העסק כדי להתחיל");
      return;
    }

    magicBusyRef.current = true;
    setMagicBusy(true);

    const local = buildProfileFromInput(raw);
    if (selectedCategory) {
      local.niche = legacyNicheFromCategory(selectedCategory);
    }
    setProfile(local);
    setLineIdx(0);
    setPhase("working");
    setSoftToast(null);
    setPostImageUrl(null);
    setImageIsFallback(false);
    setVariations([]);
    setSelectedVarIndex(0);

    const minWait = new Promise((r) => setTimeout(r, Math.min(WORK_MS, 4500)));
    let finalProfile = local;
    const anchorsPayload = imageAnchorWords.trim() || undefined;
    setStudioMeta({
      category: selectedCategory || "",
      postType: DEFAULT_POST_TYPE,
      imageAnchorWords: anchorsPayload || "",
    });

    try {
      // Prefer clean generate-post contract (A/B + parallel images + anchors)
      const genRes = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: raw,
          prompt: raw,
          category: selectedCategory,
          city: local.city || undefined,
          postType: DEFAULT_POST_TYPE,
          imageAnchorWords: anchorsPayload,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const gen = (await genRes.json().catch((parseErr) => {
        console.error("[onboarding] generate-post JSON parse failed", parseErr);
        return {};
      })) as {
        ok?: boolean;
        headline?: string;
        bodyText?: string;
        ctaButton?: string;
        imagePrompt?: string;
        imageUrl?: string | null;
        hashtags?: string[];
        soft_message?: string;
        replyMessage?: string;
        error?: string;
        providerUsed?: string;
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
      };

      if (!genRes.ok || gen.ok === false) {
        console.error("[onboarding] generate-post error payload", {
          status: genRes.status,
          errData: gen,
        });
        if (genRes.status === 429) {
          await minWait;
          setSoftToast(
            (typeof gen.error === "string" && gen.error) ||
              "אנא המתן מספר שניות לפני יצירת פוסט נוסף."
          );
          setPhase("land");
          return;
        }
      } else {
        console.log("[onboarding] generate-post ok", {
          status: genRes.status,
          providerUsed: gen.providerUsed,
          variationCount: Array.isArray(gen.variations)
            ? gen.variations.length
            : 0,
          hasAnchors: Boolean(anchorsPayload),
        });
      }

      await minWait;

      if (gen.ok && (gen.headline || gen.variations?.[0]?.headline)) {
        let nextVars = mapApiVariations(
          Array.isArray(gen.variations) ? gen.variations : []
        );
        if (nextVars.length < 1 && gen.headline && gen.bodyText) {
          const cleaned = sanitizeVariationCopy({
            headline: gen.headline,
            bodyText: gen.bodyText,
            ctaButton: gen.ctaButton || "",
            fallbackCta: "לפרטים בוואטסאפ",
          });
          nextVars = padVariationPair({
            id: "var_1",
            label: VAR_1_LABEL,
            headline: cleaned.headline,
            bodyText: cleaned.bodyText,
            ctaButton: cleaned.ctaButton,
            imagePrompt: gen.imagePrompt || "",
            imageUrl: gen.imageUrl || null,
            hashtags: gen.hashtags || [],
          });
        }

        if (nextVars.length >= 1 && nextVars[0]?.headline && nextVars[0]?.bodyText) {
          const pair = padVariationPair(nextVars[0]!);
          setVariations(pair);
          setSelectedVarIndex(0);
          setStudioVariations(pair);
          selectVariationIndex(0);
          finalProfile = profileFromVariation(local, pair[0]!);
          setProfile(finalProfile);
          const firstUrl = pair[0]!.imageUrl || null;
          setPostImageUrl(firstUrl);
          setImageIsFallback(Boolean(firstUrl?.startsWith("data:image/svg")));
          persistPostDraft(finalProfile, firstUrl, {
            prompt: pair[0]!.imagePrompt || null,
            fallback: Boolean(firstUrl?.startsWith("data:image/svg")),
          });
          setSoftToast(
            gen.soft_message ||
              gen.replyMessage ||
              C.abOptionsHeader ||
              C.aiSoftReady
          );
          setPhase("payoff");
          const hasAnyImage =
            firstUrl && !firstUrl.startsWith("data:image/svg");
          if (!hasAnyImage) {
            void generateOnboardingImage(finalProfile, { dual: true });
          }
          return;
        }
      }

      // Fallback: magic route — forward anchors for parity (image via generate-image)
      const res = await fetch("/api/onboarding/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: raw,
          prompt: raw,
          category: selectedCategory,
          city: local.city || undefined,
          postType: DEFAULT_POST_TYPE,
          imageAnchorWords: anchorsPayload,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        soft_message?: string;
        profile?: Partial<BusinessProfile> & {
          firstPost?: BusinessProfile["firstPost"];
        };
      };

      if (data.profile?.firstPost?.headline && data.profile.firstPost.body) {
        finalProfile = {
          ...local,
          businessName: data.profile.businessName || local.businessName,
          city: data.profile.city || local.city,
          niche: selectedCategory
            ? legacyNicheFromCategory(selectedCategory)
            : (data.profile.niche as BusinessProfile["niche"]) || local.niche,
          tagline: stripCategoryLeak(
            data.profile.tagline || data.profile.firstPost.headline
          ),
          description: stripCategoryLeak(
            data.profile.description || data.profile.firstPost.body
          ),
          firstPost: {
            headline: stripCategoryLeak(data.profile.firstPost.headline),
            body: stripCategoryLeak(data.profile.firstPost.body),
            cta: stripCategoryLeak(data.profile.firstPost.cta || ""),
            hashtags: data.profile.firstPost.hashtags || [],
          },
        };
        const single = singleGroundedVariation({
          userText: raw,
          category: selectedCategory,
          city: finalProfile.city,
          postType: DEFAULT_POST_TYPE,
        });
        const cleaned = sanitizeVariationCopy({
          headline: finalProfile.firstPost.headline,
          bodyText: finalProfile.firstPost.body,
          ctaButton: finalProfile.firstPost.cta || single.variations[0]!.ctaButton,
          fallbackCta: single.variations[0]!.ctaButton,
        });
        const nextVars = padVariationPair({
          ...single.variations[0]!,
          headline: cleaned.headline,
          bodyText: cleaned.bodyText,
          ctaButton: cleaned.ctaButton,
          hashtags: finalProfile.firstPost.hashtags,
          imageUrl: null,
        });
        setVariations(nextVars);
        setSelectedVarIndex(0);
        setStudioVariations(nextVars);
        selectVariationIndex(0);
        setProfile(finalProfile);
        persistPostDraft(finalProfile, null);
        setSoftToast(data.soft_message || single.chat_reply || C.aiSoftReady);
        setPhase("payoff");
        void generateOnboardingImage(finalProfile, { dual: true });
        return;
      }

      console.error("[onboarding] both generate-post and magic failed", {
        gen,
        magic: data,
      });
      setSoftToast(
        gen.error || data.soft_message || C.generateErrorRetry
      );
      setPhase("land");
    } catch (err) {
      console.error("[onboarding] startMagic threw", err);
      await minWait;
      setSoftToast(C.generateErrorRetry);
      setPhase("land");
    } finally {
      magicBusyRef.current = false;
      setMagicBusy(false);
    }
  }

  function saveEditedText() {
    if (!profile) return;
    const combined = editDraft.trim();
    const [firstLine, ...rest] = combined.split("\n");
    const headline = stripCategoryLeak(
      firstLine || profile.firstPost.headline
    );
    const body = stripCategoryLeak(
      rest.join("\n").trim() || profile.firstPost.body
    );
    const next: BusinessProfile = {
      ...profile,
      firstPost: {
        ...profile.firstPost,
        headline,
        body,
      },
    };
    setProfile(next);
    setVariations((prev) => {
      if (prev.length < 1) return prev;
      const i = selectedVarIndex === 1 ? 1 : 0;
      return prev.map((v, idx) =>
        idx === i ? { ...v, headline, bodyText: body } : v
      );
    });
    persistPostDraft(next, postImageUrl);
    setEditingText(false);
  }

  function onUploadImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || !profile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPostImageUrl(url);
      setImageIsFallback(false);
      setVariations((prev) => {
        if (prev.length < 1) return prev;
        const i = selectedVarIndex === 1 ? 1 : 0;
        return prev.map((v, idx) =>
          idx === i ? { ...v, imageUrl: url } : v
        );
      });
      saveCurrentPostImage({ image_url: url, fallback: false });
      persistPostDraft(profile, url);
    };
    reader.readAsDataURL(file);
  }

  function finishToApp() {
    if (profile) {
      saveProfile(profile);
      persistPostDraft(profile, postImageUrl);
    }
    markOnboardingDone();
    try {
      localStorage.removeItem("olar-onboarding-pending");
    } catch {
      /* ignore */
    }
    onDone();
  }

  async function continueToStudio() {
    if (!profile || studioBusy) return;
    setStudioBusy(true);
    try {
      const v = variations[0];
      const headline =
        v?.headline?.trim() || profile.firstPost.headline || "";
      const bodyText = v?.bodyText?.trim() || profile.firstPost.body || "";
      const imageUrl = v?.imageUrl || postImageUrl || null;
      const hashtags = v?.hashtags || profile.firstPost.hashtags || [];
      persistSelectedCardToActiveCampaign({
        headline,
        bodyText,
        body: bodyText,
        ctaButton: v?.ctaButton || profile.firstPost.cta || "",
        imageUrl,
        imagePrompt: v?.imagePrompt || "",
        hashtags,
        businessName: profile.businessName || "",
      });
      if (v) {
        setStudioVariations(padVariationPair(v));
      }
      saveProfile(profile);
      persistPostDraft(profile, imageUrl);
      markOnboardingDone();
      await saveCampaignAndGoToStudio(
        {
          title: headline,
          bodyText,
          imageUrl,
          hashtags,
          platform: "Instagram",
        },
        (href) => {
          onDone();
          router.push(href);
        }
      );
    } finally {
      setStudioBusy(false);
    }
  }

  async function continueWithGoogle() {
    if (profile) {
      saveProfile(profile);
      const draft = persistPostDraft(profile, postImageUrl);
      // OAuth bridge: session → localStorage pending (survives redirect)
      stageOAuthBridgeFromSession();
      try {
        localStorage.setItem("olar-onboarding-pending", "1");
        localStorage.setItem(
          "olar-onboarding-profile-backup",
          JSON.stringify(profile)
        );
        localStorage.setItem(
          "olar-onboarding-post-backup",
          JSON.stringify(draft)
        );
      } catch {
        /* ignore */
      }
    }
    setAuthBusy(true);
    const { error } = await signInWithGoogle("/");
    if (error) {
      setAuthBusy(false);
      finishToApp();
    }
  }

  const page = profile;
  const waDigits = page?.whatsapp
    ? page.whatsapp.replace(/\D/g, "").replace(/^0/, "972")
    : "";
  const fullUrl = page?.slug ? `https://olar.me/${page.slug}` : "https://olar.me";
  const hasPost =
    Boolean(page?.firstPost.headline?.trim()) &&
    Boolean(page?.firstPost.body?.trim());

  function sendPostToSelf() {
    if (!page || !hasPost) return;
    const text = encodeURIComponent(
      `${page.firstPost.headline}\n\n${page.firstPost.body}\n\n${page.firstPost.hashtags.join(" ")}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div
      className={
        phase === "land"
          ? "fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-slate-50"
          : "fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6"
      }
      dir="rtl"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onUploadImage(e.target.files);
          e.target.value = "";
        }}
      />

      {phase === "land" && (
        <div className="flex min-h-screen w-full flex-col justify-between overflow-x-hidden px-4 py-4 md:px-8">
          <div className="relative z-10 mx-auto w-full max-w-4xl lg:max-w-5xl">
            {/* 1. Logo + H1 */}
            <div className="flex flex-col items-center text-center">
              <Image
                src="/logo.png"
                alt="One Loop Social"
                width={215}
                height={120}
                priority
                className="mx-auto mb-2 h-10 w-auto object-contain drop-shadow-sm md:h-16 lg:h-20"
              />
              <h1 className="mb-3 text-center text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl md:text-4xl">
                {C.landH1}
              </h1>
            </div>

            {/* 2. Input + CTA stack */}
            <div className="relative z-10 w-full text-right">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInput("");
                    setSelectedCategory(null);
                    setFilledFromChip(null);
                    inputRef.current?.focus();
                  }}
                  className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline disabled:opacity-40"
                  disabled={!input && !selectedCategory}
                >
                  {C.clearFieldBtn}
                </button>
                {selectedCategory ? (
                  <div className="inline-flex max-w-[70%] items-center truncate rounded-full border border-cyan-500 bg-cyan-50/70 px-2.5 py-0.5 text-xs font-bold text-cyan-950">
                    {C.campaignForCategory} {categoryLabel(selectedCategory)}
                  </div>
                ) : null}
              </div>
              <label className="block">
                <span className="sr-only">{C.landInputLabel}</span>
                <textarea
                  ref={inputRef}
                  rows={4}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (
                      filledFromChip &&
                      e.target.value.trim() !== filledFromChip.trim()
                    ) {
                      setFilledFromChip(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!landLocked) void startMagic();
                    }
                  }}
                  disabled={landLocked}
                  placeholder={C.landPlaceholder}
                  className="min-h-[110px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-3.5 text-sm leading-relaxed shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60 md:min-h-[140px] md:rounded-2xl md:p-5 md:text-base"
                />
              </label>

              <div className="mt-2.5 w-full rounded-xl border-2 border-sky-200/80 bg-gradient-to-r from-sky-50/80 to-indigo-50/80 p-3 text-right shadow-sm">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-base" aria-hidden>
                    📷
                  </span>
                  <span className="text-xs font-bold text-slate-800 md:text-sm">
                    רוצים תמונה בול לפוסט?
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 md:text-xs">
                    (אופציונלי — 3-4 מילים על מה שרואים)
                  </span>
                </div>
                <input
                  type="text"
                  value={imageAnchorWords}
                  onChange={(e) => setImageAnchorWords(e.target.value)}
                  disabled={landLocked}
                  placeholder="לדוגמה: רכב שחור מבריק בסדנה מוארת, מגש עץ חם עם מאפים, לק ג'ל מנצנץ..."
                  className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs text-slate-700 transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/15 disabled:opacity-60 md:text-sm"
                />
              </div>

              {softToast ? (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
                  {softToast}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void startMagic()}
                disabled={landLocked || !input.trim()}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-base font-bold text-white shadow-md transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 md:rounded-2xl md:py-4 md:text-lg"
              >
                {landLocked
                  ? "יוצר עבורך 2 אופציות ותמונות..."
                  : C.landCta}
              </button>
              <p className="mt-1.5 text-center text-[11px] leading-snug text-slate-500 md:text-xs">
                {C.landCtaReassurance}
              </p>
            </div>

            {/* 3. Categories — horizontal swipe on mobile */}
            <div className="relative z-10 mt-3 w-full">
              <ExampleChips
                selectedId={selectedCategory}
                onSelect={onChipSelect}
              />
            </div>
          </div>

          <div className="relative z-10 shrink-0 [&_footer]:py-2 [&_footer_img]:h-8 [&_footer_img]:md:h-10">
            <FooterBrand />
          </div>
        </div>
      )}

      {phase === "working" && (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-sky-600/20">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </span>
          </div>
          <p className="text-sm font-semibold text-accent">{C.workBadge}</p>
          <p
            key={aiProgress || lineIdx}
            className="min-h-[3.5rem] animate-rise break-words text-xl font-bold text-slate-950 sm:text-2xl"
          >
            {aiProgress || workLines[lineIdx]}
          </p>
          <div className="flex gap-2">
            {workLines.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-8 rounded-full transition ${
                  i === lineIdx ? "bg-accent" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "payoff" && page && (
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
          {softToast ? (
            <p className="break-words rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-base font-medium text-emerald-900">
              {softToast}
            </p>
          ) : null}
          <header className="space-y-2 text-center sm:text-right">
            <p className="text-sm font-semibold text-accent">{C.payoffBadge}</p>
            <h2
              className="break-words text-xl font-black text-slate-950 sm:text-2xl lg:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.payoffTitle}
            </h2>
          </header>

          {/* Single post card */}
          {variations.length >= 1 ? (
            <section className="mx-auto w-full max-w-xl space-y-4">
              <p className="text-right text-base font-semibold text-slate-800">
                {C.abOptionsHeader}
              </p>
              {(() => {
                const v = variations[0]!;
                const cardImage =
                  v.imageUrl && !v.imageUrl.startsWith("data:image/svg")
                    ? v.imageUrl
                    : postImageUrl;
                return (
                  <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400 bg-white p-4 text-right shadow-md ring-2 ring-cyan-500 ring-offset-2">
                    <span className="inline-flex w-fit rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">
                      {C.option1Badge}
                    </span>
                    <PostCardPreview
                      network="instagram"
                      businessName={page.businessName || C.myBiz}
                      post={{
                        headline: v.headline,
                        body: v.bodyText,
                        hashtags: v.hashtags || [],
                        call_to_action: v.ctaButton,
                      }}
                      imageUrl={cardImage}
                      imageLoading={postImageLoading}
                      isFallback={Boolean(
                        cardImage?.startsWith("data:image/svg")
                      )}
                      editable
                      onHeadlineChange={(headline) =>
                        updatePayoffCopy(0, { headline })
                      }
                      onBodyChange={(bodyText) =>
                        updatePayoffCopy(0, { bodyText })
                      }
                      onRetryImage={() => {
                        void generateOnboardingImage(
                          profileFromVariation(page, v),
                          { variationIndex: 0 }
                        );
                      }}
                    />
                    <button
                      type="button"
                      disabled={postImageLoading}
                      onClick={() =>
                        void generateOnboardingImage(
                          profileFromVariation(page, v),
                          { variationIndex: 0 }
                        )
                      }
                      className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
                    >
                      {postImageLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {C.swapPostImage}
                    </button>
                    <button
                      type="button"
                      disabled={studioBusy}
                      onClick={() => void continueToStudio()}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white shadow-md hover:bg-cyan-500 disabled:opacity-60"
                    >
                      {studioBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      המשך לעריכה בסטודיו
                    </button>
                  </div>
                );
              })()}
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEditDraft(
                      `${page.firstPost.headline}\n${page.firstPost.body}`.trim()
                    );
                    setEditingText(true);
                  }}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 sm:w-auto"
                >
                  {C.editPostText}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 sm:w-auto"
                >
                  {C.uploadPostImage}
                </button>
                {hasPost ? (
                  <button
                    type="button"
                    onClick={sendPostToSelf}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white sm:w-auto"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {C.sendPostSelfWa}
                  </button>
                ) : null}
              </div>
              {editingText ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <textarea
                    dir="rtl"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="min-h-36 w-full rounded-xl border border-slate-200 p-3 text-right text-base"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEditedText}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
                    >
                      {C.savePostText}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingText(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                    >
                      {C.close}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
              <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-md sm:p-5">
                <p className="text-sm font-semibold text-accent">
                  {C.bioPreviewTitle}
                </p>
                {page.slug ? (
                  <p dir="ltr" className="mt-1 text-xs text-slate-500">
                    olar.me/{page.slug}
                  </p>
                ) : null}
                <p className="mt-3 break-words text-2xl font-black text-slate-950">
                  {page.businessName || C.myBiz}
                </p>
                {page.city ? (
                  <p className="mt-1 text-sm text-slate-700">{page.city}</p>
                ) : null}
                <p className="mt-2 break-words text-sm text-slate-800">
                  {page.tagline || page.description}
                </p>
                {waDigits ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <a
                      href={`https://wa.me/${waDigits}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {C.bioWaBtn}
                    </a>
                    {page.phone ? (
                      <a
                        href={`tel:${page.phone}`}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-900"
                      >
                        <Phone className="h-5 w-5 text-accent" />
                        {C.callAction}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </article>

              <article className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-md sm:p-5">
                <p className="shrink-0 text-sm font-semibold text-accent">
                  {C.firstPostReady}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDraft(
                        `${page.firstPost.headline}\n${page.firstPost.body}`.trim()
                      );
                      setEditingText(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    {C.editPostText}
                  </button>
                  <button
                    type="button"
                    disabled={postImageLoading}
                    onClick={() => void generateOnboardingImage(page)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
                  >
                    {postImageLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {C.swapPostImage}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    {C.uploadPostImage}
                  </button>
                </div>
                {editingText ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      dir="rtl"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="min-h-36 w-full rounded-xl border border-slate-200 p-3 text-right text-base"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEditedText}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
                      >
                        {C.savePostText}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingText(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                      >
                        {C.close}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                    {hasPost ? (
                      <PostCardPreview
                        network="instagram"
                        businessName={page.businessName || C.myBiz}
                        post={{
                          headline: page.firstPost.headline,
                          body: page.firstPost.body,
                          hashtags: page.firstPost.hashtags,
                          call_to_action: page.firstPost.cta,
                        }}
                        imageUrl={postImageUrl}
                        imageLoading={postImageLoading}
                        isFallback={imageIsFallback}
                        onRetryImage={() => void generateOnboardingImage(page)}
                      />
                    ) : (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-base text-slate-600">
                        {C.postPreviewEmpty}
                      </p>
                    )}
                  </div>
                )}
                {hasPost ? (
                  <>
                    <button
                      type="button"
                      disabled={studioBusy}
                      onClick={() => void continueToStudio()}
                      className="mt-4 flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-bold text-white shadow-md hover:bg-cyan-500 disabled:opacity-60"
                    >
                      {studioBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      המשך לעריכה בסטודיו
                    </button>
                    <button
                      type="button"
                      onClick={sendPostToSelf}
                      className="mt-2 flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {C.sendPostSelfWa}
                    </button>
                  </>
                ) : null}
              </article>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="olar-cta inline-flex min-h-12 w-full max-w-xl items-center justify-center rounded-full px-8 text-lg font-bold"
            >
              {C.savePageCta}
            </button>
            <p dir="ltr" className="text-xs text-slate-500">
              {fullUrl}
            </p>
          </div>
        </div>
      )}

      {authOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={C.authModalTitle}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3
                className="break-words text-xl font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {C.authModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 break-words text-base leading-relaxed text-slate-700">
              {C.authModalBody}
            </p>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void continueWithGoogle()}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white text-base font-bold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black text-[#4285F4] shadow">
                G
              </span>
              {C.authGoogleBtn}
            </button>
            <button
              type="button"
              onClick={finishToApp}
              className="mt-3 min-h-12 w-full text-base font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              {C.authGuestBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
