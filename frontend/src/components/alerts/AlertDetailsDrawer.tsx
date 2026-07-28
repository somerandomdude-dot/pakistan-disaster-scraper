"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Alert } from "@/lib/api/schemas";
import AdvisoryInformation from "@/components/advisory/AdvisoryInformation";

interface AlertDetailsDrawerProps {
  alert: Alert | null;
  onClose: () => void;
}

export default function AlertDetailsDrawer({ alert, onClose }: AlertDetailsDrawerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden pointer-events-none">
      <div
        className="fixed inset-0 cursor-default bg-transparent pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Advisory details: ${alert.title}`}
        className="relative z-10 flex h-full w-full max-w-4xl flex-col border-l border-slate-300 bg-white shadow-xl pointer-events-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold text-slate-800">Advisory information</span>
          <button
            type="button"
            onClick={onClose}
            className="border border-transparent p-1.5 text-slate-600 hover:border-slate-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Close advisory details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <AdvisoryInformation alert={alert} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <p className="text-xs text-slate-500">Unofficial dashboard. Verify critical information with the linked source.</p>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
