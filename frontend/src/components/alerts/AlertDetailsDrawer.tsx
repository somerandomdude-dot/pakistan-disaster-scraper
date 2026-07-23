"use client";

import { useState, useEffect } from "react";
import { Alert, AlertLocation } from "@/lib/api/schemas";
import { Badge } from "../shared/Badge";
import { formatDate, getRelativeTime } from "@/lib/utils";
import { 
  X, ExternalLink, Calendar, MapPin, FileText, 
  Activity, Layers, Tag, Eye, ChevronRight, AlertCircle, ShieldAlert 
} from "lucide-react";

interface AlertDetailsDrawerProps {
  alert: Alert | null;
  onClose: () => void;
}

export default function AlertDetailsDrawer({ alert, onClose }: AlertDetailsDrawerProps) {
  const [showRaw, setShowRaw] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Slide-over Container */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full z-10 border-l border-slate-200 overflow-hidden">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-800 text-sm">Official Alert Details</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Title & Badges */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={alert.normalized_severity as any} className="px-2 py-0.5 text-xs font-semibold">
                {alert.normalized_severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-xs capitalize">
                {alert.status}
              </Badge>
              <span className="text-xs text-slate-500 ml-auto">
                ID: {alert.id}
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {alert.title}
            </h2>

            {alert.source_url && (
              <a 
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                View Official Source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Quick Facts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs">
            <div>
              <span className="block text-slate-500 font-medium uppercase tracking-wider text-[10px]">Hazard</span>
              <span className="font-semibold text-slate-800 capitalize">{alert.hazard_type.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium uppercase tracking-wider text-[10px]">Source</span>
              <span className="font-semibold text-slate-800">{alert.source?.name || "Unknown"}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium uppercase tracking-wider text-[10px]">Issued</span>
              <span className="font-semibold text-slate-800">{getRelativeTime(alert.issued_at)}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium uppercase tracking-wider text-[10px]">Official Severity</span>
              <span className="font-semibold text-slate-800">{alert.official_severity || "Not provided"}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="h-4 w-4 text-slate-500" /> Description
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-100">
              {alert.description || "Not provided by source."}
            </p>
          </div>

          {/* Affected Locations */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin className="h-4 w-4 text-slate-500" /> Affected Locations
            </h3>
            
            {alert.locations && alert.locations.length > 0 ? (
              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                    <tr>
                      <th className="px-3 py-2">Province</th>
                      <th className="px-3 py-2">District</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">Coordinates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alert.locations.map((loc: AlertLocation, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{loc.province || "Not provided"}</td>
                        <td className="px-3 py-2 text-slate-900 font-medium">{loc.district || "Not provided"}</td>
                        <td className="px-3 py-2 text-slate-700">{loc.city || "Not provided"}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">
                          {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : "Not provided"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-100">
                Not provided by source
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Calendar className="h-4 w-4 text-slate-500" /> Timeline & Timestamps
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="block text-slate-500 font-medium">Issue Time</span>
                <span className="text-slate-800">{formatDate(alert.issued_at)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="block text-slate-500 font-medium">Starts At</span>
                <span className="text-slate-800">{formatDate(alert.starts_at)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="block text-slate-500 font-medium">Expires At</span>
                <span className="text-slate-800">{formatDate(alert.expires_at)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <span className="block text-slate-500 font-medium">Retrieved Time</span>
                <span className="text-slate-800">{formatDate(alert.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Technical Details Accordion */}
          <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                <Eye className="h-4 w-4 text-slate-500" /> Technical Details & Raw Extracted Text
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showRaw ? "rotate-90" : ""}`} />
            </button>

            {showRaw && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-medium uppercase">Source Alert ID</span>
                    <span className="font-mono text-slate-800">{alert.source_alert_id || "Not provided by source"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-medium uppercase">Content Hash</span>
                    <span className="font-mono text-slate-800 break-all">{alert.content_hash || "Not provided by source"}</span>
                  </div>
                </div>

                {alert.validation_errors && (
                  <div>
                    <span className="block text-[10px] text-red-600 font-medium uppercase">Validation Notes</span>
                    <p className="text-red-700 bg-red-50 p-2 rounded border border-red-100 font-mono text-[11px]">
                      {alert.validation_errors}
                    </p>
                  </div>
                )}

                <div>
                  <span className="block text-[10px] text-slate-500 font-medium uppercase mb-1">Raw Extracted Text</span>
                  <pre className="bg-slate-900 text-slate-300 p-3 rounded overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-60">
                    {alert.raw_text || "Not provided by source."}
                  </pre>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Unofficial advisory dashboard • Source: {alert.source?.name || "Official Advisory"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
