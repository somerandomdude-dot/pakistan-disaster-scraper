"use client";

import { useAlertHistory } from "@/lib/hooks/queries";
import RecentAlertsTable from "@/components/dashboard/RecentAlertsTable";

export default function HistoryPage() {
  const { data: alerts, isLoading, error } = useAlertHistory();

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Alert History</h1>
        <p className="text-slate-500 mt-1">A historical log of all alerts retrieved by the system.</p>
      </div>
      
      {isLoading ? (
        <div className="p-8 text-center animate-pulse">Loading history...</div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">Failed to load history.</div>
      ) : (
        <RecentAlertsTable alerts={alerts || []} />
      )}
    </div>
  );
}
