import { SummaryMetrics } from "@/lib/api/schemas";
import { getRelativeTime } from "@/lib/utils";
import { AlertTriangle, MapPin, RadioTower, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "../shared/Badge";

export default function AlertSummaryBanner({ metrics }: { metrics: SummaryMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="bg-white border-b border-slate-200 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-4 items-center justify-between">
        
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-md">
              <AlertTriangle className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Active Alerts</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-900">{metrics.active_alerts_count}</span>
                {metrics.critical_alerts_count > 0 && (
                  <Badge variant="critical" className="text-[10px] py-0">{metrics.critical_alerts_count} CRITICAL</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-md">
              <MapPin className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Affected Districts</p>
              <span className="text-lg font-bold text-slate-900">{metrics.affected_districts_count}</span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-md">
              <RadioTower className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sources</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1 text-sm font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {metrics.healthy_sources_count}
                </div>
                {metrics.unhealthy_sources_count > 0 && (
                  <div className="flex items-center gap-1 text-sm font-medium text-red-700">
                    <XCircle className="h-3.5 w-3.5" />
                    {metrics.unhealthy_sources_count}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {metrics.latest_update_time && (
          <div className="text-sm text-slate-500 text-right">
            Latest update <span className="font-medium text-slate-700">{getRelativeTime(metrics.latest_update_time)}</span>
          </div>
        )}
        
      </div>
    </div>
  );
}
