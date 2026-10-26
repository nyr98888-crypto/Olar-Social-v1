/** Strip leaked `[CATEGORY:...]` tokens from model / merge text (server + client safe). */
export function stripCategoryLeak(text: string): string {
  if (!text) return text;
  return text
    .replace(/\n*\s*\[CATEGORY:[^\]]*\][^\n]*/gi, "")
    .replace(/\n*\s*CATEGORY\s*:\s*\w+[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
