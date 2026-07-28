"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";

export default function RawTextDisclosure({
  alertId,
  rawText,
}: {
  alertId?: number;
  rawText?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadedText, setLoadedText] = useState(rawText || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  if (!rawText && !alertId) return null;

  async function copyText() {
    await navigator.clipboard.writeText(loadedText || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function loadText() {
    if (loadedText || loading || !alertId) return;
    setLoading(true);
    setError(false);
    try {
      setLoadedText(await api.getAlertRawText(alertId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="border border-slate-200 dark:border-slate-700"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) void loadText();
      }}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        View original extracted text
      </summary>
      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">Source text</span>
            {loadedText && <button
              type="button"
              onClick={copyText}
              aria-label="Copy original extracted text"
              className="border border-slate-300 dark:border-slate-600 bg-panel px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-slate-100 dark:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {copied ? "Copied" : "Copy Text"}
            </button>}
          </div>
          {loading && <p className="text-xs text-text-secondary">Loading source text…</p>}
          {error && <p role="alert" className="text-xs text-red-700">Original text could not be loaded.</p>}
          {!loading && !error && loadedText && (
            <pre className="max-h-80 max-w-full overflow-y-auto whitespace-pre-wrap break-words border border-slate-200 dark:border-slate-700 bg-panel p-3 font-mono text-[11px] leading-5 text-text-secondary">
              {loadedText}
            </pre>
          )}
        </div>
      )}
    </details>
  );
}
