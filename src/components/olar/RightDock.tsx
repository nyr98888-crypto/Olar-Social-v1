"use client";

import type { OlarView } from "@/lib/olar/types";
import { BUSINESS_NAME } from "@/lib/olar/mock-data";
import { C } from "@/lib/olar/ui-copy";
import {
  Bot,
  CalendarDays,
  Clapperboard,
  Eye,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings2,
  Star,
  X,
} from "lucide-react";

const NAV: {
  id: OlarView;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
}[] = [
  { id: "yona", label: C.navAgentSmart || C.yonaTitle, icon: Bot },
  { id: "studio", label: C.navCampaigns || C.studioTitle, icon: Clapperboard },
  { id: "mypage", label: C.navBioPage || C.myPageTitle, icon: Globe },
  { id: "home", label: C.homeTitle, icon: LayoutDashboard },
  { id: "settings", label: C.networksTitle, icon: Settings2 },
  { id: "leads", label: C.peopleTitle, icon: MessageSquare, soon: true },
  { id: "calendar", label: C.calendarTitle, icon: CalendarDays, soon: true },
  { id: "reviews", label: C.reviewsTitle, icon: Star, soon: true },
  { id: "analytics", label: C.whatWorked, icon: Eye, soon: true },
];

/**
 * Floating overlay drawer (does NOT push page content).
 */
export function RightDock({
  active,
  open,
  onOpenChange,
  onNavigate,
}: {
  active: OlarView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate: (v: OlarView) => void;
}) {
  return (
    <>
      <div
        className="fixed inset-y-0 right-0 z-40 hidden w-3 md:block"
        onMouseEnter={() => onOpenChange(true)}
        aria-hidden
      />

      <div
        className={`fixed inset-0 z-50 bg-slate-900/25 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => onOpenChange(false)}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(100%,20rem)] flex-col bg-panel shadow-[var(--shadow)] transition-transform duration-300 ease-out ${
          open
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        }`}
        onMouseEnter={() => {
          if (open) onOpenChange(true);
        }}
        onMouseLeave={() => onOpenChange(false)}
        role="dialog"
        aria-modal={open}
        aria-label={C.menuLabel}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="text-right">
            <p
              className="text-xl font-semibold text-slate-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {BUSINESS_NAME}
            </p>
            <p className="text-base text-slate-800">{C.menuAll}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-slate-900"
            aria-label={C.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.soon) return;
                      onNavigate(item.id);
                      onOpenChange(false);
                    }}
                    disabled={item.soon}
                    className={`olar-btn flex min-h-14 w-full items-center gap-3 px-4 text-right text-base font-medium ${
                      item.soon
                        ? "cursor-not-allowed opacity-60 text-slate-600"
                        : isActive
                          ? "bg-accent text-white"
                          : "text-slate-900 hover:bg-paper-deep/50"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.soon ? (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {C.comingSoon}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
