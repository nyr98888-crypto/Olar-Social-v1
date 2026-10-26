import type { OlarView, TickerItem } from "./types";

/**
 * Map ticker items to views by id / tone / Hebrew keywords.
 * waiting / leads; no-post / yona; story / analytics
 */
export function resolveTickerNav(item: TickerItem): OlarView | null {
  const text = item.text;
  const waitingRe = new RegExp(
    "\u05de\u05d7\u05db\u05d9\u05dd|\u05ea\u05e9\u05d5\u05d1\u05d4"
  );
  const storyRe = new RegExp("\u05e1\u05d8\u05d5\u05e8\u05d9|story", "i");
  const noPostRe = new RegExp(
    "\u05dc\u05d0 \u05d4\u05e2\u05dc\u05d9\u05ea\u05dd|\u05d1\u05dc\u05d9 \u05e4\u05d5\u05e1\u05d8|\u05db\u05d3\u05d0\u05d9 \u05dc\u05e4\u05e8\u05e1\u05dd"
  );
  const postRe = new RegExp("\u05e4\u05d5\u05e1\u05d8");

  if (waitingRe.test(text)) return "leads";
  if (storyRe.test(text)) return "analytics";
  if (noPostRe.test(text)) return "yona";

  if (item.id === "5") return "leads";
  if (item.id === "6") return "analytics";
  if (item.id === "2" || (item.tone === "warn" && postRe.test(text))) {
    return "yona";
  }
  return null;
}
