"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountKind, IntegrationId } from "./types";
import { CONNECTED_DEFAULT } from "./mock-data";
import { useClientAuth } from "./auth-client";

export type ConnEntry = {
  connected: boolean;
  handle: string;
  phone: string;
  kind: AccountKind | null;
  pageUrl: string;
};

export type ConnectionsState = Record<IntegrationId, ConnEntry>;

const STORAGE_KEY = "olar-connections-v1";

export const NETWORK_PRIORITY: IntegrationId[] = [
  "google",
  "whatsapp",
  "facebook",
  "instagram",
  "easy",
  "tiktok",
  "twitter",
  "telegram",
  "pinterest",
];

function withPageUrl(
  base: typeof CONNECTED_DEFAULT
): ConnectionsState {
  const out = {} as ConnectionsState;
  for (const id of Object.keys(base) as IntegrationId[]) {
    const row = base[id];
    out[id] = {
      connected: row.connected,
      handle: row.handle,
      phone: row.phone,
      kind: row.kind,
      pageUrl: "pageUrl" in row ? String((row as { pageUrl?: string }).pageUrl ?? "") : "",
    };
  }
  return out;
}

function emptyConnections(): ConnectionsState {
  const defaults = withPageUrl(CONNECTED_DEFAULT);
  const out = {} as ConnectionsState;
  for (const id of Object.keys(defaults) as IntegrationId[]) {
    out[id] = {
      connected: false,
      handle: "",
      phone: "",
      kind: null,
      pageUrl: "",
    };
  }
  return out;
}

export function loadConnections(): ConnectionsState {
  const defaults = withPageUrl(CONNECTED_DEFAULT);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ConnectionsState>;
    const merged = { ...defaults };
    for (const id of Object.keys(defaults) as IntegrationId[]) {
      if (parsed[id]) merged[id] = { ...defaults[id], ...parsed[id] };
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveConnections(state: ConnectionsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearConnectionsStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useConnections() {
  const { isGuest, isAuthed, ready: authReady } = useClientAuth();
  const [networks, setNetworks] = useState<ConnectionsState>(() =>
    emptyConnections()
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (isGuest) {
      // Guests: ignore stale "connected" flags — always disconnected
      clearConnectionsStorage();
      setNetworks(emptyConnections());
    } else if (isAuthed) {
      setNetworks(loadConnections());
    } else {
      setNetworks(emptyConnections());
    }
    setHydrated(true);
  }, [authReady, isGuest, isAuthed]);

  useEffect(() => {
    if (!hydrated || isGuest) return;
    saveConnections(networks);
  }, [networks, hydrated, isGuest]);

  const update = useCallback(
    (id: IntegrationId, patch: Partial<ConnEntry>) => {
      if (isGuest) return; // guests cannot "connect"
      setNetworks((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
    },
    [isGuest]
  );

  return { networks, setNetworks, update, hydrated, isGuest };
}

export function networkToIntegration(
  network: string
): IntegrationId | null {
  if (network === "reels") return "instagram";
  if (network === "twitter") return "twitter";
  const map: Record<string, IntegrationId> = {
    facebook: "facebook",
    instagram: "instagram",
    tiktok: "tiktok",
    google: "google",
    whatsapp: "whatsapp",
    telegram: "telegram",
    pinterest: "pinterest",
  };
  return map[network] ?? null;
}

/** Full automation: Google, or FB/IG in business page mode */
export function hasFullAutomation(
  networks: ConnectionsState,
  socialNetwork: string
): boolean {
  const id = networkToIntegration(socialNetwork);
  if (!id) return false;
  if (id === "google") return networks.google.connected;
  if (id === "facebook" || id === "instagram") {
    return networks[id].connected && networks[id].kind === "business";
  }
  return false;
}

export function isPersonalPublish(
  networks: ConnectionsState,
  socialNetwork: string
): boolean {
  const id = networkToIntegration(socialNetwork);
  if (id !== "facebook" && id !== "instagram") return false;
  return networks[id].connected && networks[id].kind === "personal";
}

export function digitsToWaMe(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

export function buildWaInquiryLink(
  phone: string,
  message: string
): string {
  const digits = digitsToWaMe(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildWaOpenMessage(
  template: string,
  topic: string
): string {
  return template.replace("{topic}", topic.trim() || "...");
}

export function appendWaCta(
  body: string,
  phone: string,
  ctaLabel: string,
  message: string
): string {
  const link = buildWaInquiryLink(phone, message);
  if (!link) return body;
  if (body.includes("wa.me/")) return body;
  return `${body}\n\n${ctaLabel}\n${link}`;
}
