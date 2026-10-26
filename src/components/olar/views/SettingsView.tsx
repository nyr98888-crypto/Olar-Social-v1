"use client";

import { useMemo, useState } from "react";
import type { AccountKind, IntegrationId } from "@/lib/olar/types";
import {
  NETWORK_PRIORITY,
  useConnections,
  type ConnEntry,
} from "@/lib/olar/connections";
import { useResolvedMyPage } from "@/lib/olar/business-profile";
import { signInWithGoogle } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph, BRAND } from "../NetworkBrand";
import { Check, Copy, Link2, Unlink, X } from "lucide-react";

type Meta = {
  title: string;
  tag: string;
  desc: string;
  cta?: string;
  primary?: boolean;
};

function metaFor(id: IntegrationId): Meta {
  switch (id) {
    case "google":
      return {
        title: C.googleBizTitle,
        tag: C.tagFullAuto,
        desc: C.descGoogleBiz,
        cta: C.ctaGoogleConnect,
        primary: true,
      };
    case "whatsapp":
      return {
        title: C.waBizTitle,
        tag: C.tagMainChannel,
        desc: C.descWaBiz,
        primary: true,
      };
    case "facebook":
    case "instagram":
      return {
        title: BRAND[id].label,
        tag: C.tagBizPage,
        desc: C.descFbIgBiz,
        primary: true,
      };
    case "easy":
      return {
        title: C.easyTitle,
        tag: C.tagReviews,
        desc: C.descEasy,
        primary: true,
      };
    case "tiktok":
      return {
        title: C.tiktokTitle,
        tag: C.tagShortVideo,
        desc: C.descTiktok,
        primary: true,
      };
    default:
      return {
        title: BRAND[id].label,
        tag: C.otherNetworks,
        desc: C.networksSub,
      };
  }
}

export function SettingsView() {
  const { page } = useResolvedMyPage();
  const { networks, update, isGuest } = useConnections();
  const [modalId, setModalId] = useState<IntegrationId | null>(null);
  const [kind, setKind] = useState<AccountKind>("business");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [copiedWa, setCopiedWa] = useState(false);

  const ordered = useMemo(() => NETWORK_PRIORITY, []);

  function openConnect(id: IntegrationId) {
    if (isGuest) {
      // Guests cannot fake-connect — start real Google OAuth
      void signInWithGoogle("/");
      return;
    }
    const cur = networks[id];
    setModalId(id);
    setKind(cur.kind === "personal" ? "personal" : "business");
    setUsername(cur.handle.replace(/^@/, ""));
    setPhone(cur.phone || "");
    setPageUrl(cur.pageUrl || "");
  }

  function confirmConnect() {
    if (!modalId || isGuest) return;
    const patch: Partial<ConnEntry> = {
      connected: true,
      handle: username ? `@${username.replace(/^@/, "")}` : "",
      phone,
      kind:
        modalId === "facebook" || modalId === "instagram"
          ? kind
          : modalId === "google" || modalId === "whatsapp"
            ? "business"
            : kind,
      pageUrl: modalId === "easy" ? pageUrl : "",
    };
    update(modalId, patch);
    setModalId(null);
  }

  function disconnect(id: IntegrationId) {
    update(id, {
      connected: false,
      handle: "",
      phone: id === "whatsapp" ? networks.whatsapp.phone : "",
      kind: null,
      pageUrl: "",
    });
  }

  async function copyWaOpen() {
    const bio = `https://${page.url}`;
    const msg =
      C.waOpenMsg +
      "\n" +
      C.myPageTitle +
      ": " +
      bio;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="text-right">
        <h1
          className="text-3xl font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.networksTitle}
        </h1>
        <p className="mt-1 text-lg text-slate-800">{C.networksSub}</p>
      </header>

      <ul className="grid w-full grid-cols-1 gap-4 xl:grid-cols-2">
        {ordered.map((id) => {
          const brand = BRAND[id];
          const state = networks[id];
          const meta = metaFor(id);
          const isFbIg = id === "facebook" || id === "instagram";
          const connected = !isGuest && state.connected;
          return (
            <li
              key={id}
              className="rounded-2xl border border-line bg-white p-5 text-right shadow-[var(--shadow)]"
              style={{
                borderColor: connected ? brand.color + "55" : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span
                      className={
                        id === "easy"
                          ? "rounded-full border border-[#00D084]/40 bg-[#ECFDF5] px-3 py-1 text-sm font-medium text-[#00D084]"
                          : id === "google"
                            ? "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-[#4285F4]"
                            : id === "whatsapp"
                              ? "rounded-full border border-[#25D366]/40 bg-[#E7F8EE] px-3 py-1 text-sm font-medium text-[#25D366]"
                              : "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800"
                      }
                    >
                      {isFbIg
                        ? state.kind === "personal"
                          ? C.tagPersonal
                          : C.tagBizPage
                        : meta.tag}
                    </span>
                    <p className="break-words text-xl font-semibold text-slate-900">
                      {meta.title}
                    </p>
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor:
                          id === "easy"
                            ? "#ECFDF5"
                            : id === "whatsapp"
                              ? "#E7F8EE"
                              : brand.bg,
                      }}
                    >
                      <BrandGlyph id={id} size={24} />
                    </span>
                  </div>
                  <p className="mt-2 break-words text-base leading-relaxed text-slate-800">
                    {isFbIg
                      ? state.kind === "personal"
                        ? C.descFbIgPersonal
                        : C.descFbIgBiz
                      : meta.desc}
                  </p>
                  <p className="mt-2 break-words text-base text-slate-700">
                    {connected
                      ? [
                          C.connectedOk,
                          state.kind === "business"
                            ? C.biz
                            : state.kind === "personal"
                              ? C.personal
                              : "",
                          state.handle || state.phone || state.pageUrl,
                        ]
                          .filter(Boolean)
                          .join(" | ")
                      : C.notConnected}
                  </p>
                </div>
              </div>

              {id === "whatsapp" && !isGuest && (
                <div className="mt-4 space-y-3">
                  <label className="block text-base font-medium text-slate-900">
                    {C.waPhoneLabel}
                    <input
                      dir="ltr"
                      value={state.phone}
                      onChange={(e) =>
                        update("whatsapp", {
                          phone: e.target.value,
                          connected: true,
                          kind: "business",
                        })
                      }
                      placeholder={C.phonePlaceholder || undefined}
                      inputMode="tel"
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-slate-50 px-4 text-left text-lg outline-none focus:border-accent"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyWaOpen()}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-line bg-slate-50 text-base font-medium text-slate-900 hover:bg-slate-100"
                  >
                    <Copy className="h-5 w-5" />
                    {copiedWa ? C.waOpenCopied : C.copyWaOpen}
                  </button>
                </div>
              )}

              {id === "easy" && !isGuest && (
                <label className="mt-4 block text-right text-base font-medium text-slate-900">
                  {C.easyUrlLabel}
                  <input
                    dir="ltr"
                    value={state.pageUrl}
                    onChange={(e) =>
                      update("easy", {
                        pageUrl: e.target.value,
                        connected: Boolean(e.target.value.trim()),
                        kind: "business",
                      })
                    }
                    placeholder={C.easyUrlPlaceholder || undefined}
                    className="mt-1.5 min-h-12 w-full rounded-xl border border-sky-100 bg-slate-50 px-4 text-left text-lg text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                  />
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {connected && id !== "whatsapp" ? (
                  <button
                    type="button"
                    onClick={() => disconnect(id)}
                    className="flex min-h-12 items-center gap-1.5 rounded-xl border border-line px-4 text-base text-slate-800 hover:bg-slate-50"
                  >
                    <Unlink className="h-4 w-4" />
                    {C.disconnect}
                  </button>
                ) : null}
                {connected ? (
                  <span className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-base font-medium text-emerald-700">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {C.connectedOk}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnect(id)}
                    className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium text-white"
                    style={{
                      backgroundColor:
                        id === "whatsapp"
                          ? "#25D366"
                          : id === "easy"
                            ? "#00D084"
                            : brand.color,
                    }}
                  >
                    <Link2 className="h-4 w-4" />
                    {isGuest
                      ? C.connectShort || C.connect
                      : id === "google"
                        ? C.ctaGoogleConnect
                        : C.connectAccount}
                  </button>
                )}
                {connected &&
                (isFbIg || id === "easy" || id === "whatsapp") ? (
                  <button
                    type="button"
                    onClick={() => openConnect(id)}
                    className="flex min-h-12 items-center gap-1.5 rounded-xl border border-line px-4 text-base font-medium text-slate-800 hover:bg-slate-50"
                  >
                    {C.saveChanges}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {isGuest ? (
        <div className="w-full rounded-2xl border border-line bg-accent-soft/60 px-4 py-4 text-right text-base text-slate-800">
          <p className="flex items-center justify-end gap-2 font-semibold text-slate-900">
            {C.guestOn}
            <Check className="h-4 w-4 text-accent" />
          </p>
          <p className="mt-1 break-words">{C.guestHelp}</p>
        </div>
      ) : null}

      {modalId && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setModalId(null)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {C.connectX} {metaFor(modalId).title}
                  </h2>
                  <p className="text-base text-slate-800">{C.chooseKind}</p>
                </div>
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: BRAND[modalId].bg }}
                >
                  <BrandGlyph id={modalId} size={26} />
                </span>
              </div>
            </div>

            {(modalId === "facebook" || modalId === "instagram") && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "business" as const,
                      title: C.bizPage,
                      desc: C.descFbIgBiz,
                    },
                    {
                      id: "personal" as const,
                      title: C.personalFast,
                      desc: C.descFbIgPersonal,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKind(opt.id)}
                    className={`min-h-[5rem] rounded-2xl border px-3 py-3 text-right transition ${
                      kind === opt.id
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-slate-50"
                    }`}
                  >
                    <p className="text-base font-semibold text-slate-900">
                      {opt.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{opt.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {modalId !== "easy" && modalId !== "whatsapp" && (
              <label className="mt-4 block text-right text-base text-slate-900">
                {C.username}
                <input
                  dir="rtl"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-line bg-slate-50 px-3 text-right text-lg outline-none focus:border-accent"
                />
              </label>
            )}

            {(modalId === "whatsapp" ||
              modalId === "facebook" ||
              modalId === "instagram") && (
              <label className="mt-3 block text-right text-base text-slate-900">
                {C.phoneQuick}
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={C.phonePlaceholder}
                  inputMode="tel"
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-line bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                />
              </label>
            )}

            {modalId === "easy" && (
              <label className="mt-4 block text-right text-base text-slate-900">
                {C.easyUrlLabel}
                <input
                  dir="ltr"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder={C.easyUrlPlaceholder}
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-line bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                />
              </label>
            )}

            <button
              type="button"
              onClick={confirmConnect}
              className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl text-lg font-medium text-white"
              style={{ backgroundColor: BRAND[modalId].color }}
            >
              {modalId === "google" ? C.ctaGoogleConnect : C.confirmConnect}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
