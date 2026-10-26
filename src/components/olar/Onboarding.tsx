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
import { PostCardPreview } from "@/components/olar/PostCardPreview";
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
  const [phase, setPhase] = useState<Phase>("land");
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<BusinessCategoryId | null>(null);
  /** Last chip template auto-filled into textarea (for overwrite guard). */
  const [filledFromChip, setFilledFromChip] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const working = phase === "working";
  const { message: aiProgress } = useAiProgressMessages(working);

  const workLines = useMemo(
    () => [
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

  async function generateOnboardingImage(p: BusinessProfile) {
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
    const seed = Math.floor(Math.random() * 1_000_000);
    setPostImageLoading(true);
    setImageIsFallback(false);
    let usedClientFallback = false;
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          prompt: desc,
          businessName: p.businessName,
          niche: category
            ? legacyNicheFromCategory(category)
            : p.niche,
          category: category ?? undefined,
          purpose: "post",
          aspectRatio: "1:1",
          seed,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fallback?: boolean;
        isFallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
        imageUrl?: string;
      };
      let url = data.image?.url || data.imageUrl;
      const serverFallback = Boolean(data.fallback || data.isFallback);
      if (!url || url.startsWith("data:image/svg")) {
        url = getCategoryFallback(category || p.niche, desc);
        usedClientFallback = true;
      }
      const asFallback = serverFallback || usedClientFallback;
      setPostImageUrl(url);
      setImageIsFallback(asFallback);
      saveCurrentPostImage({
        image_url: url,
        image_seed: data.image?.seed ?? seed,
        image_prompt: data.image?.prompt ?? null,
        fallback: asFallback,
      });
      persistPostDraft(p, url, {
        seed: data.image?.seed ?? seed,
        prompt: data.image?.prompt ?? null,
        fallback: asFallback,
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

  function onChipSelect(text: string, id?: BusinessCategoryId) {
    setSelectedCategory(id ?? null);
    if (id) storageSet("selected-category", id);
    const trimmed = input.trim();
    const canFill =
      !trimmed || (filledFromChip != null && trimmed === filledFromChip.trim());
    if (canFill) {
      setInput(text);
      setFilledFromChip(text);
    }
    inputRef.current?.focus();
  }

  async function startMagic() {
    const raw = stripCategoryLeak(input.trim());
    if (!raw) {
      setSoftToast(C.landNeedInput || "כתבו כמה מילים על העסק כדי להתחיל");
      return;
    }

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

    const minWait = new Promise((r) => setTimeout(r, Math.min(WORK_MS, 4500)));
    let finalProfile = local;

    try {
      // Prefer clean generate-post contract; fall back to magic
      const genRes = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: raw,
          category: selectedCategory,
          city: local.city || undefined,
          goal: selectedGoal,
        }),
        signal: AbortSignal.timeout(45_000),
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
        hashtags?: string[];
        soft_message?: string;
        error?: string;
        providerUsed?: string;
      };

      if (!genRes.ok || gen.ok === false) {
        console.error("[onboarding] generate-post error payload", {
          status: genRes.status,
          errData: gen,
        });
      } else {
        console.log("[onboarding] generate-post ok", {
          status: genRes.status,
          providerUsed: gen.providerUsed,
        });
      }

      await minWait;

      if (gen.ok && gen.headline && gen.bodyText) {
        finalProfile = {
          ...local,
          tagline: stripCategoryLeak(gen.headline),
          description: stripCategoryLeak(gen.bodyText).split("\n")[0] || "",
          firstPost: {
            headline: stripCategoryLeak(gen.headline),
            body: stripCategoryLeak(gen.bodyText),
            cta: stripCategoryLeak(gen.ctaButton || ""),
            hashtags: gen.hashtags || [],
          },
        };
        setProfile(finalProfile);
        persistPostDraft(finalProfile, null);
        setSoftToast(gen.soft_message || C.aiSoftReady);
        setPhase("payoff");
        void generateOnboardingImage(finalProfile);
        return;
      }

      // Fallback: magic route with same clean fields
      const res = await fetch("/api/onboarding/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: raw,
          category: selectedCategory,
          goal: selectedGoal,
          city: local.city || undefined,
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
        setProfile(finalProfile);
        persistPostDraft(finalProfile, null);
        setSoftToast(data.soft_message || C.aiSoftReady);
        setPhase("payoff");
        void generateOnboardingImage(finalProfile);
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
    }
  }

  function saveEditedText() {
    if (!profile) return;
    const combined = editDraft.trim();
    const [firstLine, ...rest] = combined.split("\n");
    const next: BusinessProfile = {
      ...profile,
      firstPost: {
        ...profile.firstPost,
        headline: stripCategoryLeak(firstLine || profile.firstPost.headline),
        body: stripCategoryLeak(
          rest.join("\n").trim() || profile.firstPost.body
        ),
      },
    };
    setProfile(next);
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
      className="fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6"
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
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col justify-center">
          <div className="space-y-6 text-center sm:text-right">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <div className="inline-flex items-center rounded-xl bg-[#070b16] px-3 py-2">
                <Image
                  src="/one-loop-logo.png?v=2"
                  alt="One Loop Social"
                  width={215}
                  height={120}
                  priority
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-sm font-semibold tracking-wide text-accent">
                One Loop Social · olar.me
              </p>
            </div>
            <h1
              className="break-words text-3xl font-black leading-tight text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.landH1}
            </h1>
            <p className="break-words text-lg leading-relaxed text-slate-700">
              {C.landSub}
            </p>
            <ExampleChips
              selectedId={selectedCategory}
              onSelect={onChipSelect}
            />

            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between gap-2">
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
                <span className="text-sm font-medium text-slate-600">
                  {C.landInputLabel}
                </span>
              </div>
              {selectedCategory ? (
                <div className="inline-flex items-center rounded-full border border-cyan-500 bg-cyan-50/70 px-3 py-1 text-sm font-bold text-cyan-950">
                  {C.campaignForCategory} {categoryLabel(selectedCategory)}
                </div>
              ) : null}
              <label className="block">
                <span className="sr-only">{C.landInputLabel}</span>
                <textarea
                  ref={inputRef}
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
                      void startMagic();
                    }
                  }}
                  placeholder={C.landPlaceholder}
                  className="min-h-[140px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-base shadow-sm outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </label>
            </div>

            {/* CTA directly under textarea — primary action before goals */}
            {softToast && phase === "land" ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900">
                {softToast}
              </p>
            ) : null}

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void startMagic()}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-8 text-lg font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:shadow-xl hover:shadow-cyan-600/30 hover:brightness-110 sm:w-auto"
              >
                {C.landCta}
              </button>
              <p className="max-w-md text-center text-xs leading-relaxed text-slate-500">
                {C.landCtaReassurance}
              </p>
            </div>

            {/* Goals are secondary — below the main CTA */}
            <div className="space-y-3 text-right">
              <p className="text-sm font-semibold text-slate-700">
                {C.goalSectionTitle}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    { key: "new_clients", label: C.goalNewClients },
                    { key: "fill_schedule", label: C.goalFillSchedule },
                    { key: "expertise", label: C.goalExpertise },
                    { key: "launch", label: C.goalLaunch },
                  ] as const
                ).map((goal) => (
                  <button
                    key={goal.key}
                    type="button"
                    onClick={() =>
                      setSelectedGoal((prev) =>
                        prev === goal.key ? null : goal.key
                      )
                    }
                    className={`rounded-xl border px-4 py-3 text-right text-sm font-medium transition-all ${
                      selectedGoal === goal.key
                        ? "border-cyan-500 bg-cyan-50/50 text-cyan-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/30"
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>
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
              className="break-words text-3xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.payoffTitle}
            </h2>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md">
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
              {page.services.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {page.services.map((svc) => (
                    <li
                      key={svc.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="break-words text-sm font-medium text-slate-900">
                        {svc.title}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
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

            <article className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md">
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
                <button
                  type="button"
                  onClick={sendPostToSelf}
                  className="mt-4 flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {C.sendPostSelfWa}
                </button>
              ) : null}
            </article>
          </div>

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
