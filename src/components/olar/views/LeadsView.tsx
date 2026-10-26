"use client";

import { useMemo, useState } from "react";
import { LEADS } from "@/lib/olar/mock-data";
import type { Lead, LeadNetwork, LeadStatus } from "@/lib/olar/types";
import { C } from "@/lib/olar/ui-copy";
import { BrandGlyph } from "../NetworkBrand";
import { Copy, Phone, X } from "lucide-react";

const COLS: { status: LeadStatus; titleKey: "colWaiting" | "colTalking" | "colDone" }[] = [
  { status: "new", titleKey: "colWaiting" },
  { status: "active", titleKey: "colTalking" },
  { status: "closed", titleKey: "colDone" },
];

const FILTERS: { id: LeadNetwork | "all"; label: string }[] = [
  { id: "all", label: C.all },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: C.whatsapp },
  { id: "tiktok", label: "TikTok" },
  { id: "other", label: "..." },
];

type Tpl = "book" | "price" | "ask";

export function LeadsView() {
  const [filter, setFilter] = useState<LeadNetwork | "all">("all");
  const [replyLead, setReplyLead] = useState<Lead | null>(null);
  const [tpl, setTpl] = useState<Tpl>("book");
  const [copied, setCopied] = useState(false);

  const leads = useMemo(
    () => (filter === "all" ? LEADS : LEADS.filter((l) => l.network === filter)),
    [filter]
  );

  const text = replyLead
    ? replyLead.replies[tpl]
    : "";

  async function copyText() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full space-y-6 animate-rise" dir="rtl">
      <header className="space-y-2 text-right">
        <h1
          className="text-3xl text-slate-900 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {C.peopleTitle}
        </h1>
        <p className="text-lg text-slate-800">{C.peopleSub}</p>
      </header>

      <div className="flex w-full flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-12 rounded-xl px-4 text-base font-medium ${
              filter === f.id
                ? "bg-accent text-white"
                : "border border-line bg-white text-slate-900 hover:bg-slate-100"
            }`}
          >
            {f.id === "all" ? C.all : f.id === "whatsapp" ? C.whatsapp : f.label}
          </button>
        ))}
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-3">
        {COLS.map((col) => {
          const items = leads.filter((l) => l.status === col.status);
          return (
            <section key={col.status} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {C[col.titleKey]}
                <span className="ms-2 text-base font-normal text-slate-800">
                  ({items.length})
                </span>
              </h2>
              <ul className="space-y-3">
                {items.map((lead) => (
                  <li
                    key={lead.id}
                    className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {lead.name}
                        </p>
                        <p className="mt-1 flex items-center justify-end gap-2 text-base text-slate-800">
                          <BrandGlyph id={lead.network} size={16} />
                          {lead.source} · {lead.timeAgo}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-base leading-relaxed text-slate-900">
                      {lead.message}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyLead(lead);
                          setTpl("book");
                          setCopied(false);
                        }}
                        className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-base font-medium text-white hover:bg-accent-hover"
                      >
                        {C.whatToReply}
                      </button>
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-white px-4 text-base font-medium text-slate-900 hover:bg-slate-100"
                        >
                          <Phone className="h-5 w-5" />
                          {C.callNow}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {replyLead && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <h3 className="text-xl font-semibold text-slate-900">
                  {C.replyFor} {replyLead.name}
                </h3>
                <p className="mt-1 text-base text-slate-800">{C.pickTpl}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyLead(null)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line"
                aria-label={C.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["book", C.tplBook],
                  ["price", C.tplPrice],
                  ["ask", C.tplAsk],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTpl(id);
                    setCopied(false);
                  }}
                  className={`min-h-12 rounded-xl px-4 text-base font-medium ${
                    tpl === id
                      ? "bg-accent text-white"
                      : "border border-line text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="mt-4 rounded-xl border border-line bg-slate-50 p-4 text-base leading-relaxed text-slate-900">
              {text}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyText}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-medium text-white"
              >
                <Copy className="h-5 w-5" />
                {copied ? C.copied : C.copyReply}
              </button>
              {replyLead.phone && (
                <a
                  href={`https://wa.me/972${replyLead.phone.replace(/\D/g, "").replace(/^0/, "")}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-14 items-center justify-center rounded-xl border border-line px-5 text-base font-medium text-slate-900"
                >
                  {C.whatsapp}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
