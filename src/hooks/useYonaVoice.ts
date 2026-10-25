"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "@/lib/speech-types";

const MUTE_KEY = "yona-voice-muted";
const LOCALE = "he-IL";

export type VoiceErrorKind =
  | "unsupported"
  | "permission-denied"
  | "no-speech"
  | "other";

const ERROR_HE: Record<VoiceErrorKind, string> = {
  unsupported: "הדפדפן לא תומך בהכתבה",
  "permission-denied": "אין הרשאה למיקרופון. אפשר לאשר בהגדרות הדפדפן.",
  "no-speech": "לא שמעתי כלום — נסי שוב.",
  other: "ההכתבה נכשלה. נסי שוב.",
};

export function useYonaVoice(opts: {
  onFinalTranscript: (text: string) => void;
  onVoiceError?: (messageHe: string) => void;
  /** When true, mic start is blocked (e.g. chat is busy). */
  disabled?: boolean;
}) {
  const { onFinalTranscript, onVoiceError, disabled = false } = opts;
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onVoiceError);
  onFinalRef.current = onFinalTranscript;
  onErrorRef.current = onVoiceError;

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startListening = useCallback(() => {
    if (disabled) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      onErrorRef.current?.(ERROR_HE.unsupported);
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = LOCALE;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setInterim("");
    };

    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      if (interimText) setInterim(interimText.trim());
      const trimmed = finalText.trim();
      if (trimmed) {
        setInterim("");
        onFinalRef.current(trimmed);
      }
    };

    rec.onerror = (event) => {
      const code = event.error;
      if (code === "aborted") return;
      let kind: VoiceErrorKind = "other";
      if (code === "not-allowed" || code === "service-not-allowed") {
        kind = "permission-denied";
      } else if (code === "no-speech") {
        kind = "no-speech";
      }
      onErrorRef.current?.(ERROR_HE[kind]);
      setListening(false);
      setInterim("");
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    try {
      rec.start();
    } catch {
      onErrorRef.current?.(ERROR_HE.other);
      setListening(false);
    }
  }, [disabled]);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  const speak = useCallback(
    (text: string) => {
      if (muted || !text.trim()) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.lang = LOCALE;

      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const he =
          voices.find((v) => v.lang === LOCALE) ||
          voices.find((v) => v.lang.toLowerCase().startsWith("he"));
        if (he) utter.voice = he;
      };
      pickVoice();
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          pickVoice();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    },
    [muted]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (disabled && listening) stopListening();
  }, [disabled, listening, stopListening]);

  return {
    supported,
    listening,
    interim,
    muted,
    toggleListening,
    speak,
    stopSpeaking,
    toggleMute,
  };
}
