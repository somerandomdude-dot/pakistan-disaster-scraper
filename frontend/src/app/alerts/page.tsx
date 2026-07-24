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
    <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex-1 flex flex-col">
      <div className="mb-7 flex justify-between items-end">
        <div>
          <p className="section-kicker">Alert feed</p>
          <h1 className="page-title">Active advisories</h1>
          <p className="page-description">Current public alerts across Pakistan, consolidated from monitored official sources.</p>
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

        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,.04)] overflow-hidden">
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
