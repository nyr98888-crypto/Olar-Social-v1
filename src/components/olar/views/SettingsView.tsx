"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntegrationId } from "@/lib/olar/types";
import {
  NETWORK_PRIORITY,
  useConnections,
  type ConnEntry,
} from "@/lib/olar/connections";
import {
  DEFAULT_PUBLISH_MODE,
  publishModeToKind,
  resolvePublishMode,
  type PublishMode,
  type SocialPlatform,
} from "@/lib/olar/social-accounts";
import {
  loadProfile,
  useResolvedMyPage,
} from "@/lib/olar/business-profile";
import { signInWithGoogle, useClientAuth } from "@/lib/olar/auth-client";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph, BRAND } from "../NetworkBrand";
import { FooterBrand } from "@/components/olar/FooterBrand";
import {
  Check,
  Copy,
  Fingerprint,
  Link2,
  Settings2,
  Unlink,
  X,
} from "lucide-react";

type Meta = {
  title: string;
  tag: string;
  purpose: string;
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
        purpose: C.purposeGoogle,
        desc: C.descGoogleBiz,
        cta: C.ctaGoogleConnect,
        primary: true,
      };
    case "whatsapp":
      return {
        title: C.waBizTitle,
        tag: C.tagMainChannel,
        purpose: C.purposeWhatsapp,
        desc: C.descWaBiz,
        primary: true,
      };
    case "facebook":
      return {
        title: BRAND.facebook.label,
        tag: C.tagBizPage,
        purpose: C.purposeFacebook,
        desc: C.descFbIgBiz,
        primary: true,
      };
    case "instagram":
      return {
        title: BRAND.instagram.label,
        tag: C.tagBizPage,
        purpose: C.purposeInstagram,
        desc: C.descFbIgBiz,
        primary: true,
      };
    case "easy":
      return {
        title: C.easyTitle,
        tag: C.tagReviews,
        purpose: C.purposeEasy,
        desc: C.descEasy,
        primary: true,
      };
    case "tiktok":
      return {
        title: C.tiktokTitle,
        tag: C.tagShortVideo,
        purpose: C.purposeTiktok,
        desc: C.descTiktok,
        primary: true,
      };
    default: {
      const purposes: Partial<Record<IntegrationId, string>> = {
        twitter: C.purposeTwitter,
        telegram: C.purposeTelegram,
        pinterest: C.purposePinterest,
      };
      return {
        title: BRAND[id].label,
        tag: C.otherNetworks,
        purpose: purposes[id] || C.otherNetworks,
        desc: C.networksSub,
      };
    }
  }
}

function shortLine(
  state: ConnEntry,
  meta: Meta,
  connected: boolean
): string {
  if (!connected) return meta.purpose;
  const mode = resolvePublishMode(state);
  const bits = [
    mode === "api_business" ? C.biz : C.personal,
    state.handle || state.phone || state.pageUrl || state.pageId,
  ].filter(Boolean);
  return bits.join(" · ") || meta.purpose;
}

async function syncSocialAccountToServer(opts: {
  platform: SocialPlatform;
  mode: PublishMode;
  profileUrl: string;
  pageId: string;
  accessToken: string;
  isConnected: boolean;
  /** When true, send empty token to wipe server credential */
  clearToken?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {
      platform: opts.platform,
      mode: opts.mode,
      profileUrl: opts.profileUrl,
      pageId: opts.pageId,
      isConnected: opts.isConnected,
    };
    if (opts.clearToken) body.accessToken = "";
    else if (opts.accessToken.trim()) {
      body.accessToken = opts.accessToken.trim();
    }
    await fetch("/api/social-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* soft-fail — local connections still saved */
  }
}

export function SettingsView() {
  const { page } = useResolvedMyPage();
  const { networks, update, isGuest } = useConnections();
  const { isAuthed } = useClientAuth();
  const [modalId, setModalId] = useState<IntegrationId | null>(null);
  /** Default safer track without Meta credentials */
  const [publishMode, setPublishMode] = useState<PublishMode>(
    DEFAULT_PUBLISH_MODE
  );
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [pageId, setPageId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [hasServerToken, setHasServerToken] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);
  const profile = loadProfile();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#dna") {
      window.setTimeout(() => {
        document.getElementById("dna")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    }
  }, []);

  const ordered = useMemo(() => NETWORK_PRIORITY, []);

  const connectedCount = useMemo(
    () => ordered.filter((id) => !isGuest && networks[id].connected).length,
    [ordered, networks, isGuest]
  );

  const connectedIds = useMemo(
    () => ordered.filter((id) => !isGuest && networks[id].connected),
    [ordered, networks, isGuest]
  );

  function openConnect(id: IntegrationId) {
    if (isGuest) {
      void signInWithGoogle("/");
      return;
    }
    const cur = networks[id];
    setModalId(id);
    const mode =
      id === "facebook" || id === "instagram"
        ? resolvePublishMode(cur)
        : DEFAULT_PUBLISH_MODE;
    setPublishMode(mode);
    setUsername(cur.handle.replace(/^@/, ""));
    setPhone(cur.phone || "");
    setPageUrl(cur.pageUrl || "");
    setPageId(cur.pageId || "");
    setAccessToken("");
    setHasServerToken(false);

    if (
      isAuthed &&
      (id === "facebook" || id === "instagram")
    ) {
      void fetch("/api/social-accounts")
        .then((r) => r.json())
        .then((data: {
          accounts?: Record<
            string,
            { hasCredentials?: boolean; pageId?: string; profileUrl?: string; mode?: PublishMode }
          >;
        }) => {
          const acc = data.accounts?.[id];
          if (!acc) return;
          if (acc.mode) setPublishMode(acc.mode);
          if (acc.pageId) setPageId(acc.pageId);
          if (acc.profileUrl) setPageUrl(acc.profileUrl);
          setHasServerToken(Boolean(acc.hasCredentials));
        })
        .catch(() => {
          /* soft-fail */
        });
    }
  }

  function confirmConnect() {
    if (!modalId || isGuest) return;
    const isFbIg = modalId === "facebook" || modalId === "instagram";
    const mode = isFbIg ? publishMode : DEFAULT_PUBLISH_MODE;
    const patch: Partial<ConnEntry> = {
      connected: true,
      handle: username ? `@${username.replace(/^@/, "")}` : "",
      phone,
      kind: isFbIg
        ? publishModeToKind(mode)
        : modalId === "google" || modalId === "whatsapp"
          ? "business"
          : publishModeToKind(mode),
      pageUrl: isFbIg
        ? mode === "assisted_personal"
          ? pageUrl.trim()
          : pageUrl.trim()
        : modalId === "easy"
          ? pageUrl
          : "",
      mode: isFbIg ? mode : undefined,
      pageId: isFbIg && mode === "api_business" ? pageId.trim() : "",
    };
    update(modalId, patch);

    if (isFbIg && isAuthed) {
      void syncSocialAccountToServer({
        platform: modalId,
        mode,
        profileUrl: pageUrl.trim(),
        pageId: pageId.trim(),
        accessToken,
        isConnected: true,
      });
    }

    setModalId(null);
    setAccessToken("");
  }

  function disconnect(id: IntegrationId) {
    update(id, {
      connected: false,
      handle: "",
      phone: id === "whatsapp" ? networks.whatsapp.phone : "",
      kind: null,
      pageUrl: "",
      mode:
        id === "facebook" || id === "instagram"
          ? DEFAULT_PUBLISH_MODE
          : undefined,
      pageId: "",
    });
    if (
      isAuthed &&
      (id === "facebook" || id === "instagram")
    ) {
      void syncSocialAccountToServer({
        platform: id,
        mode: DEFAULT_PUBLISH_MODE,
        profileUrl: "",
        pageId: "",
        accessToken: "",
        isConnected: false,
        clearToken: true,
      });
    }
    setModalId(null);
  }

  async function copyWaOpen() {
    const bio = `https://${page.url}`;
    const msg = C.waOpenMsg + "\n" + C.myPageTitle + ": " + bio;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl animate-rise space-y-6" dir="rtl">
      <header className="mb-1 text-right">
        <h1
          className="text-xl font-semibold text-slate-900 sm:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.networksTitle}
        </h1>
        <p className="mt-0.5 truncate text-sm text-slate-600">
          {C.networksSub}
        </p>
      </header>

      {/* ── Brand DNA (sidebar deep-link target) ── */}
      <section
        id="dna"
        className="scroll-mt-24 rounded-2xl border border-cyan-200/80 bg-white p-5 text-right shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {C.navDnaSettings || "ה-DNA והגדרות העסק"}
            </h2>
            <p className="text-sm text-slate-600">
              פרטי המותג שנשמרו מההיכרות — משמשים לפוסטים ולתמונות
            </p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold text-slate-500">שם העסק</dt>
            <dd className="text-base font-bold text-slate-900">
              {profile?.businessName || page.businessName || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold text-slate-500">תחום</dt>
            <dd className="text-base font-bold text-slate-900">
              {profile?.niche || page.tagline || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold text-slate-500">עיר</dt>
            <dd className="text-base font-bold text-slate-900">
              {profile?.city || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-xs font-semibold text-slate-500">טלפון / וואטסאפ</dt>
            <dd className="text-base font-bold text-slate-900" dir="ltr">
              {profile?.whatsapp || profile?.phone || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
            <dt className="text-xs font-semibold text-slate-500">תיאור</dt>
            <dd className="text-sm leading-relaxed text-slate-800">
              {profile?.description || page.description || "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Smart status line ── */}
      <div className="mb-1 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Link2 className="h-4 w-4" />
          </span>
          <span>
            {C.loopStatusPrefix}{" "}
            <span className="font-bold text-slate-900">{connectedCount}</span>{" "}
            {C.loopStatusSuffix}
          </span>
        </div>
        {connectedIds.length > 0 && (
          <div className="flex items-center -space-x-1">
            {connectedIds.map((id) => (
              <span
                key={id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: BRAND[id].bg }}
              >
                <BrandGlyph id={id} size={14} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Network cards grid ── */}
      <ul className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((id) => {
          const brand = BRAND[id];
          const state = networks[id];
          const meta = metaFor(id);
          const connected = !isGuest && state.connected;
          const line = shortLine(state, meta, connected);

          return (
            <li
              key={id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-right shadow-sm transition-all duration-200 hover:border-cyan-400/40 hover:shadow-md"
            >
              {/* Top: icon + name + purpose + badge */}
              <div className="mb-auto">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: brand.bg }}
                  >
                    <BrandGlyph id={id} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-slate-800">
                      {meta.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {meta.purpose}
                    </p>
                  </div>
                  {connected && (
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {C.activeInLoop}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom: account info or connect button */}
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                {connected ? (
                  <>
                    <p
                      className="min-w-0 flex-1 truncate text-xs text-slate-600"
                      dir="auto"
                      title={line}
                    >
                      {line}
                    </p>
                    {id === "whatsapp" && (
                      <button
                        type="button"
                        onClick={() => void copyWaOpen()}
                        title={copiedWa ? C.waOpenCopied : C.copyWaOpen}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openConnect(id)}
                      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {C.accountSettings}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnect(id)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {isGuest
                        ? C.connectShort || C.connect
                        : id === "google"
                          ? C.ctaGoogleConnect
                          : C.connectToLoop}
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Guest notice */}
      {isGuest ? (
        <div className="mt-5 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-right shadow-sm">
          <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-slate-900">
            {C.guestOn}
            <Check className="h-3.5 w-3.5 text-accent" />
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            {C.guestHelp}
          </p>
        </div>
      ) : null}

      {/* ── Connection modal ── */}
      {modalId && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setModalId(null)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200"
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "api_business" as const,
                      title: C.bizPage,
                      desc: C.descFbIgBiz,
                    },
                    {
                      id: "assisted_personal" as const,
                      title: C.personalFast,
                      desc: C.descFbIgPersonal,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPublishMode(opt.id)}
                    className={`min-h-[5rem] rounded-2xl border px-3 py-3 text-right transition ${
                      publishMode === opt.id
                        ? "border-accent bg-accent-soft"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">
                      {opt.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-700 sm:text-sm">
                      {opt.desc}
                    </p>
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
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-right text-lg outline-none focus:border-accent"
                />
              </label>
            )}

            {modalId === "whatsapp" && (
              <label className="mt-3 block text-right text-base text-slate-900">
                {C.waPhoneLabel}
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={C.phonePlaceholder}
                  inputMode="tel"
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                />
              </label>
            )}

            {(modalId === "facebook" || modalId === "instagram") &&
              publishMode === "assisted_personal" && (
                <label className="mt-3 block text-right text-base text-slate-900">
                  {C.profileUrlLabel}
                  <input
                    dir="ltr"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder={C.profileUrlPlaceholder}
                    className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                  />
                </label>
              )}

            {(modalId === "facebook" || modalId === "instagram") &&
              publishMode === "api_business" && (
                <>
                  <label className="mt-3 block text-right text-base text-slate-900">
                    {C.pageIdLabel}
                    <input
                      dir="ltr"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                      placeholder={C.pageIdPlaceholder}
                      className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                    />
                  </label>
                  <label className="mt-3 block text-right text-base text-slate-900">
                    {C.accessTokenLabel}
                    <input
                      dir="ltr"
                      type="password"
                      autoComplete="off"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={C.accessTokenPlaceholder}
                      className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
                    />
                  </label>
                  {hasServerToken ? (
                    <p className="mt-1.5 text-xs text-emerald-700">
                      {C.accessTokenSavedHint}
                    </p>
                  ) : null}
                </>
              )}

            {modalId === "easy" && (
              <label className="mt-4 block text-right text-base text-slate-900">
                {C.easyUrlLabel}
                <input
                  dir="ltr"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder={C.easyUrlPlaceholder}
                  className="mt-1.5 min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-lg outline-none focus:border-accent"
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

            {!isGuest && networks[modalId].connected && (
              <button
                type="button"
                onClick={() => disconnect(modalId)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Unlink className="h-4 w-4" />
                {C.disconnect}
              </button>
            )}
          </div>
        </div>
      )}

      <FooterBrand />
    </div>
  );
}
