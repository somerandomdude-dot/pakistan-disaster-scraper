import { SummaryMetrics } from "@/lib/api/schemas";
import { getRelativeTime } from "@/lib/utils";
import { AlertTriangle, MapPin, RadioTower, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "../shared/Badge";

export default function AlertSummaryBanner({ metrics }: { metrics: SummaryMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="bg-white border-b border-slate-200/80 py-3 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1440px] mx-auto flex flex-wrap gap-4 items-center justify-between">
        
        {/* Metric Summaries */}
        <div className="flex items-center gap-6 flex-wrap text-xs">
          
          {/* Active Alerts */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-[.1em]">Active alerts</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-slate-900">{metrics.active_alerts_count}</span>
                {metrics.critical_alerts_count > 0 ? (
                  <Badge variant="critical" className="text-[10px] py-0 px-1.5 font-bold">
                    {metrics.critical_alerts_count} CRITICAL
                  </Badge>
                ) : (
                  <Badge variant="healthy" className="text-[10px] py-0 px-1.5 font-medium">
                    NORMAL
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          {/* Affected Districts */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-lg">
              <MapPin className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Affected Districts</p>
              <span className="text-base font-bold text-slate-900">{metrics.affected_districts_count}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

          {/* Scraper Source Health */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-lg">
              <RadioTower className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Connected Scrapers</p>
              <div className="flex items-center gap-2 mt-0.5 font-medium">
                <div className="flex items-center gap-1 text-green-700" title="Healthy scrapers">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{metrics.healthy_sources_count} Operational</span>
                </div>
                {metrics.unhealthy_sources_count > 0 && (
                  <div className="flex items-center gap-1 text-red-700 ml-1" title="Unhealthy scrapers">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{metrics.unhealthy_sources_count} Issues</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Latest Update Timestamp */}
        {metrics.latest_update_time ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Latest update <strong className="text-slate-800 font-semibold">{getRelativeTime(metrics.latest_update_time)}</strong></span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            No active advisory update time available
          </div>
        )}

      </div>
    </div>
  );
}
