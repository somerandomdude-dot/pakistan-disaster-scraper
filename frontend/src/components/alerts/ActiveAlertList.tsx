import { Alert } from "@/lib/api/schemas";
import { getRelativeTime } from "@/lib/utils";
import { Badge } from "../shared/Badge";
import { AlertTriangle, Droplets, Wind, ThermometerSun, Activity, Mountain, ChevronRight } from "lucide-react";
import Link from "next/link";

function HazardIcon({ type, className }: { type: string; className?: string }) {
  const props = { className: className || "h-5 w-5" };
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

export function AlertListItem({ alert }: { alert: Alert }) {
  const highestLocation = alert.locations[0] 
    ? (alert.locations[0].city || alert.locations[0].district || alert.locations[0].province || "Multiple Areas")
    : "Multiple Areas";

  return (
    <Link href={`/alerts/${alert.id}`} className="block border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors p-4 group">
      <div className="flex gap-3">
        <div className="mt-1 text-slate-500 group-hover:text-blue-600 transition-colors">
          <HazardIcon type={alert.hazard_type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate">
              {alert.title}
            </h4>
            <Badge variant={alert.normalized_severity as any} className="shrink-0">
              {alert.normalized_severity.toUpperCase()}
            </Badge>
          </div>
          
          <p className="text-xs text-slate-600 mb-2 line-clamp-2">
            {alert.description || "No description provided."}
          </p>
          
          <div className="flex items-center text-[11px] text-slate-500 gap-2 flex-wrap">
            <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
              {alert.hazard_type.replace(/_/g, " ").toUpperCase()}
            </span>
            <span>•</span>
            <span className="truncate max-w-[120px]">{highestLocation}</span>
            <span>•</span>
            <span>{alert.source?.name || "Unknown Source"}</span>
            <span className="ml-auto text-slate-400">
              Issued {getRelativeTime(alert.issued_at)}
            </span>
          </div>
        </div>
        <div className="flex items-center text-slate-300 group-hover:text-blue-600 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

export default function ActiveAlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">No active alerts</p>
        <p className="text-sm">Currently no active alerts from connected sources.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {alerts.map(alert => (
        <AlertListItem key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
