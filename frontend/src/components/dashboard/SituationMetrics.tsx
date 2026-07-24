import { SummaryMetrics } from "@/lib/api/schemas";
import { Card, CardContent } from "../shared/Card";
import { AlertTriangle, MapPin, RadioTower, CheckCircle2, AlertOctagon, RefreshCw } from "lucide-react";
import { Badge } from "../shared/Badge";

interface SituationMetricsProps {
  metrics: SummaryMetrics | null;
}

export default function SituationMetrics({ metrics }: SituationMetricsProps) {
  if (!metrics) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Situation at a glance
        </h3>
        <span className="text-xs text-slate-500 hidden sm:block">
          Automatically calculated from current advisory data
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Metric 1: Total Active Alerts */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Active Alerts</span>
              <AlertTriangle className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{metrics.active_alerts_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Live advisories</span>
          </CardContent>
        </Card>

        {/* Metric 2: Critical Severity Alerts */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Critical</span>
              <AlertOctagon className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-700">{metrics.critical_alerts_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">High risk level</span>
          </CardContent>
        </Card>

        {/* Metric 3: Affected Districts */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Districts</span>
              <MapPin className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{metrics.affected_districts_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Under advisory</span>
          </CardContent>
        </Card>

        {/* Metric 4: Active Sources */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Healthy Sources</span>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-700">{metrics.healthy_sources_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Scrapers operational</span>
          </CardContent>
        </Card>

        {/* Metric 5: Unhealthy Sources */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Source Failures</span>
              <RadioTower className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{metrics.unhealthy_sources_count}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Requiring review</span>
          </CardContent>
        </Card>

        {/* Metric 6: Update Pulse */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Sync Interval</span>
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-lg font-bold text-slate-900">60s</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Auto-refreshed</span>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
