"use client";

import { useEffect, useRef } from "react";
import type { LiveStatus, UiMessage } from "@/lib/types/ui";
import { STATUS_LABELS } from "@/lib/types/ui";

interface ChatPanelProps {
  messages: UiMessage[];
  status: LiveStatus;
  /** Optional Hebrew toast overriding STATUS_LABELS.error */
  statusMessage?: string | null;
  /** Assistant bubble id currently receiving streamed tokens */
  streamingMessageId?: string | null;
  input: string;
  previews: string[];
  onInputChange: (v: string) => void;
  onPickImages: (files: FileList | null) => void;
  onRemovePreview: (index: number) => void;
  onSend: () => void;
  /** Voice: listening / mic / mute */
  listening?: boolean;
  interimTranscript?: string;
  voiceMuted?: boolean;
  onToggleMic?: () => void;
  onToggleMute?: () => void;
}

export function ChatPanel({
  messages,
  status,
  statusMessage,
  streamingMessageId = null,
  input,
  previews,
  onInputChange,
  onPickImages,
  onRemovePreview,
  onSend,
  listening = false,
  interimTranscript = "",
  voiceMuted = false,
  onToggleMic,
  onToggleMute,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // Image generation must not lock the composer (mobile reliability).
  const busy =
    status === "thinking" ||
    status === "streaming" ||
    status === "analyzing";
  const showStatusRow =
    status === "error" ||
    (status !== "idle" &&
      status !== "streaming" &&
      status !== "generating" &&
      Boolean(STATUS_LABELS[status]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const displayValue = listening && interimTranscript ? interimTranscript : input;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col border-line bg-panel/90 backdrop-blur-sm md:border-l">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-ink-soft">שיחה עם יונה</p>
          <p className="mt-0.5 text-sm text-ink">עברית · עד 2 תמונות רפרנס</p>
        </div>
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:border-accent hover:text-accent active:bg-paper-deep"
            aria-label={voiceMuted ? "הפעלת קול יונה" : "השתקת קול יונה"}
            title={voiceMuted ? "קול כבוי" : "קול פועל"}
          >
            {voiceMuted ? <MuteIcon /> : <SpeakerIcon />}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
        {messages.length === 0 && (
          <div className="animate-rise rounded-2xl bg-paper-deep/60 px-4 py-5 text-sm leading-relaxed text-ink-soft break-words">
            היי, אני יונה — מנהלת הסושיאל שלך. ספרי לי על המותג או בקשי קמפיין,
            ואכין לך פוסט + ויז&apos;ואל חי בצד. אפשר גם להעלות עד 2 תמונות רפרנס,
            או ללחוץ על המיקרופון ולדבר.
          </div>
        )}
        {messages.map((m) => {
          const isStreaming =
            m.role === "assistant" &&
            streamingMessageId === m.id &&
            (status === "streaming" || status === "thinking");
          return (
            <div
              key={m.id}
              className={`animate-rise flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[min(85%,28rem)] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:px-4 sm:py-3 ${
                  m.role === "user"
                    ? "bg-ink text-panel"
                    : "border border-line bg-paper text-ink"
                }`}
              >
                {m.content}
                {isStreaming && (
                  <span className="stream-caret" aria-hidden />
                )}
              </div>
            </div>
          );
        })}
        {showStatusRow && (
          <div
            className={`flex items-center gap-2 text-sm ${
              status === "error" ? "text-red-700" : "text-accent"
            }`}
            role={status === "error" ? "alert" : undefined}
          >
            <span
              className={`status-dot inline-block h-2 w-2 shrink-0 rounded-full ${
                status === "error" ? "bg-red-600" : "bg-accent"
              }`}
            />
            <span className="min-w-0 break-words">
              {status === "error" && statusMessage
                ? statusMessage
                : STATUS_LABELS[status]}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="shrink-0 border-t border-line p-3 sm:p-4">
        {listening && (
          <p
            className="mb-2 text-center text-xs font-medium text-accent"
            aria-live="polite"
          >
            מקשיבה...
          </p>
        )}
        {previews.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {previews.map((src, i) => (
              <div key={src} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover ring-1 ring-line"
                />
                <button
                  type="button"
                  onClick={() => onRemovePreview(i)}
                  className="absolute -left-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm leading-none text-panel"
                  aria-label="הסר תמונה"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line text-ink-soft transition hover:border-accent hover:text-accent active:bg-paper-deep">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickImages(e.target.files)}
              disabled={busy || listening}
            />
            <PaperclipIcon />
          </label>
          {onToggleMic && (
            <button
              type="button"
              onClick={onToggleMic}
              disabled={busy && !listening}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:border-accent hover:text-accent active:bg-paper-deep disabled:opacity-50 ${
                listening ? "mic-listening" : ""
              }`}
              aria-label={listening ? "עצירת האזנה" : "דיבור ליונה"}
              aria-pressed={listening}
            >
              <MicIcon />
            </button>
          )}
          <textarea
            value={displayValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && !listening) onSend();
              }
            }}
            rows={2}
            placeholder={listening ? "מקשיבה..." : "כתבי ליונה..."}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-3 text-base outline-none transition focus:border-accent sm:px-4 sm:py-2.5 sm:text-sm"
            disabled={busy || listening}
            readOnly={listening}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={busy || listening || !input.trim()}
            className="h-12 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-panel transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 sm:px-5"
          >
            שליחה
          </button>
        </div>
      </footer>
    </section>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5V17a5 5 0 0 1-10 0V7a3 3 0 1 1 6 0v9.5a1.5 1.5 0 0 1-3 0V8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3.5L12 18V6L7.5 10H4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3.5L12 18V6L7.5 10H4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16 10l5 5M21 10l-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
