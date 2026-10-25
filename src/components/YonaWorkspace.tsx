"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader, type ConnectionState } from "@/components/AppHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { SocialPreview } from "@/components/SocialPreview";
import { useYonaVoice } from "@/hooks/useYonaVoice";
import type { LiveStatus, SocialPost, UiMessage } from "@/lib/types/ui";
import { DEFAULT_CHAT_ERROR_HE } from "@/lib/types/ui";

interface UserInfo {
  email?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
}

type MobileTab = "chat" | "preview";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

export function YonaWorkspace({
  user,
  guestMode = false,
}: {
  user: UserInfo;
  guestMode?: boolean;
}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [activePost, setActivePost] = useState<SocialPost | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSeed, setImageSeed] = useState<number | null>(null);
  const [lastImagePrompt, setLastImagePrompt] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [booting, setBooting] = useState(true);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const showError = (message?: string) => {
    const he = message?.trim() || DEFAULT_CHAT_ERROR_HE;
    setToast(he);
    setStatus("error");
    window.setTimeout(() => {
      setStatus("idle");
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    const sync = () => {
      setConnection(
        typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
      );
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversation");
        if (!res.ok) throw new Error("restore failed");
        const data = await res.json();
        if (cancelled) return;
        if (data.conversation) {
          setConversationId(data.conversation.id);
          if (data.conversation.last_image_prompt) {
            setLastImagePrompt(data.conversation.last_image_prompt);
          }
        }
        const list = (data.messages ?? []) as UiMessage[];
        setMessages(list);
        let post: SocialPost | null = null;
        let url: string | null = null;
        let seed: number | null = null;
        let prompt: string | null = data.conversation?.last_image_prompt ?? null;
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          if (!post && m.social_post) post = m.social_post;
          if (!url && m.image_url) {
            url = m.image_url;
            seed = m.image_seed ?? null;
            prompt = m.image_prompt ?? prompt;
          }
          if (post && url) break;
        }
        setActivePost(post);
        setImageUrl(url);
        setImageSeed(seed);
        if (prompt) setLastImagePrompt(prompt);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** On phones, jump to preview when image generation starts. */
  useEffect(() => {
    if (status === "generating") setMobileTab("preview");
  }, [status]);

  const clearLocalSession = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setStatus("idle");
    setFiles([]);
    setPreviews([]);
    setActivePost(null);
    setImageUrl(null);
    setImageSeed(null);
    setLastImagePrompt(null);
    setCopyDone(false);
    setMobileTab("chat");
  };

  const onPickImages = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 2);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const onRemovePreview = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const speakRef = useRef<(text: string) => void>(() => {});
  const stopSpeakingRef = useRef<() => void>(() => {});
  const onSendRef = useRef<(overrideText?: string) => Promise<void>>(
    async () => {}
  );

  const chatBusy = status !== "idle" && status !== "error";

  const {
    listening,
    interim,
    muted: voiceMuted,
    toggleListening,
    speak,
    stopSpeaking,
    toggleMute,
  } = useYonaVoice({
    disabled: chatBusy,
    onFinalTranscript: (text) => {
      setInput(text);
      void onSendRef.current(text);
    },
    onVoiceError: (messageHe) => showError(messageHe),
  });

  speakRef.current = speak;
  stopSpeakingRef.current = stopSpeaking;

  const onSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;

    stopSpeakingRef.current();

    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text },
    ]);
    setInput("");
    setToast(null);
    setStatus(files.length ? "analyzing" : "thinking");

    try {
      const imageBase64Array =
        files.length > 0
          ? await Promise.all(files.map(fileToBase64))
          : undefined;

      if (files.length) setStatus("analyzing");

      const history = guestMode
        ? messages
            .filter((m) => m.id !== tempId)
            .map((m) => ({ role: m.role, content: m.content }))
        : undefined;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
          imageBase64Array,
          ...(guestMode
            ? { history, previousImagePrompt: lastImagePrompt }
            : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[chat]", data.error || res.status);
        showError(
          typeof data.error_he === "string"
            ? data.error_he
            : DEFAULT_CHAT_ERROR_HE
        );
        return;
      }

      if (data.output?.image_task?.generate_image) {
        setStatus("generating");
      }

      setConversationId(data.conversationId);
      setFiles([]);
      setPreviews([]);

      const assistant = data.message as UiMessage;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { id: `u-${tempId}`, role: "user", content: text },
        assistant,
      ]);

      if (data.output?.social_post) {
        setActivePost(data.output.social_post);
      }
      if (data.image?.url) {
        setImageUrl(data.image.url);
        setImageSeed(data.image.seed);
        setLastImagePrompt(data.image.prompt);
      }
      setStatus("idle");

      const reply =
        (typeof data.output?.chat_reply === "string" && data.output.chat_reply) ||
        assistant?.content ||
        "";
      if (reply) speakRef.current(reply);
    } catch (e) {
      console.error("[chat]", e);
      showError(DEFAULT_CHAT_ERROR_HE);
    }
  };

  onSendRef.current = onSend;

  const onRegenerate = async () => {
    if (!conversationId || !lastImagePrompt) return;
    setToast(null);
    setStatus("generating");
    try {
      const res = await fetch("/api/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          ...(guestMode ? { previousImagePrompt: lastImagePrompt } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[regen]", data.error || res.status);
        showError(
          typeof data.error_he === "string"
            ? data.error_he
            : "יצירת התמונה נכשלה. נסי שוב."
        );
        return;
      }
      setImageUrl(data.image.url);
      setImageSeed(data.image.seed);
      setLastImagePrompt(data.image.prompt);
      if (data.message) {
        setMessages((prev) => [...prev, data.message as UiMessage]);
      }
      setStatus("idle");
    } catch (e) {
      console.error("[regen]", e);
      showError("יצירת התמונה נכשלה. נסי שוב.");
    }
  };

  const onCopy = async () => {
    if (!activePost) return;
    const tags = activePost.hashtags
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .join(" ");
    const text = `${activePost.headline}\n\n${activePost.body}\n\n${tags}`;
    await navigator.clipboard.writeText(text);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1600);
  };

  /** Wipe DB conversations + local UI → clean first-visit while staying logged in. */
  const onResetSession = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/session/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "reset failed");
      clearLocalSession();
    } catch (e) {
      console.error(e);
      clearLocalSession();
    } finally {
      setResetting(false);
    }
  };

  const onLogout = async () => {
    clearLocalSession();
    if (guestMode) {
      await fetch("/api/guest", { method: "DELETE" });
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    window.location.href = "/login";
  };

  const waitingVisual = useMemo(
    () => status === "generating" || status === "analyzing",
    [status]
  );

  const previewReady = Boolean(activePost || imageUrl);

  if (booting) {
    return (
      <div className="flex h-dvh items-center justify-center px-4 text-sm text-ink-soft">
        {guestMode ? "טוענת מצב אורח..." : "משחזרת את השיחה האחרונה..."}
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <AppHeader
        user={user}
        connection={connection}
        resetting={resetting}
        guestMode={guestMode}
        onResetSession={onResetSession}
        onLogout={onLogout}
      />

      {/* Desktop: RTL split. Mobile: one full panel via bottom tabs. */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div
          className={`min-h-0 min-w-0 ${
            mobileTab === "chat" ? "flex h-full flex-col" : "hidden"
          } md:flex md:h-full md:flex-col`}
        >
          <ChatPanel
            messages={messages}
            status={status}
            statusMessage={toast}
            input={input}
            previews={previews}
            onInputChange={setInput}
            onPickImages={onPickImages}
            onRemovePreview={onRemovePreview}
            onSend={() => void onSend()}
            listening={listening}
            interimTranscript={interim}
            voiceMuted={voiceMuted}
            onToggleMic={toggleListening}
            onToggleMute={toggleMute}
          />
        </div>
        <div
          className={`min-h-0 min-w-0 ${
            mobileTab === "preview" ? "flex h-full flex-col" : "hidden"
          } md:flex md:h-full md:flex-col`}
        >
          <SocialPreview
            post={activePost}
            imageUrl={imageUrl}
            imageSeed={imageSeed}
            waitingVisual={waitingVisual}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            canRegenerate={
              Boolean(conversationId && lastImagePrompt) && status === "idle"
            }
            copyDone={copyDone}
          />
        </div>
      </div>

      <nav
        className="safe-bottom flex shrink-0 border-t border-line bg-panel/95 backdrop-blur-sm md:hidden"
        aria-label="ניווט מובייל"
      >
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition ${
            mobileTab === "chat" ? "text-accent" : "text-ink-soft"
          }`}
          aria-current={mobileTab === "chat" ? "page" : undefined}
        >
          <ChatTabIcon active={mobileTab === "chat"} />
          צ&apos;אט
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition ${
            mobileTab === "preview" ? "text-accent" : "text-ink-soft"
          }`}
          aria-current={mobileTab === "preview" ? "page" : undefined}
        >
          <PreviewTabIcon active={mobileTab === "preview"} />
          תצוגה
          {previewReady && mobileTab !== "preview" && (
            <span
              className="absolute end-1/4 top-2 h-1.5 w-1.5 rounded-full bg-accent"
              aria-hidden
            />
          )}
        </button>
      </nav>
    </div>
  );
}

function ChatTabIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={active ? "text-accent" : "text-ink-soft"}
    >
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PreviewTabIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={active ? "text-accent" : "text-ink-soft"}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 15.5 8.5 11l3 3 3.5-4.5L20 15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
