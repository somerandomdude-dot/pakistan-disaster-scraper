"use client";

import { Alert } from "@/lib/api/schemas";
import { getRelativeTime } from "@/lib/utils";
import { Badge } from "../shared/Badge";
import { AlertTriangle, Droplets, Wind, ThermometerSun, Activity, Mountain, ChevronRight, Inbox } from "lucide-react";

function HazardIcon({ type, className }: { type: string; className?: string }) {
  const props = { className: className || "h-4 w-4" };
  switch (type.toLowerCase()) {
    case "flood":
    case "flash_flood":
    case "heavy_rain":
      return <Droplets {...props} />;
    case "cyclone":
    case "storm":
      return <Wind {...props} />;
    case "heatwave":
      return <ThermometerSun {...props} />;
    case "earthquake":
      return <Activity {...props} />;
    case "landslide":
      return <Mountain {...props} />;
    default:
      return <AlertTriangle {...props} />;
  }
}

interface AlertListItemProps {
  alert: Alert;
  onSelect?: (alert: Alert) => void;
}

export function AlertListItem({ alert, onSelect }: AlertListItemProps) {
  const highestLocation = alert.locations[0] 
    ? (alert.locations[0].city || alert.locations[0].district || alert.locations[0].province || alert.locations[0].raw_location || "Multiple Areas")
    : "Multiple Areas";

  return (
    <div
      onClick={() => onSelect && onSelect(alert)}
      className="block border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors px-4 py-4 group cursor-pointer"
    >
      <div className="flex gap-3">
        <div className="mt-0.5 text-slate-500 group-hover:text-blue-900 transition-colors shrink-0">
          <HazardIcon type={alert.hazard_type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h4 className="font-semibold text-slate-900 text-xs leading-snug group-hover:text-blue-900 transition-colors line-clamp-2">
              {alert.title}
            </h4>
            <Badge variant={alert.normalized_severity as any} className="shrink-0 text-[10px] py-0 px-1.5">
              {alert.normalized_severity.toUpperCase()}
            </Badge>
          </div>
          
          <p className="text-xs text-slate-600 mb-2.5 line-clamp-2 leading-relaxed">
            {alert.description || "Not provided by source."}
          </p>
          
          <div className="flex items-center text-[10px] text-slate-500 gap-1.5 flex-wrap">
            <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
              {alert.hazard_type.replace(/_/g, " ").toUpperCase()}
            </span>
            <span>•</span>
            <span className="truncate max-w-[110px]">{highestLocation}</span>
            <span>•</span>
            <span>{alert.source?.name || "Official Source"}</span>
            <span className="ml-auto text-slate-400 font-mono">
              {getRelativeTime(alert.issued_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center text-slate-300 group-hover:text-blue-900 transition-colors shrink-0">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

interface ActiveAlertListProps {
  alerts: Alert[];
  onSelectAlert?: (alert: Alert) => void;
}

export default function ActiveAlertList({ alerts, onSelectAlert }: ActiveAlertListProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
        <Inbox className="h-8 w-8 text-slate-300 mb-2" />
        <p className="font-medium text-xs text-slate-700">No active alerts available</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
          No active disaster advisories currently returned from official connected scrapers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100">
      {alerts.map((alert) => (
        <AlertListItem key={alert.id} alert={alert} onSelect={onSelectAlert} />
      ))}
    </div>
  );
}
