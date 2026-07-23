"use client";

import { useState, Suspense } from "react";
import { useActiveAlerts } from "@/lib/hooks/queries";
import ActiveAlertList from "@/components/alerts/ActiveAlertList";
import AlertFilters from "@/components/alerts/AlertFilters";
import AlertDetailsDrawer from "@/components/alerts/AlertDetailsDrawer";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/lib/api/schemas";

function AlertsContent() {
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const { data: alerts, isLoading, error } = useActiveAlerts(params);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
      <div className="mb-6 flex justify-between items-baseline">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Advisories</h1>
          <p className="text-xs text-slate-500 mt-1">Full index of currently active disaster alerts across Pakistan</p>
        </div>
        {alerts && (
          <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            {alerts.length} Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <AlertFilters />
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-md shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading active advisories...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-xs">Failed to load advisories from backend.</div>
          ) : (
            <ActiveAlertList
              alerts={alerts || []}
              onSelectAlert={(alert) => setSelectedAlert(alert)}
            />
          )}
        </div>
      </div>

      {selectedAlert && (
        <AlertDetailsDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse text-sm font-medium">Loading active alerts...</div>}>
      <AlertsContent />
    </Suspense>
  );
}
