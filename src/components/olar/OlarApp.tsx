"use client";

import { useEffect, useRef, useState } from "react";
import type { OlarView } from "@/lib/olar/types";
import { BUSINESS_NAME } from "@/lib/olar/mock-data";
import { useOlarTheme } from "@/lib/olar/theme";
import { useWorkMode } from "@/lib/olar/work-mode";
import { C } from "@/lib/olar/ui-copy";
import { LogOut, Menu, Settings2 } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { Onboarding, useOnboardingGate } from "./Onboarding";
import { RightDock } from "./RightDock";
import { TopTicker } from "./TopTicker";
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

  // After Google OAuth callback: restore onboarding profile + mark done
  useEffect(() => {
    try {
      const pending = localStorage.getItem("olar-onboarding-pending") === "1";
      const backup = localStorage.getItem("olar-onboarding-profile-backup");
      if (!pending && !backup) return;
      if (backup) {
        localStorage.setItem("olar-business-profile", backup);
        localStorage.removeItem("olar-onboarding-profile-backup");
      }
      localStorage.setItem("olar-onboarding-done", "1");
      localStorage.removeItem("olar-onboarding-pending");
      complete();
    } catch {
      /* ignore */
    }
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
      <header className="relative z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="olar-icon-wrap flex h-11 w-11 shrink-0 items-center justify-center bg-accent-soft text-base font-bold text-accent sm:h-12 sm:w-12">
            {BUSINESS_NAME.slice(0, 1)}
          </div>
          <div className="min-w-0 text-right">
            <p
              className="truncate text-lg font-bold text-slate-950 sm:text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {BUSINESS_NAME}
            </p>
            <p className="truncate text-sm text-slate-800 sm:text-base">
              {TITLES[view]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="olar-btn flex h-12 w-12 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-950 transition hover:bg-accent-soft"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-800 transition hover:ring-2 hover:ring-sky-600"
              aria-label={C.userMenuAria}
              aria-expanded={userMenuOpen}
            >
              {BUSINESS_NAME.slice(0, 1)}
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
            className="olar-btn flex h-12 w-12 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-950 transition hover:bg-accent-soft"
            aria-label={C.openSettingsAria}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main
        className={`relative z-0 min-h-0 w-full flex-1 overflow-x-hidden bg-slate-50 ${
          view === "yona" || view === "studio"
            ? "overflow-hidden pb-14 md:pb-0"
            : "overflow-y-auto pb-24 md:pb-8"
        }`}
      >
        <div
          className={
            view === "yona" || view === "studio"
              ? "mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-6 py-4"
              : isQuickHome
                ? "olar-page-quick"
                : "olar-page"
          }
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
          {view === "calendar" && <CalendarView />}
          {view === "leads" && <LeadsView />}
          {view === "reviews" && <ReviewsView />}
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
    </div>
  );
}
