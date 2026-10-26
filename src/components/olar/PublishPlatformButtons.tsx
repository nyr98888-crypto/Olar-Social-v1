"use client";

import type { PublishMode } from "@/lib/olar/social-accounts";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "./NetworkBrand";

const FB_BLUE = "#1877F2";
const IG_GRADIENT =
  "linear-gradient(135deg, #f58529 0%, #dd2a7b 45%, #8134af 70%, #515bd4 100%)";

export function PublishPlatformButtons({
  facebookMode,
  instagramMode,
  busy,
  onPublish,
  className = "",
}: {
  facebookMode: PublishMode;
  instagramMode: PublishMode;
  busy?: boolean;
  onPublish: (platform: "facebook" | "instagram") => void;
  className?: string;
}) {
  const fbLabel =
    facebookMode === "api_business"
      ? C.publishAuto || "פרסם אוטומטית"
      : C.publishFbAssisted || "פרסם בפייסבוק (3 קליקים)";

  const igLabel =
    instagramMode === "api_business"
      ? C.publishAuto || "פרסם אוטומטית"
      : C.publishIgAssisted || "פרסם באינסטגרם (3 קליקים)";

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row ${className}`}
      dir="rtl"
    >
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPublish("facebook");
        }}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        style={{ backgroundColor: FB_BLUE }}
      >
        <BrandGlyph id="facebook" size={16} />
        <span className="truncate">{fbLabel}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPublish("instagram");
        }}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        style={{ background: IG_GRADIENT }}
      >
        <BrandGlyph id="instagram" size={16} />
        <span className="truncate">{igLabel}</span>
      </button>
    </div>
  );
}
