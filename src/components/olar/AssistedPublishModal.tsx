"use client";

import { X } from "lucide-react";
import { C } from "@/lib/olar/ui-copy";
import type { SocialPlatform } from "@/lib/olar/social-accounts";

export function AssistedPublishModal({
  open,
  platform,
  onClose,
  clipboardOk,
  downloadOk,
  imageOpenedInTab,
}: {
  open: boolean;
  platform: SocialPlatform | null;
  onClose: () => void;
  clipboardOk?: boolean;
  downloadOk?: boolean;
  imageOpenedInTab?: boolean;
}) {
  if (!open || !platform) return null;

  const platformLabel =
    platform === "instagram" ? "אינסטגרם" : "פייסבוק";

  const step2 =
    downloadOk !== false && !imageOpenedInTab
      ? C.assistedStep2 || "התמונה ירדה זה עתה למכשיר"
      : imageOpenedInTab
        ? C.assistedStep2Tab ||
          "נפתחה לשונית עם התמונה — שמרו אותה למכשיר (לחיצה ארוכה / Save image)"
        : C.assistedStep2Fail ||
          "אם התמונה לא ירדה — שמרו אותה ידנית מתצוגת הפוסט";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assisted-publish-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 text-right shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
            aria-label={C.close}
          >
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2
              id="assisted-publish-title"
              className="text-lg font-bold text-slate-950"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {C.assistedTitle || `פרסום ב${platformLabel} — 3 קליקים`}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {C.assistedSubtitle || "כמעט שם — השלימו בעמוד שנפתח"}
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          <li className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
              1
            </span>
            <p className="min-w-0 flex-1 pt-1 text-sm font-medium text-slate-900">
              {clipboardOk === false
                ? C.assistedStep1Fail ||
                  "העתקת הטקסט נכשלה — העתיקו ידנית מהפוסט"
                : C.assistedStep1 || "הטקסט הועתק ללוח שלך"}
            </p>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
              2
            </span>
            <p className="min-w-0 flex-1 pt-1 text-sm font-medium text-slate-900">
              {step2}
            </p>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">
              3
            </span>
            <p className="min-w-0 flex-1 pt-1 text-sm font-medium text-slate-900">
              {C.assistedStep3 ||
                "בעמוד שנפתח — לחץ הדבק (Ctrl+V) ובחר את התמונה שהורדת"}
            </p>
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
        >
          {C.close}
        </button>
      </div>
    </div>
  );
}
