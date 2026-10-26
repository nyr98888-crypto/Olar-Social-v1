"use client";

import { useEffect, useRef, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { useOlarTheme } from "@/lib/olar/theme";
import { useWorkMode } from "@/lib/olar/work-mode";
import { C } from "@/lib/olar/ui-copy";
import Image from "next/image";
import { LogOut, Menu, Settings2 } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { Onboarding, useOnboardingGate } from "./Onboarding";
import { RightDock } from "./RightDock";
import { TopTicker } from "./TopTicker";
import { GlobalAgentDrawer } from "./GlobalAgentDrawer";
import { WorkModeToggle } from "./WorkModeToggle";
import { AnalyticsView } from "./views/AnalyticsView";
import { CalendarView } from "./views/CalendarView";
import { DashboardView } from "./views/DashboardView";
import { LeadsView } from "./views/LeadsView";
import { MyPageView } from "./views/MyPageView";
import { QuickHomeView } from "./views/QuickHomeView";
import { ReviewsView } from "./views/ReviewsView";
import { SettingsView } from "./views/SettingsView";
import { StudioView } from "./views/StudioView";
import { YonaView } from "./views/YonaView";

const TITLES: Record<OlarView, string> = {
  home: C.homeTitle,
  yona: C.yonaTitle,
  studio: C.studioTitle,
  calendar: C.calendarTitle,
  leads: C.peopleTitle,
  reviews: C.reviewsTitle,
  analytics: C.whatWorked,
  mypage: C.myPageTitle,
  settings: C.networksTitle,
};

export function OlarApp() {
  const [view, setView] = useState<OlarView>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { ready, show, complete, restart } = useOnboardingGate();
  const { theme, ready: themeReady } = useOlarTheme();
  const { workMode, setWorkMode, ready: modeReady } = useWorkMode();

  function finishOnboarding() {
    setWorkMode("quick");
    setView("home");
    complete();
  }

  function handleNavigate(next: OlarView) {
    setMenuOpen(false);
    setUserMenuOpen(false);
    setView(next);
  }

  function handleWorkMode(next: typeof workMode) {
    setMenuOpen(false);
    setUserMenuOpen(false);
    setWorkMode(next);
    if (view !== "home") setView("home");
  }

  function handleRestartOnboarding() {
    setUserMenuOpen(false);
    setMenuOpen(false);
    setView("home");
    setWorkMode("quick");
    restart();
  }

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenuOpen]);

  // After Google OAuth callback: restore profile + post (incl. FAL image) → Supabase
  useEffect(() => {
    let cancelled = false;

    async function finalizeAuthTransition() {
      try {
        const pending = localStorage.getItem("olar-onboarding-pending") === "1";
        const backup = localStorage.getItem("olar-onboarding-profile-backup");
        const postBackup = localStorage.getItem("olar-onboarding-post-backup");
        const currentRaw =
          localStorage.getItem("current_business_post") ||
          sessionStorage.getItem("current_business_post");

        if (!pending && !backup && !postBackup) {
          // Still try hydrate from server when already authed
          try {
            const res = await fetch("/api/posts/current", {
              signal: AbortSignal.timeout(8_000),
            });
            const data = (await res.json().catch(() => ({}))) as {
              post?: {
                headline?: string;
                body?: string;
                cta?: string;
                hashtags?: string[];
                offer?: string;
                image_url?: string | null;
                image_seed?: number | null;
                image_prompt?: string | null;
                network?: string;
                updatedAt?: string;
              } | null;
              guestMode?: boolean;
            };
            if (
              !cancelled &&
              data.post &&
              !data.guestMode &&
              (data.post.image_url || data.post.headline)
            ) {
              const { saveCurrentPost } = await import(
                "@/lib/olar/current-post"
              );
              saveCurrentPost({
                headline: data.post.headline || "",
                body: data.post.body || "",
                cta: data.post.cta || "",
                hashtags: data.post.hashtags || [],
                offer: data.post.offer,
                image_url: data.post.image_url ?? null,
                image_seed: data.post.image_seed ?? null,
                image_prompt: data.post.image_prompt ?? null,
                network: data.post.network,
              });
            }
          } catch {
            /* soft */
          }
          return;
        }

        if (backup) {
          localStorage.setItem("olar-business-profile", backup);
        }

        let postPayload: Record<string, unknown> | null = null;
        try {
          const raw = postBackup || currentRaw;
          if (raw) postPayload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          postPayload = null;
        }

        if (postPayload) {
          const { saveCurrentPost } = await import("@/lib/olar/current-post");
          saveCurrentPost({
            headline: String(postPayload.headline || ""),
            body: String(postPayload.body || ""),
            cta: String(postPayload.cta || ""),
            hashtags: Array.isArray(postPayload.hashtags)
              ? (postPayload.hashtags as string[])
              : [],
            offer:
              typeof postPayload.offer === "string"
                ? postPayload.offer
                : undefined,
            image_url:
              typeof postPayload.image_url === "string"
                ? postPayload.image_url
                : null,
            image_seed:
              typeof postPayload.image_seed === "number"
                ? postPayload.image_seed
                : null,
            image_prompt:
              typeof postPayload.image_prompt === "string"
                ? postPayload.image_prompt
                : null,
            network:
              typeof postPayload.network === "string"
                ? postPayload.network
                : undefined,
          });
        }

        // Persist under new user_id in Supabase
        try {
          let profileObj: unknown = null;
          if (backup) {
            try {
              profileObj = JSON.parse(backup);
            } catch {
              profileObj = null;
            }
          }
          await fetch("/api/posts/current", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(postPayload || {}),
              business_profile: profileObj,
            }),
            signal: AbortSignal.timeout(15_000),
          });
        } catch {
          /* soft — local copy already saved */
        }

        localStorage.setItem("olar-onboarding-done", "1");
        localStorage.removeItem("olar-onboarding-pending");
        localStorage.removeItem("olar-onboarding-profile-backup");
        localStorage.removeItem("olar-onboarding-post-backup");
        if (!cancelled) {
          setWorkMode("quick");
          setView("home");
          complete();
        }
      } catch {
        /* ignore */
      }
    }

    void finalizeAuthTransition();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !themeReady || !modeReady) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-paper" />
    );
  }

  if (show) {
    return (
      <div className="olar-shell h-dvh w-full" data-theme={theme}>
        <Onboarding onDone={finishOnboarding} />
      </div>
    );
  }

  const isQuickHome = view === "home" && workMode === "quick";

  return (
    <div
      className="olar-shell flex h-dvh w-full flex-col overflow-x-hidden overflow-hidden"
      data-theme={theme}
      dir="rtl"
    >
      <TopTicker onNavigate={handleNavigate} />

      {/*
        RTL header:
        - Visual RIGHT (flex start in RTL): brand logo + menu
        - Visual LEFT (flex end in RTL): work-mode + avatar + settings
      */}
      <header className="relative z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 bg-[#0B0F19] px-3 text-white sm:gap-3 sm:px-6 lg:px-8">
        {/* Brand gradient bottom border */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500" aria-hidden="true" />

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleNavigate("home")}
            className="inline-flex min-w-0 items-center px-1 py-1.5"
            aria-label="One Loop Social — בית"
          >
            <Image
              src="/one-loop-logo.png?v=2"
              alt="One Loop Social"
              width={215}
              height={120}
              priority
              className="h-9 w-auto object-contain sm:h-10"
            />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="olar-btn flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={C.openMenu}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <WorkModeToggle mode={workMode} onChange={handleWorkMode} />
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white transition hover:ring-2 hover:ring-cyan-400"
              aria-label={C.userMenuAria}
              aria-expanded={userMenuOpen}
            >
              O
            </button>
            {userMenuOpen && (
              <div className="absolute left-0 top-12 z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 text-right shadow-xl">
                <button
                  type="button"
                  onClick={handleRestartOnboarding}
                  className="flex min-h-12 w-full items-center justify-end gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-sky-50"
                >
                  <span>{C.logoutRestartOnboarding}</span>
                  <LogOut className="h-4 w-4 shrink-0 text-slate-700" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleNavigate("settings")}
            className="olar-btn flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={C.openSettingsAria}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main
        className={`relative z-0 min-h-0 w-full flex-1 overflow-x-hidden bg-[#F8FAFC] text-slate-900 ${
          view === "yona" || view === "studio"
            ? "overflow-hidden pb-14 md:pb-0"
            : "overflow-y-auto pb-24 md:pb-8"
        }`}
      >
        {/* Ambient brand glow under navbar */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% -20%, rgba(6,182,212,0.08), rgba(147,51,234,0.05), transparent)" }}
          aria-hidden="true"
        />
        <div
          className={`relative z-10 ${
            view === "yona" || view === "studio"
              ? "flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden px-6 lg:px-8 py-6"
              : isQuickHome
                ? "olar-page-quick"
                : view === "settings"
                  ? "olar-page olar-page-networks"
                  : "olar-page"
          }`}
        >
          {view === "home" &&
            (workMode === "quick" ? (
              <QuickHomeView
                onNavigate={handleNavigate}
                onGoFull={() => handleWorkMode("full")}
              />
            ) : (
              <DashboardView onNavigate={handleNavigate} />
            ))}
          {view === "yona" && <YonaView />}
          {view === "studio" && <StudioView />}
          {view === "calendar" && <CalendarView onNavigate={handleNavigate} />}
          {view === "leads" && <LeadsView onNavigate={handleNavigate} />}
          {view === "reviews" && <ReviewsView onNavigate={handleNavigate} />}
          {view === "analytics" && <AnalyticsView />}
          {view === "mypage" && <MyPageView />}
          {view === "settings" && <SettingsView />}
        </div>
      </main>

      <BottomNav active={view} onChange={handleNavigate} />

      <RightDock
        active={view}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onNavigate={handleNavigate}
      />

      <GlobalAgentDrawer
        activeView={view}
        onNavigateToStudio={() => handleNavigate("studio")}
      />
    </div>
  );
}
