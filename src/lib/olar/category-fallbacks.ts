/**
 * Category image fallbacks — Unsplash static stock REMOVED (Phase 2).
 * Dual Image Engine (FAL + Together) is the only image source.
 * These helpers remain for API compatibility with callers but never
 * return stock photography URLs.
 */
import type { BusinessCategoryId } from "./business-categories";

/** @deprecated Always empty — Unsplash stock deleted. */
export function getCategoryFallbackList(
  _category?: string | null,
  _userText?: string | null
): string[] {
  return [];
}

export function fallbackBaseUrl(url: string): string {
  return url.split("?")[0] || url;
}

/**
 * @deprecated Always empty string — no Unsplash / office-door / croissant stock.
 */
export function getDistinctCategoryFallback(
  _category: string | null | undefined,
  _userText: string | null | undefined,
  _seed: number,
  _avoidUrl?: string | null
): string {
  return "";
}

/**
 * @deprecated Always empty string — callers must use live FAL/Together URLs.
 */
export function getCategoryFallback(
  _category?: string | null,
  _userText?: string | null,
  _seed?: number | null
): string {
  return "";
}

/** Kept so existing imports type-check; unused. */
export type _CategoryFallbackId = BusinessCategoryId;
