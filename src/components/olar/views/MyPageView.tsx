"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { waMeHref } from "@/lib/olar/derive-services";
import { C } from "@/lib/olar/ui-copy";
import { BioCardCapture } from "@/components/olar/BioCardCapture";
import {
  Copy,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Wrench,
} from "lucide-react";

export function MyPageView() {
  const { page, ready } = useResolvedMyPage();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const hasProfile = Boolean(page.businessName);
  const fullUrl = page.url ? `https://${page.url}` : "";

  async function copyLink() {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  function shareWa() {
    if (!fullUrl) return;
    const text = encodeURIComponent(`${page.businessName}\n${fullUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function downloadBioCardPng() {
    if (!cardRef.current || !hasProfile || downloading) return;
    setDownloading(true);
    setDownloadToast(C.bioCardDownloading);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `olar-bio-${page.slug || "card"}.png`;
      a.click();
      setDownloadToast(C.bioCardDownloaded);
      window.setTimeout(() => setDownloadToast(null), 2000);
    } catch {
      setDownloadToast(null);
    } finally {
      setDownloading(false);
    }
  }

  if (!ready) return null;

  /* ── Empty state: guest or no DNA ── */
  if (!hasProfile) {
    return (
      <div className="w-full animate-rise space-y-6" dir="rtl">
        <header className="space-y-2 text-right">
          <h1
            className="text-3xl font-bold text-slate-950 sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {C.myPageTitle}
          </h1>
          <p className="text-lg text-slate-800">{C.myPageSub}</p>
        </header>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-base text-slate-600">
            השלימו את פרטי העסק ב-Onboarding כדי ליצור את דף הביו שלכם.
          </p>
        </div>
      </div>
    );
  }

  const nicheCity = [page.tagline, page.address].filter(Boolean).join(" · ");

  return (
    <div className="w-full animate-rise space-y-6" dir="rtl">
      {/* ── Page header ── */}
      <header className="space-y-2 text-right">
        <h1
          className="text-3xl font-bold text-slate-950 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.myPageTitle}
        </h1>
        <p className="text-lg text-slate-800">{C.myPageSub}</p>
      </header>

      {/* ── Bio Card (mobile-first) ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
        {/* Avatar / Logo + Name + Niche|City */}
        <div className="flex items-center gap-4">
          {page.logoUrl || page.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={page.logoUrl || page.avatarUrl}
              alt={page.businessName}
              className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-black text-white">
              {page.businessName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xl font-bold text-slate-950 sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {page.businessName}
            </p>
            {nicheCity && (
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {nicheCity}
              </p>
            )}
          </div>
        </div>

        {page.description && (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {page.description}
          </p>
        )}

        {/* ── Quick Action Dock ── */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {page.whatsapp && (
            <a
              href={waMeHref(page.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" />
              {C.waAction}
            </a>
          )}
          {page.phone && (
            <a
              href={`tel:${page.phone}`}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Phone className="h-4 w-4" />
              {C.callAction}
            </a>
          )}
          {page.address && (
            <a
              href={page.wazeUrl || page.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Navigation className="h-4 w-4" />
              {C.mapsAction}
            </a>
          )}
          {page.website && (
            <a
              href={
                page.website.startsWith("http")
                  ? page.website
                  : `https://${page.website}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Globe className="h-4 w-4" />
              אתר
            </a>
          )}
        </div>

        {/* Address line */}
        {page.address && (
          <p className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-600">
            <span>{page.address}</span>
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
          </p>
        )}
      </section>

      {/* ── Services grid ── */}
      {page.services.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
          <h3 className="mb-3 text-base font-bold text-slate-950">
            {C.servicesTitle}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {page.services.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-slate-950">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{s.desc}</p>
                  {s.price > 0 ? (
                    <p className="mt-1 text-sm font-bold text-accent">
                      {C.fromPrice}
                      {s.price} {C.currencyIls}
                    </p>
                  ) : page.whatsapp ? (
                    <a
                      href={waMeHref(page.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1 text-xs font-bold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {C.quoteWaCta}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Owner Dashboard Actions + Bio PNG ── */}
      {fullUrl && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-medium text-white transition hover:brightness-110"
            >
              {copied ? (
                <>
                  <Copy className="h-5 w-5" />
                  {C.linkCopied}
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  {C.copyBioLiveLink}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void downloadBioCardPng()}
              disabled={downloading}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-5 text-base font-medium text-sky-900 transition hover:bg-sky-100 disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              {downloadToast || C.downloadBioCardPng}
            </button>
            <button
              type="button"
              onClick={shareWa}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-base font-medium text-white transition hover:brightness-110"
            >
              <Share2 className="h-5 w-5" />
              שלח את הכרטיס שלי בוואטסאפ ללקוח
            </button>
          </div>

          {/* Offscreen / preview capture target for PNG */}
          <div className="mt-5 flex justify-center overflow-x-auto">
            <BioCardCapture ref={cardRef} page={page} />
          </div>

          {(page.instagramUrl || page.facebookUrl) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {page.instagramUrl && (
                <a
                  href={page.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  אינסטגרם
                </a>
              )}
              {page.facebookUrl && (
                <a
                  href={page.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  פייסבוק
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
