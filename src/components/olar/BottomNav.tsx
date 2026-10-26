"use client";

import type { OlarView } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { Bot, Clapperboard, Globe, Home, Settings } from "lucide-react";

const ITEMS: { id: OlarView; label: string; icon: typeof Home }[] = [
  { id: "home", label: C.workModeQuick, icon: Home },
  { id: "studio", label: C.navStudioShort || C.studioTitle, icon: Clapperboard },
  { id: "yona", label: C.navAgentSmart || C.navYonaShort, icon: Bot },
  { id: "mypage", label: C.navMyPageShort, icon: Globe },
  { id: "settings", label: C.navNetworksShort, icon: Settings },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: OlarView;
  onChange: (v: OlarView) => void;
}) {
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur-md md:hidden"
      aria-label={C.bottomNav}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-0.5 text-[11px] transition sm:text-sm ${
                  isActive ? "text-accent" : "text-slate-800 hover:text-slate-950"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`h-6 w-6 ${isActive ? "stroke-[2.25]" : ""}`}
                  aria-hidden
                />
                <span className="line-clamp-1 font-medium">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
