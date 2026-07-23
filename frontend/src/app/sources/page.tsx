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
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scraper Source Health</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time operational status of connected scraper backend pipelines monitoring official advisories
          </p>
        </div>
        {sources && (
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {sources.filter((s: Source) => s.consecutive_failures === 0).length} Healthy
            </span>
            {sources.filter((s: Source) => s.consecutive_failures > 0).length > 0 && (
              <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
                <AlertOctagon className="h-3.5 w-3.5" />
                {sources.filter((s: Source) => s.consecutive_failures > 0).length} Issues
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
            const isHealthy = source.consecutive_failures === 0 && source.health_status !== "unhealthy";

            return (
              <Card key={source.id} className="bg-white border border-slate-200 shadow-2xs overflow-hidden">
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
                    
                    <Badge variant={isHealthy ? "healthy" : "unhealthy"} className="text-xs px-2.5 py-0.5">
                      {isHealthy ? "OPERATIONAL" : "UNHEALTHY"}
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
                  {!isHealthy && source.last_error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-red-800">
                        <ServerCrash className="h-4 w-4 shrink-0 text-red-600" />
                        <span>Recent Scraper Exception</span>
                      </div>
                      <p className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                        {source.last_error.split("\n")[0]}
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
