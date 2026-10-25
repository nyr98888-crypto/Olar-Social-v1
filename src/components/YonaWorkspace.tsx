"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader, type ConnectionState } from "@/components/AppHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { SocialPreview } from "@/components/SocialPreview";
import { useYonaVoice } from "@/hooks/useYonaVoice";
import type { LiveStatus, SocialPost, UiMessage } from "@/lib/types/ui";
import { DEFAULT_CHAT_ERROR_HE } from "@/lib/types/ui";
import {
  CLIENT_CHAT_TIMEOUT_MS,
  CLIENT_IMAGE_TIMEOUT_MS,
  fetchJsonWithRetry,
  isAbortError,
} from "@/lib/api/fetch-with-retry";

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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  /** Preview spinner only — never locks the chat composer. */
  const [imageLoading, setImageLoading] = useState(false);

  const showError = (message?: string) => {
    const he = message?.trim() || DEFAULT_CHAT_ERROR_HE;
    setToast(he);
    setStatus("error");
    setImageLoading(false);
    setStreamingMessageId(null);
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
    if (imageLoading || status === "generating") setMobileTab("preview");
  }, [imageLoading, status]);

  const clearLocalSession = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setStatus("idle");
    setImageLoading(false);
    setFiles([]);
    setPreviews([]);
    setActivePost(null);
    setImageUrl(null);
    setImageSeed(null);
    setLastImagePrompt(null);
    setCopyDone(false);
    setStreamingMessageId(null);
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

  // Generating visuals must not disable mic / send (mobile «יונה חושבת» lock).
  const chatBusy =
    status === "thinking" ||
    status === "streaming" ||
    status === "analyzing";

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

  /** Follow-up FAL call after chat returns (deferred image). Never blocks composer. */
  const fetchDeferredImage = async (opts: {
    convId: string;
    prompt: string;
    aspectRatio?: "1:1" | "4:5" | "16:9";
  }) => {
    setImageLoading(true);
    try {
      const { res, data } = await fetchJsonWithRetry("/api/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: opts.convId,
          prompt: opts.prompt,
          aspectRatio: opts.aspectRatio,
          ...(guestMode ? { previousImagePrompt: lastImagePrompt } : {}),
        }),
        timeoutMs: CLIENT_IMAGE_TIMEOUT_MS,
      });
      if (!res.ok) {
        console.error("[image follow-up]", data.error || res.status);
        setToast(
          typeof data.error_he === "string"
            ? data.error_he
            : "יצירת התמונה נכשלה. נסי שוב."
        );
        window.setTimeout(() => setToast(null), 3500);
        return;
      }
      const image = data.image as
        | { url?: string; seed?: number; prompt?: string }
        | undefined;
      if (image?.url) {
        setImageUrl(image.url);
        setImageSeed(image.seed ?? null);
        if (image.prompt) setLastImagePrompt(image.prompt);
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message as UiMessage]);
      }
    } catch (e) {
      console.error("[image follow-up]", e);
      setToast(
        isAbortError(e)
          ? "הבקשה ארכה יותר מדי. נסי שוב."
          : "יצירת התמונה נכשלה. נסי שוב."
      );
      window.setTimeout(() => setToast(null), 3500);
    } finally {
      setImageLoading(false);
    }
  };

  /** Non-stream JSON fallback when SSE is unavailable (502 / cold start). */
  const sendChatJsonFallback = async (opts: {
    text: string;
    tempId: string;
    assistantStreamId: string;
    imageBase64Array?: string[];
    history?: { role: string; content: string }[];
  }) => {
    const { res, data } = await fetchJsonWithRetry("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: opts.text,
        imageBase64Array: opts.imageBase64Array,
        ...(guestMode
          ? {
              history: opts.history,
              previousImagePrompt: lastImagePrompt,
            }
          : {}),
      }),
      timeoutMs: CLIENT_CHAT_TIMEOUT_MS,
    });

    if (!res.ok) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== opts.assistantStreamId)
      );
      showError(
        typeof data.error_he === "string"
          ? data.error_he
          : DEFAULT_CHAT_ERROR_HE
      );
      return;
    }

    const convId =
      typeof data.conversationId === "string"
        ? data.conversationId
        : conversationId;
    if (convId) setConversationId(convId);

    const assistant = data.message as UiMessage;
    const output = data.output as
      | {
          social_post?: SocialPost | null;
          chat_reply?: string;
          image_task?: {
            generate_image?: boolean;
            prompt?: string;
            aspect_ratio?: "1:1" | "4:5" | "16:9";
          };
        }
      | undefined;

    setMessages((prev) => [
      ...prev.filter(
        (m) => m.id !== opts.tempId && m.id !== opts.assistantStreamId
      ),
      { id: `u-${opts.tempId}`, role: "user", content: opts.text },
      assistant,
    ]);
    setStreamingMessageId(null);
    setStatus("idle");

    if (output?.social_post) setActivePost(output.social_post);
    if (assistant?.image_url) {
      setImageUrl(assistant.image_url);
      setImageSeed(assistant.image_seed ?? null);
    }
    const pendingPrompt =
      assistant?.image_prompt ||
      output?.image_task?.prompt ||
      null;
    if (pendingPrompt) setLastImagePrompt(pendingPrompt);

    const reply =
      (typeof output?.chat_reply === "string" && output.chat_reply) ||
      assistant?.content ||
      "";
    if (reply) speakRef.current(reply);

    if (
      data.imagePending &&
      convId &&
      pendingPrompt &&
      !(data.image as { url?: string } | null)?.url
    ) {
      void fetchDeferredImage({
        convId,
        prompt: pendingPrompt,
        aspectRatio: output?.image_task?.aspect_ratio,
      });
    }
  };

  const onSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || chatBusy) return;

    stopSpeakingRef.current();

    const tempId = `local-${Date.now()}`;
    const assistantStreamId = `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text },
      { id: assistantStreamId, role: "assistant", content: "" },
    ]);
    setStreamingMessageId(assistantStreamId);
    setInput("");
    setToast(null);
    setStatus(files.length ? "analyzing" : "thinking");

    let imageBase64Array: string[] | undefined;
    let gotTokens = false;
    let finalReply = "";
    const history = guestMode
      ? messages
          .filter((m) => m.id !== tempId)
          .map((m) => ({ role: m.role, content: m.content }))
      : undefined;

    try {
      imageBase64Array =
        files.length > 0
          ? await Promise.all(files.map(fileToBase64))
          : undefined;

      if (files.length) setStatus("analyzing");

      const payload = {
        conversationId,
        message: text,
        imageBase64Array,
        ...(guestMode
          ? { history, previousImagePrompt: lastImagePrompt }
          : {}),
      };

      let res: Response;
      try {
        res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(CLIENT_CHAT_TIMEOUT_MS),
        });
      } catch (streamOpenErr) {
        console.warn("[chat] stream open failed → JSON fallback", streamOpenErr);
        await sendChatJsonFallback({
          text,
          tempId,
          assistantStreamId,
          imageBase64Array,
          history,
        });
        setFiles([]);
        setPreviews([]);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      const gatewayFail =
        !res.ok && (res.status === 502 || res.status === 503 || res.status === 504);
      const notSse = res.ok && res.body && !ct.includes("text/event-stream");

      if (gatewayFail || notSse || (res.ok && !res.body)) {
        console.warn("[chat] stream unavailable", res.status, "→ JSON fallback");
        await sendChatJsonFallback({
          text,
          tempId,
          assistantStreamId,
          imageBase64Array,
          history,
        });
        setFiles([]);
        setPreviews([]);
        return;
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        console.error("[chat/stream]", data.error || res.status);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantStreamId)
        );
        setStreamingMessageId(null);
        showError(
          typeof data.error_he === "string"
            ? data.error_he
            : res.status === 502 || res.status === 504
              ? "השרת מתעורר או זמנית לא זמין. נסי שוב בעוד כמה שניות."
              : DEFAULT_CHAT_ERROR_HE
        );
        return;
      }

      setFiles([]);
      setPreviews([]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;
      let pendingImage = false;
      let pendingPrompt: string | null = null;
      let pendingAspect: "1:1" | "4:5" | "16:9" | undefined;
      let doneConvId: string | null = conversationId;

      const handleSseEvent = (eventName: string, rawData: string) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(rawData) as Record<string, unknown>;
        } catch {
          return;
        }

        switch (eventName) {
          case "meta": {
            if (typeof data.conversationId === "string") {
              setConversationId(data.conversationId);
              doneConvId = data.conversationId;
            }
            break;
          }
          case "status": {
            const s = data.status;
            if (s === "analyzing" || s === "thinking" || s === "streaming") {
              setStatus(s);
            } else if (s === "generating") {
              setImageLoading(true);
              // Unlock composer — image must not freeze chat on mobile
              setStatus("idle");
            }
            break;
          }
          case "token": {
            const delta = typeof data.text === "string" ? data.text : "";
            if (!delta) break;
            gotTokens = true;
            finalReply += delta;
            setStatus("streaming");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantStreamId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
            break;
          }
          case "reply_fix": {
            const next = typeof data.text === "string" ? data.text : "";
            if (!next) break;
            finalReply = next;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantStreamId ? { ...m, content: next } : m
              )
            );
            break;
          }
          case "output": {
            const output = data.output as
              | {
                  social_post?: SocialPost | null;
                  chat_reply?: string;
                  image_task?: {
                    generate_image?: boolean;
                    prompt?: string;
                    aspect_ratio?: "1:1" | "4:5" | "16:9";
                  };
                  intent?: string;
                }
              | undefined;
            if (output?.social_post) setActivePost(output.social_post);
            if (typeof output?.chat_reply === "string" && output.chat_reply) {
              finalReply = output.chat_reply;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantStreamId
                    ? {
                        ...m,
                        content: output.chat_reply!,
                        intent: output.intent ?? m.intent,
                        social_post: output.social_post ?? m.social_post,
                      }
                    : m
                )
              );
            }
            if (output?.image_task?.generate_image && output.image_task.prompt) {
              pendingImage = true;
              pendingPrompt = output.image_task.prompt;
              pendingAspect = output.image_task.aspect_ratio;
              setLastImagePrompt(output.image_task.prompt);
              setImageLoading(true);
              setStatus("idle");
            }
            break;
          }
          case "image": {
            const image = data.image as
              | { url?: string; seed?: number; prompt?: string }
              | undefined;
            if (image?.url) {
              pendingImage = false;
              setImageLoading(false);
              setImageUrl(image.url);
              setImageSeed(image.seed ?? null);
              if (image.prompt) setLastImagePrompt(image.prompt);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantStreamId
                    ? {
                        ...m,
                        image_url: image.url,
                        image_seed: image.seed ?? null,
                        image_prompt: image.prompt ?? null,
                      }
                    : m
                )
              );
            }
            break;
          }
          case "message": {
            const assistant = data.message as UiMessage | undefined;
            if (!assistant) break;
            finalReply = assistant.content || finalReply;
            setMessages((prev) => [
              ...prev.filter(
                (m) => m.id !== tempId && m.id !== assistantStreamId
              ),
              { id: `u-${tempId}`, role: "user", content: text },
              {
                ...assistant,
                role: "assistant",
                id: assistant.id || assistantStreamId,
              },
            ]);
            setStreamingMessageId(null);
            if (assistant.social_post) setActivePost(assistant.social_post);
            if (assistant.image_url) {
              pendingImage = false;
              setImageLoading(false);
              setImageUrl(assistant.image_url);
              setImageSeed(assistant.image_seed ?? null);
            }
            if (assistant.image_prompt) {
              pendingPrompt = assistant.image_prompt;
              setLastImagePrompt(assistant.image_prompt);
            }
            break;
          }
          case "done": {
            if (typeof data.conversationId === "string") {
              setConversationId(data.conversationId);
              doneConvId = data.conversationId;
            }
            if (data.imagePending) pendingImage = true;
            setStreamingMessageId(null);
            setStatus("idle");
            break;
          }
          case "error": {
            sawError = true;
            setStreamingMessageId(null);
            setImageLoading(false);
            setMessages((prev) =>
              prev.filter((m) => m.id !== assistantStreamId || m.content)
            );
            showError(
              typeof data.error_he === "string"
                ? data.error_he
                : DEFAULT_CHAT_ERROR_HE
            );
            break;
          }
          default:
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length) {
            handleSseEvent(eventName, dataLines.join("\n"));
          }
        }
      }

      setStreamingMessageId(null);
      if (!sawError) {
        setStatus("idle");
        if (finalReply) speakRef.current(finalReply);
        if (pendingImage && pendingPrompt && doneConvId) {
          void fetchDeferredImage({
            convId: doneConvId,
            prompt: pendingPrompt,
            aspectRatio: pendingAspect,
          });
        } else {
          setImageLoading(false);
        }
      }
    } catch (e) {
      console.error("[chat/stream]", e);
      setStreamingMessageId(null);

      // Tokens already shown — unlock UI; do not re-POST (avoids duplicate DB rows).
      if (gotTokens) {
        setStatus("idle");
        setImageLoading(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantStreamId
              ? { ...m, id: `a-${tempId}` }
              : m.id === tempId
                ? { ...m, id: `u-${tempId}` }
                : m
          )
        );
        if (finalReply) speakRef.current(finalReply);
        return;
      }

      try {
        await sendChatJsonFallback({
          text,
          tempId,
          assistantStreamId,
          imageBase64Array,
          history,
        });
        setFiles([]);
        setPreviews([]);
      } catch (fallbackErr) {
        console.error("[chat] JSON fallback failed", fallbackErr);
        setImageLoading(false);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantStreamId || m.content)
        );
        showError(
          isAbortError(e) || isAbortError(fallbackErr)
            ? "הבקשה ארכה יותר מדי. נסי שוב."
            : DEFAULT_CHAT_ERROR_HE
        );
      }
    }
  };

  onSendRef.current = onSend;

  const onRegenerate = async () => {
    if (!conversationId || !lastImagePrompt || imageLoading) return;
    setToast(null);
    setImageLoading(true);
    try {
      const { res, data } = await fetchJsonWithRetry("/api/regenerate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          prompt: lastImagePrompt,
          ...(guestMode ? { previousImagePrompt: lastImagePrompt } : {}),
        }),
        timeoutMs: CLIENT_IMAGE_TIMEOUT_MS,
      });
      if (!res.ok) {
        console.error("[regen]", data.error || res.status);
        showError(
          typeof data.error_he === "string"
            ? data.error_he
            : "יצירת התמונה נכשלה. נסי שוב."
        );
        return;
      }
      const image = data.image as {
        url: string;
        seed: number;
        prompt: string;
      };
      setImageUrl(image.url);
      setImageSeed(image.seed);
      setLastImagePrompt(image.prompt);
      if (data.message) {
        setMessages((prev) => [...prev, data.message as UiMessage]);
      }
      setStatus("idle");
    } catch (e) {
      console.error("[regen]", e);
      showError(
        isAbortError(e)
          ? "הבקשה ארכה יותר מדי. נסי שוב."
          : "יצירת התמונה נכשלה. נסי שוב."
      );
    } finally {
      setImageLoading(false);
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
    () => imageLoading || status === "analyzing" || status === "generating",
    [imageLoading, status]
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
            streamingMessageId={streamingMessageId}
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
              Boolean(conversationId && lastImagePrompt) &&
              status === "idle" &&
              !imageLoading
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
