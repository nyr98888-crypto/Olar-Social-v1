"use client";

import { useState } from "react";
import { REVIEWS } from "@/lib/olar/mock-data";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { waMeHref } from "@/lib/olar/derive-services";
import { C } from "@/lib/olar/ui-copy";
import {
  Copy,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
  Wrench,
} from "lucide-react";

export function MyPageView() {
  const { page } = useResolvedMyPage();
  const [live, setLive] = useState(true);
  const [copied, setCopied] = useState(false);
  const quotes = REVIEWS.filter((r) => r.stars >= 4).slice(0, 2);
  const fullUrl = `https://${page.url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function shareWa() {
    const text = encodeURIComponent(`${page.businessName}\n${fullUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="space-y-2 text-right">
        <h1
          className="text-3xl font-bold text-slate-950 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.myPageTitle}
        </h1>
        <p className="text-lg text-slate-800">{C.myPageSub}</p>
      </header>

      <section className="olar-card w-full p-5 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <p
            dir="ltr"
            className="min-h-14 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-left text-lg font-medium text-slate-950"
          >
            {page.url}
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex min-h-14 items-center gap-2 rounded-xl bg-accent px-5 text-base font-medium text-white"
          >
            <Copy className="h-5 w-5" />
            {copied ? C.linkCopied : C.copyLink}
          </button>
          <button
            type="button"
            onClick={shareWa}
            className="flex min-h-14 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-base font-medium text-white"
          >
            <Share2 className="h-5 w-5" />
            {C.shareWa}
          </button>
        </div>

        <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-4">
          <span className="text-lg font-medium text-slate-950">
            {live ? C.pageLive : C.pageOff}
          </span>
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="h-6 w-6 accent-[var(--accent)]"
          />
        </label>
      </section>

      <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
        <section
          className={`rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-md transition ${
            live ? "" : "opacity-60 grayscale"
          }`}
        >
          <p className="text-sm font-semibold text-accent">{C.bioPreviewTitle}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
              {page.businessName.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xl font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {page.businessName}
              </p>
              <p className="text-sm text-slate-800">{page.tagline}</p>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-800">
            {page.description}
          </p>
          <p className="mt-2 flex items-start justify-end gap-2 text-sm text-slate-800">
            <span>{page.address}</span>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={waMeHref(page.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {C.waAction}
            </a>
            <a
              href={`tel:${page.phone}`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-white"
            >
              <Phone className="h-4 w-4" />
              {C.callAction}
            </a>
            <a
              href={page.wazeUrl}
              target="_blank"
              rel="noreferrer"
              className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-semibold text-white"
            >
              <Navigation className="h-4 w-4" />
              {C.mapsAction}
            </a>
          </div>

          <h3 className="mb-2 mt-5 text-base font-bold text-slate-950">
            {C.servicesTitle}
          </h3>
          <ul className="space-y-2">
            {page.services.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {s.price > 0 ? (
                      <p className="text-sm font-bold text-accent">
                        {C.fromPrice}
                        {s.price} {C.currencyIls}
                      </p>
                    ) : (
                      <a
                        href={waMeHref(page.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1 text-xs font-bold text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {C.quoteWaCta}
                      </a>
                    )}
                    <p className="text-base font-bold text-slate-950">{s.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">{s.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 mt-5 text-base font-bold text-slate-950">
            {C.galleryTitle}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {page.gallery.map((g) => (
              <div
                key={g.id}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.photo}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent px-2 pb-1.5 pt-5 text-xs font-medium text-white">
                  {g.label}
                </span>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-5 flex items-center justify-end gap-2 text-base font-bold text-slate-950">
            <span>
              {page.rating} · {C.reputationTitle}
            </span>
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          </h3>
          <ul className="space-y-2">
            {quotes.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800"
              >
                &ldquo;{r.text}&rdquo;
                <span className="mt-1 block text-xs font-medium text-slate-800">
                  — {r.author}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="olar-card p-5 text-right shadow-md">
            <p className="text-base text-slate-800">{C.pageVisitsWeek}</p>
            <p className="mt-2 text-4xl font-bold text-slate-950">
              {page.weekVisits.toLocaleString("he-IL")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
