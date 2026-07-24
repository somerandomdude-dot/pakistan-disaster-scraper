"use client";

import { useSources } from "@/lib/hooks/queries";
import { Source } from "@/lib/api/schemas";
import { Badge } from "@/components/shared/Badge";
import { Card, CardContent } from "@/components/shared/Card";
import { getRelativeTime } from "@/lib/utils";
import { Clock, ServerCrash, CheckCircle2, ExternalLink, RefreshCw, AlertOctagon } from "lucide-react";

export default function SourcesPage() {
  const { data: sources, isLoading, error } = useSources();

  return (
    <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex-1 flex flex-col space-y-7">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
        <div>
          <p className="section-kicker">System status</p>
          <h1 className="page-title">Data source health</h1>
          <p className="page-description">
            Operational status and polling activity for every monitored public advisory source.
          </p>
        </div>
        {sources && (
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {sources.filter((s: Source) => s.consecutive_failures === 0).length} Operational
            </span>
            {sources.filter((s: Source) => s.consecutive_failures > 0).length > 0 && (
              <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5" />
                {sources.filter((s: Source) => s.consecutive_failures > 0).length} Delayed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse text-xs bg-white border border-slate-200 rounded-md">
          Loading connected data source status...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 text-xs bg-white border border-slate-200 rounded-md">
          Failed to retrieve scraper source health from API backend.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sources?.map((source: Source) => {
            const isUnhealthy = source.health_status === "unhealthy" || source.consecutive_failures >= 3;
            const isDegraded = !isUnhealthy && source.consecutive_failures > 0;
            const statusLabel = isUnhealthy ? "UNAVAILABLE" : isDegraded ? "RETRYING" : "OPERATIONAL";

            return (
              <Card key={source.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  
                  {/* Title & Status */}
                  <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {source.name}
                      </h3>
                      <a
                        href={source.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-900 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {source.base_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    
                    <Badge variant={isUnhealthy ? "unhealthy" : isDegraded ? "medium" : "healthy"} className="text-xs px-2.5 py-0.5">
                      {statusLabel}
                    </Badge>
                  </div>

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded border border-slate-100">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider">Polling Interval</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <RefreshCw className="h-3 w-3 text-slate-400" /> Every {source.polling_interval_minutes} mins
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider">Consecutive Failures</span>
                      <span className={`font-semibold mt-0.5 block ${source.consecutive_failures > 0 ? "text-red-600 font-bold" : "text-slate-800"}`}>
                        {source.consecutive_failures} {source.consecutive_failures === 1 ? "failure" : "failures"}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Last Checked:
                      </span>
                      <span className="font-mono text-slate-800">{getRelativeTime(source.last_checked_at)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Last Successful Scrape:
                      </span>
                      <span className="font-mono text-slate-800">{getRelativeTime(source.last_success_at)}</span>
                    </div>
                  </div>

                  {/* Error Summary */}
                  {(isDegraded || isUnhealthy) && source.last_error && (
                    <div className={`p-3 border rounded text-xs space-y-1 ${isUnhealthy ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                      <div className="flex items-center gap-1 font-semibold">
                        <ServerCrash className="h-4 w-4 shrink-0" />
                        <span>{isUnhealthy ? "Source unavailable" : "Temporary connection delay"}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Automatic retry is active. The latest successful data remains available.
                      </p>
                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
