"use client";

import type { OlarView } from "@/lib/olar/types";
import { useClientAuth } from "@/lib/olar/auth-client";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { useCurrentPost } from "@/lib/olar/current-post";
import { C } from "@/lib/olar/ui-copy";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";

const ZERO_STATS = [
  { label: "שיתופים השבוע", value: "0" },
  { label: "הודעות וואטסאפ", value: "0" },
  { label: "לידים", value: "0" },
  { label: "כניסות לדף", value: "0" },
];

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (v: OlarView) => void;
}) {
  const { isGuest, ready } = useClientAuth();
  const { page } = useResolvedMyPage();
  const { post } = useCurrentPost();
  const hasActivity = Boolean(
    post?.headline?.trim() || page.firstPost?.headline?.trim()
  );
  const displayName =
    !isGuest && page.businessName?.trim() ? page.businessName.trim() : null;

  if (!ready) return <div className="min-h-[40vh] w-full" />;

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="space-y-2 text-right">
        <p className="text-base font-medium text-accent">{C.homeTitle}</p>
        <h1
          className="text-3xl font-bold leading-tight text-slate-950 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isGuest || !displayName
            ? C.guestHelloWelcome
            : `${C.helloWhat} ${displayName}`}
        </h1>
        <p className="w-full text-lg leading-relaxed text-slate-800">
          {isGuest ? C.emptyDashboardInvite : C.pickSimple}
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ZERO_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm"
          >
            <p className="text-base text-slate-700">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{stat.value}</p>
          </div>
        ))}
      </div>

      {!hasActivity ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-lg font-medium text-slate-700">
            {C.emptyDashboardInvite}
          </p>
          <button
            type="button"
            onClick={() => onNavigate("yona")}
            className="olar-cta mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-base font-bold"
          >
            <Zap className="h-5 w-5" />
            {C.guestWelcomeCta}
          </button>
        </section>
      ) : null}

      <div className="grid w-full gap-3 sm:grid-cols-2">
        {(
          [
            { id: "yona" as const, label: "השותפה לשיווק" },
            { id: "studio" as const, label: "סטודיו" },
            { id: "calendar" as const, label: "יומן" },
            { id: "mypage" as const, label: "דף הביו" },
          ] as const
        ).map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate(action.id)}
            className="flex min-h-14 cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 text-right shadow-sm transition hover:border-cyan-400"
          >
            <span className="flex items-center gap-2 text-lg font-medium text-slate-950">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              {action.label}
            </span>
            <ArrowLeft className="h-5 w-5 text-slate-700" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
