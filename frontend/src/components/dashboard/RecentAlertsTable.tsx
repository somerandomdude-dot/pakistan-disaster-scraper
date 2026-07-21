import { Alert } from "@/lib/api/schemas";
import { getRelativeTime, formatDate } from "@/lib/utils";
import { Badge } from "../shared/Badge";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function RecentAlertsTable({ alerts }: { alerts: Alert[] }) {
  if (!alerts || alerts.length === 0) return null;

  // Sort by issued_at descending, take top 10
  const recentAlerts = [...alerts]
    .sort((a, b) => new Date(b.issued_at || b.created_at).getTime() - new Date(a.issued_at || a.created_at).getTime())
    .slice(0, 10);

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800">Recent Official Advisories</h3>
        <Link href="/history" className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center">
          View History <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3 font-medium">Issued Time</th>
              <th className="px-6 py-3 font-medium">Alert Title</th>
              <th className="px-6 py-3 font-medium">Hazard</th>
              <th className="px-6 py-3 font-medium">Location</th>
              <th className="px-6 py-3 font-medium">Severity</th>
              <th className="px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentAlerts.map((alert) => {
              const location = alert.locations[0] 
                ? (alert.locations[0].city || alert.locations[0].district || alert.locations[0].province || alert.locations[0].raw_location)
                : "Multiple Areas";
              
              return (
                <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-slate-600">
                    <span className="block">{formatDate(alert.issued_at)}</span>
                    <span className="text-xs text-slate-400">{getRelativeTime(alert.issued_at)}</span>
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900 max-w-[300px] truncate">
                    {alert.title}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {alert.hazard_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-6 py-3 text-slate-600 max-w-[200px] truncate">
                    {location}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={alert.normalized_severity as any}>{alert.normalized_severity.toUpperCase()}</Badge>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {alert.source?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link 
                      href={`/alerts/${alert.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm inline-flex items-center"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
