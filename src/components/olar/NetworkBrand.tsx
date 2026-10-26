"use client";

import type { IntegrationId, LeadNetwork, SocialNetwork } from "@/lib/olar/types";

export const BRAND: Record<
  IntegrationId,
  { label: string; color: string; bg: string }
> = {
  facebook: { label: "פייסבוק", color: "#1877F2", bg: "#E7F0FE" },
  instagram: { label: "אינסטגרם", color: "#E4405F", bg: "#FCE8EC" },
  tiktok: { label: "טיקטוק", color: "#010101", bg: "#F0F0F0" },
  twitter: { label: "X (טוויטר)", color: "#0F1419", bg: "#E8E8E8" },
  google: { label: "Google Business Profile", color: "#4285F4", bg: "#E8F0FE" },
  easy: { label: "Easy", color: "#00D084", bg: "#ECFDF5" },
  whatsapp: { label: "WhatsApp", color: "#25D366", bg: "#E7F8EE" },
  telegram: { label: "טלגרם", color: "#2AABEE", bg: "#E5F5FC" },
  pinterest: { label: "פינטרסט", color: "#E60023", bg: "#FCE6EA" },
};

export function BrandGlyph({
  id,
  size = 20,
}: {
  id: IntegrationId | LeadNetwork | SocialNetwork | "reels";
  size?: number;
}) {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 24 24", "aria-hidden": true as const };

  switch (id) {
    case "facebook":
      return (
        <svg {...common} fill="#1877F2">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.56-4.7 1.32 0 2.7.24 2.7.24v2.97h-1.52c-1.5 0-1.96.93-1.96 1.89v2.26h3.34l-.53 3.49h-2.81V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
      );
    case "instagram":
    case "reels":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F58529" />
              <stop offset="50%" stopColor="#DD2A7B" />
              <stop offset="100%" stopColor="#8134AF" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig)" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} fill="#010101">
          <path d="M19.6 8.3a6.8 6.8 0 0 1-4-1.3v7.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V2h2.7a4.1 4.1 0 0 0 4 3.6v2.7z" />
          <path
            d="M19.6 8.3a6.8 6.8 0 0 1-4-1.3v7.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V2h2.7a4.1 4.1 0 0 0 4 3.6v2.7z"
            fill="#25F4EE"
            opacity=".55"
            transform="translate(-.6 -.4)"
          />
          <path
            d="M19.6 8.3a6.8 6.8 0 0 1-4-1.3v7.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V2h2.7a4.1 4.1 0 0 0 4 3.6v2.7z"
            fill="#FE2C55"
            opacity=".55"
            transform="translate(.6 .4)"
          />
        </svg>
      );
    case "twitter":
      return (
        <svg {...common} fill="#0F1419">
          <path d="M18.2 2H21l-6.6 7.5L22 22h-6.2l-4.9-6.4L5.5 22H2.7l7-8L2 2h6.3l4.4 5.8L18.2 2zm-1.1 18h1.7L7 3.9H5.2L17.1 20z" />
        </svg>
      );
    case "google":
      return (
        <svg {...common}>
          <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4C20.9 17.8 22 15.2 22 12.2z" />
          <path fill="#34A853" d="M12 22c2.9 0 5.3-.9 7.1-2.5l-3.4-2.6c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.4H2.4v2.7A10 10 0 0 0 12 22z" />
          <path fill="#FBBC05" d="M5.9 13.6A6 6 0 0 1 5.6 12c0-.6.1-1.1.3-1.6V7.7H2.4A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l2.8-2.8z" />
          <path fill="#EA4335" d="M12 5.9c1.6 0 3 .5 4.1 1.6l3.1-3.1A10 10 0 0 0 2.4 7.7l3.5 2.7C6.8 7.8 9.2 5.9 12 5.9z" />
        </svg>
      );
    case "easy":
      return (
        <svg {...common}>
          <path
            fill="#00D084"
            d="M12 2.2C8.3 2.2 5.3 5.2 5.3 8.9c0 5.1 6.7 12.9 6.7 12.9s6.7-7.8 6.7-12.9C18.7 5.2 15.7 2.2 12 2.2z"
          />
          <circle cx="12" cy="9" r="3.6" fill="#fff" />
          <text
            x="12"
            y="11.1"
            textAnchor="middle"
            fill="#00D084"
            fontSize="6.2"
            fontWeight="700"
            fontFamily="system-ui,Segoe UI,sans-serif"
          >
            e
          </text>
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common} fill="#25D366">
          <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.3 1.3-1.8 1.3-.5.1-1.1.1-1.8-.1a11 11 0 0 1-4.8-3.3 9 9 0 0 1-1.9-3.1c-.2-.7.2-1.4.5-1.7.2-.2.5-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.5l-.4.4c-.1.2-.3.3-.1.6.1.3.6 1.1 1.3 1.7.9.8 1.6 1 1.9 1.1.3.1.5.1.6-.1l.8-.9c.1-.2.3-.2.5-.1l1.7.8c.2.1.3.2.4.3.1.3 0 .8-.2 1.2z" />
        </svg>
      );
    case "telegram":
      return (
        <svg {...common} fill="#2AABEE">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.7 6.8-1.6 7.5c-.1.5-.4.7-.9.4l-2.4-1.8-1.2 1.1c-.1.1-.3.3-.5.3l.2-2.5 4.6-4.1c.2-.2 0-.3-.2-.1l-5.7 3.6-2.4-.8c-.5-.1-.5-.5.1-.8l9.4-3.6c.4-.2.8.1.6.8z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg {...common} fill="#E60023">
          <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 .0-2.9l1.3-5.5s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.5-.3 1.1.5 1.9 1.5 1.9 1.8 0 3.2-1.9 3.2-4.7 0-2.4-1.8-4.2-4.3-4.2a4.5 4.5 0 0 0-4.6 4.5c0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.2c0 .2-.1.2-.3.1-1.3-.6-2.1-2.4-2.1-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.7A10 10 0 0 0 12 22 10 10 0 0 0 12 2z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="currentColor">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

export function BrandChip({
  id,
  active,
  onClick,
  size = "md",
}: {
  id: IntegrationId;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const meta = BRAND[id];
  return (
    <button
      type="button"
      onClick={onClick}
      title={meta.label}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border transition ${
        size === "sm" ? "min-h-10 px-2.5" : "min-h-11 px-3"
      } ${
        active
          ? "border-transparent text-white shadow-sm"
          : "border-line bg-panel text-ink hover:bg-paper-deep"
      }`}
      style={active ? { backgroundColor: meta.color } : undefined}
    >
      <BrandGlyph id={id} size={size === "sm" ? 16 : 18} />
      <span className={`font-medium ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {meta.label}
      </span>
    </button>
  );
}
