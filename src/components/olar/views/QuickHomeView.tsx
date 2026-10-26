"use client";

import { useMemo, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useClientAuth } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import {
  Copy,
  ExternalLink,
  MessageCircle,
  Share2,
  Zap,
} from "lucide-react";

export function QuickHomeView({
  onNavigate,
  onGoFull,
}: {
  onNavigate: (v: OlarView) => void;
  onGoFull: () => void;
}) {
  const { page } = useResolvedMyPage();
  const { isGuest, ready: authReady } = useClientAuth();
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fullUrl = `https://${page.url}`;
  const readyPost = useMemo(
    () => ({
      headline: page.firstPost?.headline || page.tagline || C.myBiz,
      body:
        page.firstPost?.body ||
        page.description ||
        C.pickSimple,
      hashtags: page.firstPost?.hashtags || [],
      call_to_action: page.firstPost?.cta || C.quoteWaCta,
    }),
    [page]
  );

  const visits = isGuest ? 0 : page.weekVisits ?? 0;
  const waClicks = isGuest ? 0 : 0;

  async function copyContentAndImage() {
    const text = [
      readyPost.headline,
      readyPost.body,
      readyPost.call_to_action,
      (readyPost.hashtags || []).join(" "),
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function shareWaStatus() {
    const text = encodeURIComponent(
      `${readyPost.headline}\n\n${readyPost.body}\n\n${fullUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function copyLandingLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      /* ignore */
    }
  }

  if (!authReady) {
    return <div className="min-h-[40vh] w-full" />;
  }

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-x-hidden animate-rise pb-24 lg:pb-8"
      dir="rtl"
    >
      <header className="space-y-1 text-right">
        <h1
          className="break-words text-3xl font-bold text-slate-900 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isGuest ? C.guestWelcomeTitle : C.workModeQuick}
        </h1>
        <p className="break-words text-lg text-slate-800">
          {isGuest ? C.quickReadySub : C.pickSimple}
        </p>
      </header>

      {/* 1. Daily Ready-to-Post */}
      <section className="space-y-4 rounded-2xl border border-sky-100 bg-white p-4 shadow-lg shadow-slate-200/40 sm:p-6">
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-900">
            {C.quickReadyTitle}
          </h2>
          <p className="mt-1 text-base text-slate-700">{C.quickReadySub}</p>
        </div>
        <div className="flex justify-center">
          <PostCardPreview
            network="instagram"
            businessName={page.businessName || C.myBiz}
            post={readyPost}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void copyContentAndImage()}
            className="olar-cta inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-base"
          >
            <Copy className="h-5 w-5 shrink-0" />
            <span className="break-words">
              {copiedContent ? C.copied : C.quickCopyContentImage}
            </span>
          </button>
          <button
            type="button"
            onClick={shareWaStatus}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="break-words">{C.quickShareWaStatus}</span>
          </button>
        </div>
        {isGuest ? (
          <button
            type="button"
            onClick={() => onNavigate("yona")}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-base font-bold text-accent"
          >
            <Zap className="h-5 w-5" />
            {C.guestWelcomeCta}
          </button>
        ) : null}
      </section>

      {/* 2. Action chips */}
      <section className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("yona")}
          className="min-h-12 break-words rounded-2xl border border-sky-100 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-md transition hover:border-accent hover:bg-accent-soft"
        >
          {C.quickChipPost30}
        </button>
        <button
          type="button"
          onClick={() => onNavigate("mypage")}
          className="min-h-12 break-words rounded-2xl border border-sky-100 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-md transition hover:border-accent hover:bg-accent-soft"
        >
          {C.quickChipOffer}
        </button>
        <button
          type="button"
          onClick={() => void copyLandingLink()}
          className="min-h-12 break-words rounded-2xl border border-sky-100 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-md transition hover:border-accent hover:bg-accent-soft"
        >
          {copiedLink ? C.linkCopiedShort : C.quickChipCopyLink}
        </button>
      </section>

      {/* 3. Real Pulse — 2 cards only */}
      <section className="space-y-3">
        <h2 className="text-right text-xl font-bold text-slate-900">
          {C.quickPulseTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-md">
            <p className="text-sm font-medium text-slate-600">
              {C.quickPulseVisits}
            </p>
            <p
              className="mt-2 text-4xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {visits}
            </p>
            {isGuest ? (
              <p className="mt-2 break-words text-sm text-slate-700">
                {C.quickPulseGuestHint}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white p-5 text-right shadow-md">
            <p className="text-sm font-medium text-slate-600">
              {C.quickPulseWa}
            </p>
            <p
              className="mt-2 text-4xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {waClicks}
            </p>
            {isGuest ? (
              <p className="mt-2 break-words text-sm text-slate-700">
                {C.quickPulseGuestHint}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => void copyLandingLink()}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-800"
        >
          <Share2 className="h-4 w-4" />
          <span dir="ltr" className="break-all text-sm">
            {page.url}
          </span>
        </button>
        <button
          type="button"
          onClick={onGoFull}
          className="inline-flex min-h-12 items-center gap-2 text-base font-medium text-slate-800 underline-offset-4 hover:text-accent hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          {C.quickGoFull}
        </button>
      </div>

      {/* Sticky mobile CTA */}
      <div className="safe-bottom fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => onNavigate("yona")}
          className="olar-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          <Zap className="h-5 w-5" />
          {isGuest ? C.guestWelcomeCta : C.quickChipPost30}
        </button>
      </div>
    </div>
  );
}
