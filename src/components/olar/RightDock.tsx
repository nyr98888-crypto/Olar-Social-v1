"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { fetchCalendarEvents } from "@/lib/olar/calendar-client";
import {
  Bot,
  CalendarCheck,
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
  /** When set, navigates via Next.js Link (full route) instead of SPA view switch */
  href?: string;
  /** Show live count / green pulse for operational items */
  showLiveBadge?: boolean;
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
        label: C.navCalendarWork || "יומן עבודה ופגישות",
        icon: CalendarCheck,
        href: "/calendar",
        showLiveBadge: true,
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
        href: "/settings",
      },
      {
        key: "dna",
        id: "dna",
        label: C.navDnaSettings,
        icon: Fingerprint,
        href: "/dna",
      },
    ],
  },
];

function navItemClass(isActive: boolean, prominent = false): string {
  if (isActive) {
    return prominent
      ? "border-r-2 border-cyan-400 bg-cyan-500/10 font-bold text-cyan-400"
      : "border-r-2 border-cyan-400 bg-cyan-500/10 font-bold text-cyan-400";
  }
  return prominent
    ? "font-semibold text-slate-100 hover:bg-slate-900/80 hover:text-white"
    : "font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white";
}

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
  const pathname = usePathname();
  const [activeEventCount, setActiveEventCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadBadge() {
      try {
        const { events } = await fetchCalendarEvents();
        if (cancelled) return;
        const upcoming = events.filter(
          (e) =>
            e.status === "scheduled" &&
            new Date(e.start_time).getTime() >= Date.now() - 60 * 60 * 1000
        );
        setActiveEventCount(upcoming.length);
      } catch {
        /* soft */
      }
    }
    void loadBadge();
    return () => {
      cancelled = true;
    };
  }, [open, pathname]);

  function closeDrawer() {
    onOpenChange(false);
  }

  function isItemActive(item: NavItem): boolean {
    if (item.href === "/calendar" || item.id === "calendar") {
      return pathname === "/calendar" || active === "calendar";
    }
    if (item.href === "/dna" || item.id === "dna") {
      return pathname === "/dna" || active === "dna";
    }
    if (item.href === "/settings" || item.key === "networks") {
      return pathname?.startsWith("/settings") || active === "settings";
    }
    if (
      pathname === "/calendar" ||
      pathname === "/dna" ||
      pathname?.startsWith("/settings")
    ) {
      return false;
    }
    return active === item.id;
  }

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
        onClick={closeDrawer}
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
              closeDrawer();
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
            onClick={closeDrawer}
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
                  const isActive = isItemActive(item);
                  const prominent = item.key === "calendar";
                  const className = `olar-btn flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-right text-[15px] transition ${navItemClass(
                    isActive,
                    prominent
                  )}`;

                  const badge =
                    item.showLiveBadge ? (
                      <span className="ms-auto inline-flex shrink-0 items-center gap-1.5">
                        {activeEventCount > 0 ? (
                          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                            {activeEventCount > 99 ? "99+" : activeEventCount}
                          </span>
                        ) : (
                          <span
                            className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                            title="יומן פעיל"
                            aria-hidden
                          />
                        )}
                      </span>
                    ) : null;

                  const content = (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive ? "text-cyan-400" : "text-slate-400"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {badge}
                    </>
                  );

                  return (
                    <li key={item.key}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={closeDrawer}
                          className={className}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate(item.id);
                            closeDrawer();
                          }}
                          className={className}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {content}
                        </button>
                      )}
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
