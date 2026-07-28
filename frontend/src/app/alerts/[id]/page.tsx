"use client";

import { useAlertDetails } from "@/lib/hooks/queries";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, ExternalLink, Calendar, MapPin, 
  FileText, Activity, Layers, Tag, Eye, ChevronRight 
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/Card";
import { formatDate, getRelativeTime } from "@/lib/utils";
import { useState } from "react";
import { AlertLocation } from "@/lib/api/schemas";

export default function AlertDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: alert, isLoading, error } = useAlertDetails(id as string);
  const [showRaw, setShowRaw] = useState(false);

  if (isLoading) return <div className="p-8 text-center animate-pulse text-sm text-text-secondary">Loading alert details...</div>;
  if (error || !alert) return <div className="p-8 text-center text-red-600 text-sm">Failed to load alert details.</div>;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <button 
        onClick={() => router.back()} 
        className="flex items-center text-xs font-semibold text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Advisories
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={alert.normalized_severity as any} className="px-2.5 py-0.5 text-xs font-bold">
              {alert.normalized_severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="px-2.5 py-0.5 text-xs capitalize">
              {alert.status}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight">
            {alert.title}
          </h1>
        </div>

        {alert.source_url && (
          <a 
            href={alert.source_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-md font-semibold text-xs transition-colors shrink-0"
          >
            View Official Source <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-panel border border-slate-200 dark:border-slate-700 shadow-2xs">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-3">
              <CardTitle className="flex items-center gap-2 text-text-primary text-sm font-semibold">
                <FileText className="h-4 w-4 text-text-secondary" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-text-secondary whitespace-pre-wrap leading-relaxed text-sm">
                {alert.description || "Not provided by source."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-panel border border-slate-200 dark:border-slate-700 shadow-2xs">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-3">
              <CardTitle className="flex items-center gap-2 text-text-primary text-sm font-semibold">
                <MapPin className="h-4 w-4 text-text-secondary" /> Affected Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {alert.locations && alert.locations.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-background border-b border-slate-200 dark:border-slate-700 text-text-secondary font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-2">Province</th>
                        <th className="px-4 py-2">District</th>
                        <th className="px-4 py-2">City</th>
                        <th className="px-4 py-2">Coordinates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alert.locations.map((loc: AlertLocation, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 text-text-secondary">{loc.province || "Not provided"}</td>
                          <td className="px-4 py-2.5 text-text-primary font-semibold">{loc.district || "Not provided"}</td>
                          <td className="px-4 py-2.5 text-text-secondary">{loc.city || "Not provided"}</td>
                          <td className="px-4 py-2.5 text-text-secondary font-mono text-[11px]">
                            {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : "Not provided"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-text-secondary text-xs italic">Not provided by source.</p>
              )}
            </CardContent>
          </Card>

          {/* Raw Source Accordion */}
          <Card className="bg-panel border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button 
              onClick={() => setShowRaw(!showRaw)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-text-primary">
                <Eye className="h-4 w-4 text-text-secondary" /> Technical Details & Raw Extracted Text
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${showRaw ? "rotate-90" : ""}`} />
            </button>
            
            {showRaw && (
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 text-xs space-y-3">
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] text-text-secondary font-medium uppercase tracking-wider mb-0.5">Content Hash</span>
                    <span className="text-text-primary font-mono text-[11px] break-all">{alert.content_hash || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-text-secondary font-medium uppercase tracking-wider mb-0.5">Source Alert ID</span>
                    <span className="text-text-primary font-mono text-[11px]">{alert.source_alert_id || "Not provided"}</span>
                  </div>
                </div>
                
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase tracking-wider mb-1">Original Extracted Text</span>
                  <pre className="bg-slate-900 text-slate-300 p-4 rounded-md overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-96">
                    {alert.raw_text || "Not provided."}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-panel border border-slate-200 dark:border-slate-700 shadow-2xs">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-3">
              <CardTitle className="text-sm font-semibold text-text-primary">Advisory Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Hazard Category</span>
                  <span className="font-semibold text-text-primary capitalize">{alert.hazard_type.replace(/_/g, " ")}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Activity className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Official Severity</span>
                  <span className="font-medium text-text-primary">{alert.official_severity || "Not provided"}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Source Agency</span>
                  <span className="font-medium text-text-primary">{alert.source?.name || "Official Source"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-panel border border-slate-200 dark:border-slate-700 shadow-2xs">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-3">
              <CardTitle className="text-sm font-semibold text-text-primary">Timestamps</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Issued At</span>
                  <span className="font-medium text-text-primary">{formatDate(alert.issued_at)}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Starts At</span>
                  <span className="font-medium text-text-primary">{formatDate(alert.starts_at)}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">Expires At</span>
                  <span className="font-medium text-text-primary">{formatDate(alert.expires_at)}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 mt-0.5 shrink-0"></div>
                <div>
                  <span className="block text-[10px] text-text-secondary font-medium uppercase">System Ingestion Time</span>
                  <span className="text-text-secondary font-mono">{formatDate(alert.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
