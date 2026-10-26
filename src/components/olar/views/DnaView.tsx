"use client";

import { loadProfile, useResolvedMyPage } from "@/lib/olar/business-profile";
import { C } from "@/lib/olar/ui-copy";
import { FooterBrand } from "@/components/olar/FooterBrand";
import { Fingerprint } from "lucide-react";

/** Standalone Business DNA screen — separate from network settings. */
export function DnaView() {
  const { page } = useResolvedMyPage();
  const profile = loadProfile();

  return (
    <div className="mx-auto w-full max-w-3xl animate-rise space-y-6" dir="rtl">
      <header className="rounded-2xl border border-cyan-200/80 bg-white p-6 text-right shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <Fingerprint className="h-6 w-6" />
          </span>
          <div>
            <h1
              className="text-2xl font-bold text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.navDnaSettings || "ה-DNA והגדרות העסק"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              פרטי המותג שנשמרו מההיכרות — משמשים לפוסטים, לתמונות ולכרטיס הדיגיטלי
            </p>
          </div>
        </div>
      </header>

      <section
        id="dna"
        className="rounded-2xl border border-slate-200/80 bg-white p-6 text-right shadow-sm"
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="text-xs font-semibold text-slate-500">שם העסק</dt>
            <dd className="mt-1 text-base font-bold text-slate-900">
              {profile?.businessName || page.businessName || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="text-xs font-semibold text-slate-500">תחום</dt>
            <dd className="mt-1 text-base font-bold text-slate-900">
              {profile?.niche || page.tagline || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="text-xs font-semibold text-slate-500">עיר</dt>
            <dd className="mt-1 text-base font-bold text-slate-900">
              {profile?.city || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <dt className="text-xs font-semibold text-slate-500">
              טלפון / וואטסאפ
            </dt>
            <dd className="mt-1 text-base font-bold text-slate-900" dir="ltr">
              {profile?.whatsapp || profile?.phone || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3 sm:col-span-2">
            <dt className="text-xs font-semibold text-slate-500">תיאור</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-800">
              {profile?.description || page.description || "—"}
            </dd>
          </div>
          {profile?.rawInput ? (
            <div className="rounded-xl bg-slate-50 px-3 py-3 sm:col-span-2">
              <dt className="text-xs font-semibold text-slate-500">
                טקסט מקור מההיכרות
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                {profile.rawInput}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <FooterBrand />
    </div>
  );
}
