"use client";

import type { ReactNode } from "react";
import type { SocialNetwork } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "./NetworkBrand";
import { MessageCircle, Phone, Sparkles, Wrench } from "lucide-react";
import type { WhatsAppCard } from "../../../schemas/agent";

export type PostCardData = {
  headline: string;
  body: string;
  hashtags?: string[];
  call_to_action?: string;
  visual_concept?: string;
  city_or_neighborhood?: string;
  offer?: string;
  card?: WhatsAppCard;
};

function platformLabel(network: SocialNetwork): string {
  if (network === "facebook") return C.platformFacebook || "Facebook";
  if (network === "instagram" || network === "reels")
    return C.platformInstagram || "Instagram";
  if (network === "google") return C.platformGoogle || "Google Business";
  if (network === "whatsapp") return C.platformWhatsappCard || "WhatsApp Card";
  return C.platformInstagram || "Instagram";
}

function glyphId(
  network: SocialNetwork
): "facebook" | "instagram" | "google" | "twitter" | "whatsapp" {
  if (network === "facebook") return "facebook";
  if (network === "google") return "google";
  if (network === "twitter") return "twitter";
  if (network === "whatsapp") return "whatsapp";
  return "instagram";
}

/** Balanced preview frames — capped height, center crop, no harsh edge cut. */
function aspectClass(network: SocialNetwork): string {
  if (network === "google") return "aspect-video max-h-[380px]";
  if (network === "instagram" || network === "reels" || network === "whatsapp")
    return "aspect-square max-h-[380px]";
  return "aspect-[4/3] max-h-[380px]";
}

function ImageSkeleton({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-sky-100 via-white to-sky-50"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="media-shimmer absolute inset-0 opacity-80" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="h-6 w-6 animate-pulse" />
      </span>
      <p className="relative max-w-[90%] break-words px-4 text-center text-sm font-medium text-slate-700">
        {label}
      </p>
      <div className="relative mt-1 flex w-3/4 flex-col gap-2 px-6">
        <div className="h-2.5 animate-pulse rounded-full bg-sky-200/80" />
        <div className="mx-auto h-2.5 w-2/3 animate-pulse rounded-full bg-sky-100" />
      </div>
    </div>
  );
}

function WhatsAppCardBody({
  businessName,
  logoUrl,
  post,
  waHref,
}: {
  businessName: string;
  logoUrl?: string | null;
  post: PostCardData;
  waHref?: string | null;
}) {
  const card = post.card;
  const name = card?.name || businessName || C.myBiz;
  const services = (card?.services || []).filter(Boolean).slice(0, 3);
  const phone = card?.phone?.trim();
  const logoHint = card?.logo_hint?.trim();

  return (
    <>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-black text-white">
              {name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-lg font-bold text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {name}
            </p>
            {logoHint ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">{logoHint}</p>
            ) : null}
          </div>
        </div>

        {/* 2-line invite */}
        <p className="whitespace-pre-line break-words text-base leading-relaxed text-slate-800">
          {post.body}
        </p>

        {services.length > 0 ? (
          <ul className="space-y-1.5">
            {services.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                <Wrench className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="break-words">{s}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {phone ? (
          <p className="flex items-center justify-end gap-2 text-sm font-medium text-slate-700">
            <span dir="ltr">{phone}</span>
            <Phone className="h-4 w-4 text-emerald-600" />
          </p>
        ) : null}
      </div>

      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white hover:brightness-95"
        >
          <MessageCircle className="h-5 w-5 shrink-0" />
          <span className="break-words">
            {post.call_to_action || C.waSendCard}
          </span>
        </a>
      ) : (
        <div className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white">
          <MessageCircle className="h-5 w-5 shrink-0" />
          <span className="break-words">
            {post.call_to_action || C.waSendCard}
          </span>
        </div>
      )}
    </>
  );
}

export function PostCardPreview({
  network,
  businessName,
  logoUrl,
  post,
  imageUrl,
  imageLoading,
  isFallback,
  onRetryImage,
  waHref,
  className = "",
  /** Dual-track FB/IG publish actions (Studio) */
  publishActions,
}: {
  network: SocialNetwork;
  businessName: string;
  logoUrl?: string | null;
  post: PostCardData;
  imageUrl?: string | null;
  imageLoading?: boolean;
  /** True when showing Unsplash / soft fallback instead of FAL. */
  isFallback?: boolean;
  onRetryImage?: () => void;
  waHref?: string | null;
  className?: string;
  publishActions?: ReactNode;
}) {
  const tag = platformLabel(network);
  const hashtags = (post.hashtags || [])
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  /** Skeleton ONLY while loading — never hang forever when URL is missing. */
  const showSkeleton = imageLoading === true;
  const skeletonLabel =
    C.imageSkeletonBusy || "מכינה לך תמונה שתיראה מעולה... עוד כמה שניות";
  const isWa = network === "whatsapp";

  return (
    <article
      className={`w-full rounded-2xl border border-slate-200 bg-white text-right shadow-md ${className || "max-w-md"}`}
      dir="rtl"
    >
      {/* Header: business + platform tag — UI shell only */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
            {(businessName || C.myBiz).slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate break-words text-base font-bold text-slate-950">
            {businessName || C.myBiz}
          </p>
          <p className="flex items-center justify-end gap-1.5 text-sm text-slate-600">
            <BrandGlyph id={glyphId(network)} size={14} />
            <span>{tag}</span>
          </p>
        </div>
      </div>

      {/* Ad image — full-width, capped height, center-balanced crop */}
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-xl bg-slate-100 ${aspectClass(network)}`}
      >
        {showSkeleton ? (
          <ImageSkeleton
            label={C.generatingNewImage || skeletonLabel}
          />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={imageUrl}
            src={imageUrl}
            alt=""
            className="h-full w-full max-h-[380px] object-cover object-center"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-400"
            aria-hidden
          />
        )}
        {/* Always allow regenerate when handler provided — not only on fallback */}
        {onRetryImage && !showSkeleton ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRetryImage();
            }}
            className="absolute bottom-2 left-2 z-10 rounded-lg border border-white/80 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white"
          >
            {C.retryImageChange || C.retryImage || "🔄 שנה תמונה"}
          </button>
        ) : null}
        {isFallback && !onRetryImage && !showSkeleton ? (
          <span className="absolute bottom-2 left-2 z-10 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-white">
            fallback
          </span>
        ) : null}
      </div>

      {isWa ? (
        <WhatsAppCardBody
          businessName={businessName}
          logoUrl={logoUrl}
          post={post}
          waHref={waHref}
        />
      ) : (
        <>
          <div className="space-y-2 px-4 py-4">
            {post.visual_concept && network === "instagram" ? (
              <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                {post.visual_concept}
              </p>
            ) : null}
            {post.city_or_neighborhood &&
            (network === "google" || network === "facebook") ? (
              <p className="text-xs font-medium text-slate-500">
                📍 {post.city_or_neighborhood}
              </p>
            ) : null}
            <h3
              className="break-words text-lg font-bold leading-snug text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {post.headline}
            </h3>
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-slate-800">
              {post.body}
            </p>
            {post.offer && network === "google" ? (
              <p className="break-words text-sm font-semibold text-emerald-700">
                {post.offer}
              </p>
            ) : null}
            {post.call_to_action ? (
              <p className="break-words text-sm font-medium text-slate-900">
                {post.call_to_action}
              </p>
            ) : null}
            {hashtags && network === "instagram" ? (
              <p className="break-words text-sm leading-relaxed text-accent">
                {hashtags}
              </p>
            ) : null}
          </div>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white hover:brightness-95"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span className="break-words">{C.waSendMessage}</span>
            </a>
          ) : network !== "google" && !publishActions ? (
            <div className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white">
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span className="break-words">{C.waSendMessage}</span>
            </div>
          ) : network === "google" && !publishActions ? (
            <div className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-bold text-white">
              <Phone className="h-5 w-5 shrink-0" />
              <span className="break-words">
                {post.call_to_action || C.gbpCallNow}
              </span>
            </div>
          ) : null}

          {publishActions ? (
            <div className="mx-4 mb-4">{publishActions}</div>
          ) : null}
        </>
      )}
    </article>
  );
}
