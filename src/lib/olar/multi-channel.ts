/**
 * Multi-Channel Asset Generator helpers — preview tabs, aspects, share/copy.
 * Grounds WhatsApp card / platform text in Business DNA / ResolvedMyPage only.
 */

import type { SocialNetwork } from "@/lib/olar/types";
import type { ResolvedMyPage } from "@/lib/olar/business-profile";
import {
  buildWhatsAppCardShareUrl,
  derivePlatformsFromPost,
  formatWhatsAppCardShareText,
  type PlatformGrounding,
  type PlatformPost,
  type PlatformPosts,
  type SocialPostFields,
} from "../../../schemas/agent";

export type PreviewChannel =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google";

export const PREVIEW_CHANNEL_TABS: {
  id: PreviewChannel;
  label: string;
  glyph: "whatsapp" | "instagram" | "facebook" | "google";
}[] = [
  { id: "whatsapp", label: "WhatsApp Card", glyph: "whatsapp" },
  { id: "instagram", label: "Instagram", glyph: "instagram" },
  { id: "facebook", label: "Facebook", glyph: "facebook" },
  { id: "google", label: "Google Business", glyph: "google" },
];

export function previewChannelToNetwork(
  ch: PreviewChannel
): SocialNetwork {
  return ch === "google" ? "google" : ch;
}

export function networkToPreviewChannel(
  n: SocialNetwork | string | null | undefined
): PreviewChannel {
  if (n === "facebook") return "facebook";
  if (n === "whatsapp") return "whatsapp";
  if (n === "google") return "google";
  return "instagram";
}

/** Aspect for preview shell / FAL — IG is 1:1 per multi-channel spec. */
export function aspectRatioForChannel(ch: PreviewChannel): "1:1" | "4:5" | "16:9" {
  if (ch === "instagram" || ch === "whatsapp") return "1:1";
  if (ch === "google") return "16:9";
  return "16:9"; // facebook storytelling landscape shell
}

export function aspectClassForChannel(ch: PreviewChannel): string {
  if (ch === "instagram" || ch === "whatsapp") return "aspect-square";
  if (ch === "google") return "aspect-video";
  return "aspect-[4/3]";
}

export function groundingFromMyPage(
  page: ResolvedMyPage | null | undefined
): PlatformGrounding | null {
  if (!page?.businessName) return null;
  return {
    businessName: page.businessName,
    logoHint: page.logoUrl
      ? `לוגו ${page.businessName}`
      : page.businessName
        ? `אות ראשונה: ${page.businessName.slice(0, 1)}`
        : undefined,
    services: (page.services || [])
      .map((s) => s.title)
      .filter(Boolean)
      .slice(0, 3),
    phone: page.phone || page.whatsapp || undefined,
    address: page.address || undefined,
    // Prefer real city field; only fall back to address when city is absent
    city: page.city?.trim() || page.address || undefined,
    bioUrl: page.url ? `https://${page.url}` : undefined,
  };
}

export function resolvePlatforms(
  post: SocialPostFields,
  page?: ResolvedMyPage | null
): PlatformPosts {
  return derivePlatformsFromPost(post, groundingFromMyPage(page));
}

export function platformKey(
  ch: PreviewChannel
): keyof PlatformPosts {
  return ch === "google" ? "google_business" : ch;
}

export function getPlatformPost(
  platforms: PlatformPosts | null | undefined,
  ch: PreviewChannel
): PlatformPost | null {
  if (!platforms) return null;
  return platforms[platformKey(ch)] ?? null;
}

/** Map platform variant → PostCardPreview headline/body/hashtags/cta. */
export function platformToCardData(
  post: SocialPostFields,
  platforms: PlatformPosts | null | undefined,
  ch: PreviewChannel
): {
  headline: string;
  body: string;
  hashtags: string[];
  call_to_action?: string;
  visual_concept?: string;
  city_or_neighborhood?: string;
  offer?: string;
  card?: PlatformPost["card"];
} {
  const plat = getPlatformPost(platforms, ch);
  if (!plat) {
    return {
      headline: post.headline,
      body: post.body,
      hashtags: ch === "instagram" ? post.hashtags || [] : [],
      call_to_action: post.call_to_action,
    };
  }

  if (ch === "whatsapp") {
    return {
      headline: plat.card?.name || post.headline,
      body: plat.text,
      hashtags: [],
      call_to_action: plat.cta || "שלח כרטיס זה בוואטסאפ",
      card: plat.card,
    };
  }

  const lines = plat.text.split("\n").filter((l) => l.trim());
  return {
    headline: lines[0] || post.headline,
    body: lines.slice(1).join("\n") || (lines[0] ? "" : post.body),
    hashtags:
      plat.hashtags ??
      (ch === "instagram" ? post.hashtags || [] : []),
    call_to_action: plat.cta || post.call_to_action,
    visual_concept: plat.visual_concept,
    city_or_neighborhood: plat.city_or_neighborhood,
    offer: plat.offer,
  };
}

/** Copy/share text adapted per channel. */
export function formatChannelShareText(
  post: SocialPostFields,
  platforms: PlatformPosts | null | undefined,
  ch: PreviewChannel,
  page?: ResolvedMyPage | null
): string {
  const plat = getPlatformPost(platforms, ch);
  if (ch === "whatsapp") {
    const wa =
      plat ||
      resolvePlatforms(post, page).whatsapp || {
        text: `${post.headline}\n${post.body}`,
        cta: "שלח כרטיס זה בוואטסאפ",
      };
    return formatWhatsAppCardShareText(wa, page?.businessName);
  }

  if (!plat) {
    let t = `${post.headline}\n\n${post.body}`;
    if (ch === "instagram" && post.hashtags?.length) {
      t += `\n\n${post.hashtags.join(" ")}`;
    }
    if (post.call_to_action) t += `\n\n${post.call_to_action}`;
    return t;
  }

  let text = plat.text;
  if (ch === "instagram" && plat.hashtags?.length) {
    text += `\n\n${plat.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;
  }
  if (plat.cta) text += `\n\n${plat.cta}`;
  if (ch === "google") {
    if (plat.city_or_neighborhood) {
      text = `${plat.city_or_neighborhood}\n${text}`;
    }
    if (plat.offer) text += `\n${plat.offer}`;
  }
  return text;
}

export function whatsappCardShareHref(
  post: SocialPostFields,
  platforms: PlatformPosts | null | undefined,
  page?: ResolvedMyPage | null
): string {
  const text = formatChannelShareText(post, platforms, "whatsapp", page);
  return buildWhatsAppCardShareUrl(text);
}

export {
  buildWhatsAppCardShareUrl,
  formatWhatsAppCardShareText,
};
