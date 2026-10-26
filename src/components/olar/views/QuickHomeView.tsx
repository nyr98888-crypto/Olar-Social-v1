"use client";

import { useMemo, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useCurrentPost } from "@/lib/olar/current-post";
import { useClientAuth } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import { PostCardPreview } from "@/components/olar/PostCardPreview";
import { FooterBrand } from "@/components/olar/FooterBrand";
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
  const { post: currentPost, ready: postReady } = useCurrentPost();
  const { isGuest, ready: authReady } = useClientAuth();
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fullUrl = `https://${page.url}`;
  const readyPost = useMemo(() => {
    const headline =
      currentPost?.headline || page.firstPost?.headline || "";
    const body = currentPost?.body || page.firstPost?.body || "";
    return {
      headline,
      body,
      hashtags: currentPost?.hashtags?.length
        ? currentPost.hashtags
        : page.firstPost?.hashtags || [],
      call_to_action: currentPost?.cta || page.firstPost?.cta || "",
    };
  }, [page, currentPost]);
  const hasReadyPost = Boolean(
    readyPost.headline.trim() && readyPost.body.trim()
  );

  const imageUrl = currentPost?.image_url || null;
  const imageLoading = postReady ? false : true;

  const visits = 0;
  const waClicks = isGuest ? 0 : 0;

  async function copyContentAndImage() {
    const text = [
      readyPost.headline,
      readyPost.body,
      readyPost.call_to_action,
      (readyPost.hashtags || []).join(" "),
      imageUrl || "",
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
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 overflow-x-hidden px-4 animate-rise pb-24 sm:px-6 lg:pb-8"
      dir="rtl"
    >
      <header className="w-full space-y-1 text-right">
        <h1
          className="break-words text-xl font-bold text-slate-900 sm:text-2xl lg:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isGuest ? C.guestWelcomeTitle : C.workModeQuick}
        </h1>
        <p className="break-words text-base text-slate-800 sm:text-lg">
          {isGuest ? C.quickReadySub : C.pickSimple}
        </p>
      </header>

      {/* 1. Daily Ready-to-Post — image from persisted image_url */}
      <section className="w-full space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md sm:p-6">
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {C.quickReadyTitle}
          </h2>
          <p className="mt-1 text-base text-slate-700">{C.quickReadySub}</p>
        </div>
        <div className="flex w-full justify-center">
          {hasReadyPost ? (
            <PostCardPreview
              network={
                currentPost?.network === "facebook" ||
                currentPost?.network === "whatsapp"
                  ? currentPost.network
                  : "instagram"
              }
              businessName={page.businessName || C.myBiz}
              post={readyPost}
              imageUrl={imageUrl}
              imageLoading={imageLoading && !imageUrl}
              className="w-full max-w-full"
            />
          ) : (
            <p className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-base text-slate-600">
              {C.postPreviewEmpty}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={() => void copyContentAndImage()}
            className="olar-cta inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl px-4 text-base md:w-auto"
          >
            <Copy className="h-5 w-5 shrink-0" />
            <span className="break-words">
              {copiedContent ? C.copied : C.quickCopyContentImage}
            </span>
          </button>
          <button
            type="button"
            onClick={shareWaStatus}
            className="inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white md:w-auto"
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

      {/* 2. Action chips — full-width stack below md */}
      <section className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("yona")}
          className="min-h-12 w-full break-words rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md"
        >
          {C.quickChipPost30}
        </button>
        <button
          type="button"
          onClick={() => onNavigate("mypage")}
          className="min-h-12 w-full break-words rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md"
        >
          {C.quickChipOffer}
        </button>
        <button
          type="button"
          onClick={() => void copyLandingLink()}
          className="min-h-12 w-full break-words rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-center text-base font-bold text-slate-900 shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md"
        >
          {copiedLink ? C.linkCopiedShort : C.quickChipCopyLink}
        </button>
      </section>

      {/* 3. Real Pulse — 2 cards only */}
      <section className="w-full space-y-3">
        <h2 className="text-right text-xl font-bold text-slate-900 sm:text-2xl">
          {C.quickPulseTitle}
        </h2>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-right shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md">
            <p className="text-sm font-medium text-slate-600">
              {C.quickPulseVisits}
            </p>
            <p
              className="mt-2 text-4xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {visits}
            </p>
            <p className="mt-2 break-words text-sm text-slate-700">
              {C.emptyDashboardStats}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-right shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md">
            <p className="text-sm font-medium text-slate-600">
              {C.quickPulseWa}
            </p>
            <p
              className="mt-2 text-4xl font-black text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {waClicks}
            </p>
            <p className="mt-2 break-words text-sm text-slate-700">
              {C.emptyDashboardStats}
            </p>
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

      <FooterBrand />

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
