"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { loadCurrentPost } from "@/lib/olar/current-post";
import { waMeHref } from "@/lib/olar/derive-services";
import { C } from "@/lib/olar/ui-copy";
import { BioCardCapture } from "@/components/olar/BioCardCapture";
import {
  useActiveCampaignVariation,
  useCampaignStore,
} from "@/lib/store/campaign-store";
import { downloadImageDirect } from "@/lib/utils/download-image";
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

function resolveActivePostImage(opts: {
  selectedVariationImage?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
}): string | null {
  const fromVar = opts.selectedVariationImage?.trim() || null;
  if (fromVar && !fromVar.startsWith("data:image/svg")) return fromVar;
  const fromPost = loadCurrentPost()?.image_url?.trim() || null;
  if (fromPost && !fromPost.startsWith("data:image/svg")) return fromPost;
  const fromLogo = opts.logoUrl?.trim() || opts.avatarUrl?.trim() || null;
  return fromLogo || null;
}

export function MyPageView() {
  const { page, ready } = useResolvedMyPage();
  /** Same durable campaign store as Studio / home (one_loop_active_campaign). */
  const campaign = useCampaignStore();
  const selectedVariation = useActiveCampaignVariation();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const hasProfile = Boolean(page.businessName);
  const fullUrl = page.url ? `https://${page.url}` : "";

  useEffect(() => {
    const fromCampaign =
      selectedVariation?.imageUrl ||
      campaign.activeCampaign?.variations?.[
        campaign.activeVariationIndex
      ]?.imageUrl ||
      null;
    setHeroImage(
      resolveActivePostImage({
        selectedVariationImage: fromCampaign,
        logoUrl: page.logoUrl,
        avatarUrl: page.avatarUrl,
      })
    );
  }, [
    selectedVariation?.imageUrl,
    campaign.activeCampaign?.variations,
    campaign.activeVariationIndex,
    page.logoUrl,
    page.avatarUrl,
  ]);

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
      // data: URLs go through the same secure helper (no CORS issues)
      await downloadImageDirect(
        dataUrl,
        `olar-bio-${page.slug || "card"}.png`
      );
      setDownloadToast(C.bioCardDownloaded);
      window.setTimeout(() => setDownloadToast(null), 2000);
    } catch {
      setDownloadToast(null);
    } finally {
      setDownloading(false);
    }
  }

  async function downloadHeroImagePng() {
    if (!heroImage || downloading) return;
    setDownloading(true);
    setDownloadToast("מוריד תמונה…");
    try {
      const result = await downloadImageDirect(
        heroImage,
        `olar-hero-${page.slug || "post"}-${Date.now()}.png`
      );
      setDownloadToast(
        result.ok
          ? "התמונה הורדה ✓"
          : result.openedInTab
            ? "נפתח חלון — שמרו ידנית (Ctrl+S)"
            : "ההורדה נכשלה"
      );
      window.setTimeout(() => setDownloadToast(null), 2500);
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
  const displayName =
    campaign.activeCampaign?.businessName?.trim() || page.businessName;
  const marketingHeadline = selectedVariation?.headline?.trim() || "";
  const marketingBody = selectedVariation?.bodyText?.trim() || "";
  const marketingCta = selectedVariation?.ctaButton?.trim() || "";

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

      {/* ── Bio Card (mobile-first) — synced from campaign-store ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
        {/* Active campaign image — never empty/transparent frame */}
        <div className="relative aspect-square w-full bg-slate-100 sm:aspect-[2/1]">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600">
              <span className="text-5xl font-black text-white/90">
                {displayName.slice(0, 1)}
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
        {/* Avatar / Logo + Name + Niche|City */}
        <div className="flex items-center gap-4">
          {page.logoUrl || page.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={page.logoUrl || page.avatarUrl}
              alt={displayName}
              className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-black text-white">
              {displayName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xl font-bold text-slate-950 sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {displayName}
            </p>
            {nicheCity && (
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {nicheCity}
              </p>
            )}
          </div>
        </div>

        {/* Selected campaign marketing copy from central store */}
        {marketingHeadline || marketingBody ? (
          <div className="mt-4 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4 text-right">
            {marketingHeadline ? (
              <h2
                className="text-lg font-bold text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {marketingHeadline}
              </h2>
            ) : null}
            {marketingBody ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {marketingBody}
              </p>
            ) : null}
            {marketingCta ? (
              <p className="text-sm font-semibold text-accent">{marketingCta}</p>
            ) : null}
          </div>
        ) : page.description ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {page.description}
          </p>
        ) : null}

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
        </div>
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
              onClick={() => void downloadHeroImagePng()}
              disabled={downloading || !heroImage}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-base font-medium text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              הורד תמונה (PNG)
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
            <BioCardCapture
              ref={cardRef}
              page={page}
              heroImageUrl={heroImage}
            />
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
