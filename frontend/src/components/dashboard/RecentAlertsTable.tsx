"use client";

import { useState } from "react";
import { Alert } from "@/lib/api/schemas";
import { getRelativeTime, formatDate } from "@/lib/utils";
import { Badge } from "../shared/Badge";
import Link from "next/link";
import { ChevronRight, ArrowUpDown, Calendar, MapPin, RadioTower, ExternalLink } from "lucide-react";

interface RecentAlertsTableProps {
  alerts: Alert[];
  onSelectAlert?: (alert: Alert) => void;
}

export default function RecentAlertsTable({ alerts, onSelectAlert }: RecentAlertsTableProps) {
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  if (!alerts || alerts.length === 0) return null;

  // Sorting
  const sortedAlerts = [...alerts].sort((a, b) => {
    const timeA = new Date(a.issued_at || a.created_at || 0).getTime();
    const timeB = new Date(b.issued_at || b.created_at || 0).getTime();
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Pagination
  const totalPages = Math.ceil(sortedAlerts.length / pageSize);
  const paginatedAlerts = sortedAlerts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-2xs overflow-hidden mt-8">
      
      {/* Table Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Recent Official Advisories</h3>
          <p className="text-xs text-slate-500">Live feed of extracted alerts across Pakistan</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-white border border-slate-200 px-2.5 py-1 rounded transition-colors"
          >
            <ArrowUpDown className="h-3 w-3" />
            Sort: {sortOrder === "desc" ? "Newest First" : "Oldest First"}
          </button>
          
          <Link href="/history" className="text-xs text-blue-900 hover:underline font-semibold flex items-center">
            View History <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-5 py-3">Issued Time</th>
              <th className="px-5 py-3">Alert Title</th>
              <th className="px-5 py-3">Hazard</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedAlerts.map((alert) => {
              const location = alert.locations[0] 
                ? (alert.locations[0].city || alert.locations[0].district || alert.locations[0].province || alert.locations[0].raw_location || "Multiple Areas")
                : "Multiple Areas";

              return (
                <tr 
                  key={alert.id} 
                  onClick={() => onSelectAlert && onSelectAlert(alert)}
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 text-slate-600 font-mono">
                    <span className="block text-slate-800 font-medium">{formatDate(alert.issued_at)}</span>
                    <span className="text-[10px] text-slate-400">{getRelativeTime(alert.issued_at)}</span>
                  </td>
                  
                  <td className="px-5 py-3 font-semibold text-slate-900 max-w-[280px] truncate">
                    {alert.title}
                  </td>
                  
                  <td className="px-5 py-3 text-slate-700 capitalize">
                    {alert.hazard_type.replace(/_/g, " ")}
                  </td>
                  
                  <td className="px-5 py-3 text-slate-700 max-w-[180px] truncate">
                    {location}
                  </td>
                  
                  <td className="px-5 py-3">
                    <Badge variant={alert.normalized_severity as any} className="text-[10px] py-0.5">
                      {alert.normalized_severity.toUpperCase()}
                    </Badge>
                  </td>
                  
                  <td className="px-5 py-3 text-slate-600 font-medium">
                    {alert.source?.name || "Official Advisory"}
                  </td>
                  
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectAlert) onSelectAlert(alert);
                      }}
                      className="text-blue-900 hover:text-blue-700 hover:underline font-semibold inline-flex items-center text-xs"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="block md:hidden divide-y divide-slate-100">
        {paginatedAlerts.map((alert) => {
          const location = alert.locations[0] 
            ? (alert.locations[0].city || alert.locations[0].district || alert.locations[0].province || "Multiple Areas")
            : "Multiple Areas";

          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert && onSelectAlert(alert)}
              className="p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-2"
            >
              <div className="flex justify-between items-start gap-2">
                <Badge variant={alert.normalized_severity as any} className="text-[10px]">
                  {alert.normalized_severity.toUpperCase()}
                </Badge>
                <span className="text-[11px] text-slate-400 font-mono">
                  {getRelativeTime(alert.issued_at)}
                </span>
              </div>

              <h4 className="font-semibold text-slate-900 text-xs leading-snug">
                {alert.title}
              </h4>

              <div className="flex items-center text-[11px] text-slate-500 gap-3 flex-wrap pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" /> {location}
                </span>
                <span className="flex items-center gap-1">
                  <RadioTower className="h-3 w-3 text-slate-400" /> {alert.source?.name || "Official"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600">
          <span>
            Showing page <strong className="text-slate-900">{currentPage}</strong> of {totalPages} ({sortedAlerts.length} total)
          </span>

          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 font-medium hover:bg-slate-100 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 font-medium hover:bg-slate-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
