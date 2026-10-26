"use client";

import type { SocialPost } from "@/lib/types/ui";

interface SocialPreviewProps {
  post: SocialPost | null;
  imageUrl: string | null;
  imageSeed: number | null;
  waitingVisual: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
  copyDone: boolean;
}

export function SocialPreview({
  post,
  imageUrl,
  imageSeed,
  waitingVisual,
  onCopy,
  onRegenerate,
  canRegenerate,
  copyDone,
}: SocialPreviewProps) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden px-4 py-4 sm:px-5 sm:py-5 md:px-8">
      <div className="mb-3 flex shrink-0 flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-soft">Live Social Preview</p>
          <h2
            className="mt-1 text-2xl text-ink sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            תצוגת פוסט
          </h2>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onCopy}
            disabled={!post}
            className="min-h-11 flex-1 rounded-xl border border-line bg-panel px-3 py-2.5 text-xs transition hover:border-accent active:bg-paper-deep disabled:opacity-40 sm:flex-none sm:min-h-0 sm:py-2"
          >
            {copyDone ? "הועתק ✓" : "העתק תוכן"}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={!canRegenerate}
            className="min-h-11 flex-1 rounded-xl bg-ink px-3 py-2.5 text-xs text-panel transition hover:bg-ink-soft active:scale-[0.98] disabled:opacity-40 sm:flex-none sm:min-h-0 sm:py-2"
          >
            <span className="sm:hidden">גרסה נוספת</span>
            <span className="hidden sm:inline">צור גרסה נוספת לתמונה</span>
          </button>
        </div>
      </div>

      <article className="animate-rise mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-panel shadow-[var(--shadow)] sm:rounded-[28px]">
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            י
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">יונה · מותג</div>
            <div className="text-[11px] text-ink-soft">עכשיו · Sponsored</div>
          </div>
        </div>

        <div className="relative aspect-square w-full shrink-0 bg-paper-deep">
          {waitingVisual && !imageUrl ? (
            <div className="media-shimmer absolute inset-0" />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="נוצר ע״י יונה"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-ink-soft sm:px-8">
              <span
                className="text-4xl text-line"
                style={{ fontFamily: "var(--font-display)" }}
              >
                ◌
              </span>
              הוויז&apos;ואל יופיע כאן אחרי בקשת קמפיין
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
          {post ? (
            <>
              <h3
                className="break-words text-lg leading-snug text-ink sm:text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {post.headline}
              </h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                {post.body}
              </p>
              {post.call_to_action ? (
                <p className="break-words text-sm font-medium text-ink">
                  {post.call_to_action}
                </p>
              ) : null}
              <p className="break-words text-sm text-accent">
                {post.hashtags
                  .map((t) => (t.startsWith("#") ? t : `#${t}`))
                  .join(" ")}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              עדיין אין פוסט פעיל. בקשי מיונה קמפיין או רענון לתוכן.
            </p>
          )}
          {imageSeed != null && (
            <p className="mt-auto pt-2 text-[10px] text-ink-soft/70">
              seed: {imageSeed}
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
