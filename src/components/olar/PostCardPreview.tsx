"use client";

import type { SocialNetwork } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "./NetworkBrand";
import { MessageCircle } from "lucide-react";

export type PostCardData = {
  headline: string;
  body: string;
  hashtags?: string[];
  call_to_action?: string;
};

function platformLabel(network: SocialNetwork): string {
  if (network === "facebook") return C.platformFacebook || "Facebook";
  if (network === "instagram" || network === "reels")
    return C.platformInstagram || "Instagram";
  if (network === "google") return C.platformGoogle || "Google Business";
  return C.platformInstagram || "Instagram";
}

function glyphId(
  network: SocialNetwork
): "facebook" | "instagram" | "google" | "twitter" {
  if (network === "facebook") return "facebook";
  if (network === "google") return "google";
  if (network === "twitter") return "twitter";
  return "instagram";
}

function aspectClass(network: SocialNetwork): string {
  // Google Business leans 16:9 landscape; FB/IG feed-style 4:3
  if (network === "google") return "aspect-video";
  return "aspect-[4/3]";
}

export function PostCardPreview({
  network,
  businessName,
  logoUrl,
  post,
  imageUrl,
  imageLoading,
  waHref,
  className = "",
}: {
  network: SocialNetwork;
  businessName: string;
  logoUrl?: string | null;
  post: PostCardData;
  imageUrl?: string | null;
  imageLoading?: boolean;
  waHref?: string | null;
  className?: string;
}) {
  const tag = platformLabel(network);
  const hashtags = (post.hashtags || [])
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");

  return (
    <article
      className={`w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-md ${className}`}
      dir="rtl"
    >
      {/* Header: business + platform tag */}
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

      {/* Ad image */}
      <div className={`relative w-full bg-slate-100 ${aspectClass(network)}`}>
        {imageLoading ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-sky-100 via-slate-100 to-white" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col justify-end bg-gradient-to-br from-accent-soft via-slate-50 to-white p-4">
            <p
              className="break-words text-lg font-bold leading-snug text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {post.headline}
            </p>
            <p className="mt-1 text-sm text-slate-600">{C.imgReady}</p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="space-y-2 px-4 py-4">
        <h3
          className="break-words text-lg font-bold leading-snug text-slate-950"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {post.headline}
        </h3>
        <p className="whitespace-pre-line break-words text-base leading-relaxed text-slate-800">
          {post.body}
        </p>
        {post.call_to_action ? (
          <p className="break-words text-sm font-medium text-slate-900">
            {post.call_to_action}
          </p>
        ) : null}
        {hashtags ? (
          <p className="break-words text-sm leading-relaxed text-accent">
            {hashtags}
          </p>
        ) : null}
      </div>

      {/* Green WhatsApp CTA */}
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
      ) : (
        <div className="mx-4 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-base font-bold text-white">
          <MessageCircle className="h-5 w-5 shrink-0" />
          <span className="break-words">{C.waSendMessage}</span>
        </div>
      )}
    </article>
  );
}
