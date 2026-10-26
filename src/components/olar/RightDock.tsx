"use client";

import Image from "next/image";
import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import {
  Bot,
  CalendarDays,
  Clapperboard,
  Eye,
  Fingerprint,
  Globe,
  Link2,
  MessageSquare,
  Star,
  X,
} from "lucide-react";

type NavItem = {
  key: string;
  id: OlarView;
  label: string;
  icon: typeof Bot;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: C.navSectionMarketing,
    items: [
      {
        key: "studio-partner",
        id: "yona",
        label: C.navStudioPartner,
        icon: Bot,
      },
      {
        key: "calendar",
        id: "calendar",
        label: C.calendarTitle,
        icon: CalendarDays,
      },
      {
        key: "campaigns",
        id: "studio",
        label: C.navCampaigns,
        icon: Clapperboard,
      },
    ],
  },
  {
    title: C.navSectionCustomers,
    items: [
      {
        key: "leads",
        id: "leads",
        label: C.peopleTitle,
        icon: MessageSquare,
      },
      {
        key: "reviews",
        id: "reviews",
        label: C.navReviewsShort,
        icon: Star,
      },
      {
        key: "analytics",
        id: "analytics",
        label: C.whatWorked,
        icon: Eye,
      },
    ],
  },
  {
    title: C.navSectionAssets,
    items: [
      {
        key: "bio",
        id: "mypage",
        label: C.navDigitalCard,
        icon: Globe,
      },
      {
        key: "networks",
        id: "settings",
        label: C.navConnectNetworks,
        icon: Link2,
      },
      {
        key: "dna",
        id: "settings",
        label: C.navDnaSettings,
        icon: Fingerprint,
      },
    ],
  },
];

/**
 * Floating overlay drawer (does NOT push page content).
 * Grouped by business priority: marketing → customers → assets.
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
        className={`fixed inset-0 z-50 bg-slate-950/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => onOpenChange(false)}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(100%,20rem)] flex-col border-l border-slate-800/90 bg-[#0B0F19] text-white shadow-2xl transition-transform duration-300 ease-out ${
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
        <div className="relative flex items-center justify-between bg-[#0B0F19] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500"
            aria-hidden="true"
          />
          <button
            type="button"
            className="inline-flex min-w-0 items-center px-1 py-1.5"
            onClick={() => {
              onNavigate("home");
              onOpenChange(false);
            }}
            aria-label="One Loop Social — בית"
          >
            <Image
              src="/one-loop-logo.png?v=2"
              alt="One Loop Social"
              width={215}
              height={120}
              className="h-9 w-auto object-contain"
            />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 transition hover:text-white"
            aria-label={C.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto bg-[#0B0F19] py-2">
          {SECTIONS.map((section, sectionIndex) => (
            <div key={section.title}>
              {sectionIndex > 0 ? (
                <div
                  className="my-2 border-t border-slate-800/60"
                  aria-hidden
                />
              ) : null}
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              <ul>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          onOpenChange(false);
                        }}
                        className={`olar-btn flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-right text-[15px] transition ${
                          isActive
                            ? "border-s-2 border-cyan-400 bg-cyan-500/10 font-semibold text-cyan-400"
                            : "font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? "text-cyan-400" : "text-slate-400"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
