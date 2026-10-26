"use client";

import { useState } from "react";
import {
  REVIEWS,
  REVIEWS_SUMMARY,
  buildAskReviewMessage,
  reviewReplySuggestion,
} from "@/lib/olar/mock-data";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import type { ReviewItem } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "../NetworkBrand";
import { MessageCircle, Sparkles, Star, X } from "lucide-react";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} ${C.starsAria}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-5 w-5 ${
            i < n ? "fill-amber-400 text-amber-400" : "text-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

export function ReviewsView() {
  const { page } = useResolvedMyPage();
  const [askOpen, setAskOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [replyFor, setReplyFor] = useState<ReviewItem | null>(null);

  function openWhatsAppAsk() {
    const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
    if (digits.length < 10) return;
    const text = encodeURIComponent(
      buildAskReviewMessage(page.businessName)
    );
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank");
    setAskOpen(false);
    setPhone("");
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="text-right">
        <h1
          className="text-3xl font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.reviewsTitle}
        </h1>
        <p className="mt-1 text-lg text-slate-800">{C.reviewsSub}</p>
      </header>

      <section className="w-full rounded-2xl border border-line bg-white p-5 text-right lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base text-slate-800">{C.avgScore}</p>
            <p
              className="mt-1 text-4xl text-slate-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {REVIEWS_SUMMARY.average}
              <span className="text-xl text-slate-800"> / 5</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Stars n={Math.round(REVIEWS_SUMMARY.average)} />
              <span className="text-base text-slate-800">
                {C.outOf} {REVIEWS_SUMMARY.count} {C.ratersIn}
                {REVIEWS_SUMMARY.sources}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F0FE]">
              <BrandGlyph id="google" size={26} />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0E6]">
              <BrandGlyph id="easy" size={26} />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-medium text-white sm:w-auto sm:px-8"
        >
          <MessageCircle className="h-5 w-5" />
          {C.askRec}
        </button>
      </section>

      <section className="w-full space-y-3">
        <h2 className="text-right text-xl font-semibold text-slate-900">
          {C.recentReviews}
        </h2>
        <ul className="space-y-3">
          {REVIEWS.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-line bg-white p-5 text-right"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-800">{r.timeAgo}</span>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {r.author}
                    </p>
                    <p className="text-base text-slate-800">
                      {r.source === "google" ? C.google : C.easy}
                    </p>
                  </div>
                  <Stars n={r.stars} />
                </div>
              </div>
              <p className="mt-2 text-base leading-relaxed text-slate-800">
                {r.text}
              </p>
              <button
                type="button"
                onClick={() => setReplyFor(r)}
                className="mt-3 inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-line px-4 text-base font-medium text-slate-900 hover:bg-slate-50"
              >
                <Sparkles className="h-4 w-4 text-accent" />
                {C.suggestReviewReply}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {askOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 text-right shadow-[var(--shadow)]">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAskOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-slate-900">
                {C.askRecTitle}
              </h2>
            </div>
            <p className="text-base text-slate-800">{C.askRecHelp}</p>
            <input
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className="mt-4 min-h-14 w-full rounded-xl border border-line bg-slate-50 px-4 text-left text-lg outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={openWhatsAppAsk}
              className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#25D366] text-lg font-medium text-white"
            >
              {C.sendWa}
            </button>
          </div>
        </div>
      )}

      {replyFor && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-5 text-right shadow-[var(--shadow)]">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setReplyFor(null)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-slate-900">
                {C.yonaReply} · {replyFor.author}
              </h2>
            </div>
            <textarea
              dir="rtl"
              readOnly
              value={reviewReplySuggestion(replyFor.stars, replyFor.author)}
              className="min-h-28 w-full rounded-2xl border border-line bg-slate-50 p-4 text-right text-base leading-relaxed text-slate-900"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  reviewReplySuggestion(replyFor.stars, replyFor.author)
                );
                setReplyFor(null);
              }}
              className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-accent text-lg font-medium text-white"
            >
              {C.copyReply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
