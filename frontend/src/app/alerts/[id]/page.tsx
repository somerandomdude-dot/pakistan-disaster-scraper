"use client";

import { useAlertDetails } from "@/lib/hooks/queries";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Calendar, MapPin, AlertTriangle, FileText, Activity, Layers, Tag, Eye } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/Card";
import { formatDate, getRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

export default function AlertDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: alert, isLoading, error } = useAlertDetails(id as string);
  const [showRaw, setShowRaw] = useState(false);

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading alert details...</div>;
  if (error || !alert) return <div className="p-8 text-center text-red-500">Failed to load alert details.</div>;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => router.back()} 
        className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Alerts
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={alert.normalized_severity as any} className="px-2.5 py-1 text-sm">
              {alert.normalized_severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="px-2.5 py-1 text-sm capitalize">
              {alert.status}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {alert.title}
          </h1>
        </div>
        {alert.source_url && (
          <a 
            href={alert.source_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shrink-0"
          >
            View Official Source <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <FileText className="h-5 w-5 text-slate-500" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {alert.description || "Not provided by source."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <MapPin className="h-5 w-5 text-slate-500" /> Affected Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alert.locations && alert.locations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Province</th>
                        <th className="px-4 py-2 font-medium">District</th>
                        <th className="px-4 py-2 font-medium">City</th>
                        <th className="px-4 py-2 font-medium">Coordinates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alert.locations.map((loc, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-slate-700">{loc.province || "-"}</td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{loc.district || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{loc.city || "-"}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                            {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : "Not provided"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">Not provided by source.</p>
              )}
            </CardContent>
          </Card>

          {/* Raw Source Accordion */}
          <Card>
            <button 
              onClick={() => setShowRaw(!showRaw)}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Eye className="h-5 w-5 text-slate-500" /> Technical Details & Raw Source
              </div>
              <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${showRaw ? "rotate-90" : ""}`} />
            </button>
            
            {showRaw && (
              <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="block text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Content Hash</span>
                    <span className="text-slate-700 font-mono text-xs break-all">{alert.content_hash || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Source Alert ID</span>
                    <span className="text-slate-700 font-mono text-xs">{alert.source_alert_id || "Not provided"}</span>
                  </div>
                </div>
                
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Original Extracted Text</span>
                  <pre className="bg-slate-900 text-slate-300 p-4 rounded-md overflow-x-auto text-xs whitespace-pre-wrap max-h-96">
                    {alert.raw_text || "Not provided."}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Hazard Type</span>
                  <span className="text-sm font-medium text-slate-900 capitalize">{alert.hazard_type.replace(/_/g, " ")}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Activity className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Official Severity</span>
                  <span className="text-sm text-slate-900">{alert.official_severity || "Not provided"}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Source</span>
                  <span className="text-sm text-slate-900">{alert.source?.name || "Unknown"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Issued</span>
                  <span className="text-sm text-slate-900">{formatDate(alert.issued_at)}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Starts</span>
                  <span className="text-sm text-slate-900">{formatDate(alert.starts_at)}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Expires</span>
                  <span className="text-sm text-slate-900">{formatDate(alert.expires_at)}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 mt-0.5 shrink-0"></div>
                <div>
                  <span className="block text-xs text-slate-500 font-medium uppercase">Retrieved By System</span>
                  <span className="text-sm text-slate-600">{formatDate(alert.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline ChevronRight since lucide import is missing in the scope above
function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
