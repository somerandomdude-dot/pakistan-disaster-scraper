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
    <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex-1 flex flex-col space-y-7">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
        <div>
          <p className="section-kicker">Archive</p>
          <h1 className="page-title">Advisory history</h1>
          <p className="page-description">
            Searchable historical record of public disaster advisories collected across Pakistan.
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
