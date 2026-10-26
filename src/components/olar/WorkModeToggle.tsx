"use client";

import type { WorkMode } from "@/lib/olar/work-mode";
import { C } from "@/lib/olar/ui-copy";
import { ClipboardList, Zap } from "lucide-react";

export function WorkModeToggle({
  mode,
  onChange,
}: {
  mode: WorkMode;
  onChange: (m: WorkMode) => void;
}) {
  return (
    <div
      className="inline-flex max-w-[min(100%,22rem)] shrink items-center gap-0.5 rounded-xl border border-slate-800 bg-slate-900/90 p-1 sm:max-w-none"
      role="group"
      aria-label={C.workModeAria}
    >
      <button
        type="button"
        title={C.workModeQuick}
        onClick={() => onChange("quick")}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition sm:px-4 sm:text-base ${
          mode === "quick"
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold text-white shadow-md shadow-cyan-500/20"
            : "text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={mode === "quick"}
      >
        <Zap className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{C.workModeQuick}</span>
      </button>
      <button
        type="button"
        title={C.workModeFull}
        onClick={() => onChange("full")}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition sm:px-4 sm:text-base ${
          mode === "full"
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold text-white shadow-md shadow-cyan-500/20"
            : "text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={mode === "full"}
      >
        <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden truncate sm:inline">{C.workModeFull}</span>
        <span className="sm:hidden">{C.workModeFullShort}</span>
      </button>
    </div>
  );
}
