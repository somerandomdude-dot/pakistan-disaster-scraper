"use client";

import { Suspense } from "react";
import { useActiveAlerts } from "@/lib/hooks/queries";
import ActiveAlertList from "@/components/alerts/ActiveAlertList";
import AlertFilters from "@/components/alerts/AlertFilters";
import { useSearchParams } from "next/navigation";

function AlertsContent() {
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => { params[key] = value; });

  const { data: alerts, isLoading, error } = useActiveAlerts(params);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Active Alerts</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <AlertFilters />
        </div>
        
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse">Loading alerts...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load alerts.</div>
          ) : (
            <ActiveAlertList alerts={alerts || []} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse">Loading active alerts...</div>}>
      <AlertsContent />
    </Suspense>
  );
}
