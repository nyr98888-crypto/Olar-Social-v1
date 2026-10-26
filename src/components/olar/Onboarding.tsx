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
import { useAiProgressMessages } from "@/hooks/useAiProgressMessages";
import { signInWithGoogle } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import {
  ExampleChips,
  type NicheChipId,
} from "@/components/olar/ExampleChips";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { MessageCircle, Phone, Sparkles, X } from "lucide-react";

export function useOnboardingGate() {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY) === "1";
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
  const [selectedNiche, setSelectedNiche] = useState<NicheChipId | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [softToast, setSoftToast] = useState<string | null>(null);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postImageLoading, setPostImageLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
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
      headline: p.firstPost.headline,
      body: p.firstPost.body,
      cta: p.firstPost.cta,
      hashtags: p.firstPost.hashtags,
      offer: p.tagline,
      image_url:
        imageMeta?.fallback === true
          ? null
          : (imageUrl ?? undefined),
      image_seed: imageMeta?.seed ?? null,
      image_prompt: imageMeta?.prompt ?? null,
      network: "instagram",
    });
    void syncCurrentPostToServer(saved);
    return saved;
  }

  async function generateOnboardingImage(p: BusinessProfile) {
    setPostImageLoading(true);
    // Keep previous image visible until a real URL returns — do not wipe storage
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `${p.businessName} ${p.tagline} ${p.firstPost.headline} ${p.niche}`,
          businessName: p.businessName,
          niche: p.niche,
          purpose: "post",
          aspectRatio: "16:9",
        }),
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fallback?: boolean;
        image?: { url?: string; seed?: number; prompt?: string };
      };
      const url = data.image?.url;
      if (url && !data.fallback) {
        setPostImageUrl(url);
        saveCurrentPostImage({
          image_url: url,
          image_seed: data.image?.seed ?? null,
          image_prompt: data.image?.prompt ?? null,
          fallback: false,
        });
        const draft = persistPostDraft(p, url, {
          seed: data.image?.seed ?? null,
          prompt: data.image?.prompt ?? null,
        });
        // If OAuth already started, refresh post backup so image survives login
        try {
          if (localStorage.getItem("olar-onboarding-pending") === "1") {
            localStorage.setItem(
              "olar-onboarding-post-backup",
              JSON.stringify(draft)
            );
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* soft fail — skeleton stays until a real URL exists */
    } finally {
      setPostImageLoading(false);
    }
  }

  async function startMagic() {
    const raw = input.trim() || C.landExampleFallback;
    const goalSuffix = selectedGoal ? `\n\nמטרת הפרסום: ${selectedGoal}` : "";
    const fullInput = raw + goalSuffix;
    const local = buildProfileFromInput(raw);
    setProfile(local);
    setLineIdx(0);
    setPhase("working");
    setSoftToast(null);
    setPostImageUrl(null);

    const minWait = new Promise((r) => setTimeout(r, Math.min(WORK_MS, 4500)));
    let finalProfile = local;
    try {
      const res = await fetch("/api/onboarding/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: fullInput, goal: selectedGoal }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fallback?: boolean;
        soft_message?: string;
        profile?: Partial<BusinessProfile> & {
          firstPost?: BusinessProfile["firstPost"];
        };
      };
      await minWait;
      if (data.profile) {
        finalProfile = {
          ...local,
          businessName: data.profile.businessName || local.businessName,
          city: data.profile.city || local.city,
          niche:
            (data.profile.niche as BusinessProfile["niche"]) || local.niche,
          tagline: data.profile.tagline || local.tagline,
          description: data.profile.description || local.description,
          firstPost: data.profile.firstPost
            ? {
                headline:
                  data.profile.firstPost.headline || local.firstPost.headline,
                body: data.profile.firstPost.body || local.firstPost.body,
                cta: data.profile.firstPost.cta || local.firstPost.cta,
                hashtags: data.profile.firstPost.hashtags?.length
                  ? data.profile.firstPost.hashtags
                  : local.firstPost.hashtags,
              }
            : local.firstPost,
        };
        setProfile(finalProfile);
      }
      persistPostDraft(finalProfile, postImageUrl);
      setSoftToast(data.soft_message || C.aiSoftReady);
    } catch {
      await minWait;
      persistPostDraft(finalProfile, postImageUrl);
      setSoftToast(C.aiSoftReady);
    }
    setPhase("payoff");
    void generateOnboardingImage(finalProfile);
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
      try {
        localStorage.setItem("olar-onboarding-pending", "1");
        localStorage.setItem(
          "olar-onboarding-profile-backup",
          JSON.stringify(profile)
        );
        // Ensure post (+ FAL image URL) survives the OAuth round-trip
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
      // Guest path still available if OAuth cannot start
      finishToApp();
    }
  }

  const page = profile;
  const waDigits = page
    ? page.whatsapp.replace(/\D/g, "").replace(/^0/, "972")
    : "972500000000";
  const fullUrl = page ? `https://olar.me/${page.slug}` : "https://olar.me";

  function sendPostToSelf() {
    if (!page) return;
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
              selectedId={selectedNiche}
              onSelect={(text, id) => {
                setSelectedNiche(id ?? null);
                setInput(text);
                inputRef.current?.focus();
              }}
            />

            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInput("");
                    setSelectedNiche(null);
                    inputRef.current?.focus();
                  }}
                  className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-800 hover:underline disabled:opacity-40"
                  disabled={!input && !selectedNiche}
                >
                  {C.clearFieldBtn}
                </button>
                <span className="text-sm font-medium text-slate-600">
                  {C.landInputLabel}
                </span>
              </div>
              <label className="block">
                <span className="sr-only">{C.landInputLabel}</span>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
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

            {/* Goal selection cards */}
            <div className="space-y-3 text-right">
              <p className="text-sm font-semibold text-slate-700">
                {C.goalSectionTitle}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  { key: "new_clients", label: C.goalNewClients },
                  { key: "fill_schedule", label: C.goalFillSchedule },
                  { key: "expertise", label: C.goalExpertise },
                  { key: "launch", label: C.goalLaunch },
                ] as const).map((goal) => (
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
              <p dir="ltr" className="mt-1 text-xs text-slate-500">
                olar.me/{page.slug}
              </p>
              <p className="mt-3 break-words text-2xl font-black text-slate-950">
                {page.businessName}
              </p>
              {page.city ? (
                <p className="mt-1 text-sm text-slate-700">{page.city}</p>
              ) : null}
              <p className="mt-2 break-words text-sm text-slate-800">
                {page.tagline}
              </p>
              <ul className="mt-4 space-y-2">
                {page.services.map((svc) => (
                  <li
                    key={svc.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    {svc.price > 0 ? (
                      <span className="text-sm font-semibold text-accent">
                        {`${C.fromPrice}${svc.price} ${C.currencyIls}`}
                      </span>
                    ) : (
                      <a
                        href={`https://wa.me/${waDigits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white"
                      >
                        {C.quoteWaCta}
                      </a>
                    )}
                    <span className="break-words text-sm font-medium text-slate-900">
                      {svc.title}
                    </span>
                  </li>
                ))}
              </ul>
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
                <a
                  href={`tel:${page.phone}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-900"
                >
                  <Phone className="h-5 w-5 text-accent" />
                  {C.callAction}
                </a>
              </div>
            </article>

            <article className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md">
              <p className="shrink-0 text-sm font-semibold text-accent">
                {C.firstPostReady}
              </p>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                <PostCardPreview
                  network="instagram"
                  businessName={page.businessName}
                  post={{
                    headline: page.firstPost.headline,
                    body: page.firstPost.body,
                    hashtags: page.firstPost.hashtags,
                    call_to_action: page.firstPost.cta,
                  }}
                  imageUrl={postImageUrl}
                  imageLoading={postImageLoading}
                />
              </div>
              <button
                type="button"
                onClick={sendPostToSelf}
                className="mt-4 flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-bold text-white"
              >
                <MessageCircle className="h-5 w-5" />
                {C.sendPostSelfWa}
              </button>
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
