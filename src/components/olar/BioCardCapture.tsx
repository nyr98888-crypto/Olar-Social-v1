"use client";

import { forwardRef } from "react";
import type { ResolvedMyPage } from "@/lib/olar/business-profile";
import { C } from "@/lib/olar/ui-copy";
import { MapPin, Phone, Wrench } from "lucide-react";

/**
 * Branded bio card for PNG capture (html-to-image) + WA/story share.
 * Guest-safe: renders empty shell when no businessName.
 */
export const BioCardCapture = forwardRef<
  HTMLDivElement,
  { page: ResolvedMyPage; heroImageUrl?: string | null }
>(function BioCardCapture({ page, heroImageUrl }, ref) {
  const name = page.businessName || C.myBiz;
  const nicheCity = [page.tagline, page.address].filter(Boolean).join(" · ");
  const services = (page.services || []).slice(0, 3);
  const phone = page.phone || page.whatsapp || "";
  const cover =
    heroImageUrl && !heroImageUrl.startsWith("data:image/svg")
      ? heroImageUrl
      : page.logoUrl || page.avatarUrl || null;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="w-[360px] overflow-hidden rounded-3xl border border-slate-200 bg-white text-right shadow-lg"
      style={{ fontFamily: "var(--font-sans, system-ui)" }}
    >
      {cover ? (
        <div className="relative h-40 w-full bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            crossOrigin="anonymous"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-5 pb-3 pt-10">
            <p className="text-xs font-semibold tracking-wide text-white/80">
              Olar Social
            </p>
            <p
              className="truncate text-xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {name}
            </p>
            {nicheCity ? (
              <p className="mt-0.5 truncate text-sm text-white/85">{nicheCity}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 px-5 pb-8 pt-5">
          <p className="text-xs font-semibold tracking-wide text-white/80">
            Olar Social
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black text-white">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {name}
              </p>
              {nicheCity ? (
                <p className="mt-0.5 truncate text-sm text-white/85">
                  {nicheCity}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 px-5 py-4">
        {page.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
            {page.description}
          </p>
        ) : null}

        {services.length > 0 ? (
          <ul className="space-y-1.5">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                <Wrench className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                <span className="truncate">{s.title}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {page.address ? (
          <p className="flex items-center justify-end gap-2 text-sm text-slate-600">
            <span className="truncate">{page.address}</span>
            <MapPin className="h-4 w-4 shrink-0 text-sky-600" />
          </p>
        ) : null}

        {phone ? (
          <p className="flex items-center justify-end gap-2 text-sm font-medium text-slate-800">
            <span dir="ltr">{phone}</span>
            <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
          </p>
        ) : null}

        {page.url ? (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-xs font-semibold text-sky-800" dir="ltr">
            {page.url}
          </p>
        ) : null}
      </div>
    </div>
  );
});
