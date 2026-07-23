"use client";

import { useState } from "react";
import { useAlertHistory } from "@/lib/hooks/queries";
import RecentAlertsTable from "@/components/dashboard/RecentAlertsTable";
import AlertDetailsDrawer from "@/components/alerts/AlertDetailsDrawer";
import { Alert } from "@/lib/api/schemas";

export default function HistoryPage() {
  const { data: alerts, isLoading, error } = useAlertHistory();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Advisory History Log</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete historical log of all natural-disaster alerts extracted by scrapers across Pakistan
          </p>
        </div>
        {alerts && (
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
            {alerts.length} Total Historical Logged Advisories
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse text-xs bg-white border border-slate-200 rounded-md">
          Loading historical advisory database...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 text-xs bg-white border border-slate-200 rounded-md">
          Failed to load historical advisory data from backend.
        </div>
      ) : (
        <RecentAlertsTable
          alerts={alerts || []}
          onSelectAlert={(alert) => setSelectedAlert(alert)}
        />
      )}

      {selectedAlert && (
        <AlertDetailsDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

    </div>
  );
}
