"use client";

import { useActiveAlerts, useSources, useSummaryMetrics } from "@/lib/hooks/queries";
import AlertSummaryBanner from "@/components/dashboard/AlertSummaryBanner";
import ActiveAlertList from "@/components/alerts/ActiveAlertList";
import InteractiveAlertMap from "@/components/map/InteractiveAlertMap";
import AlertFilters from "@/components/alerts/AlertFilters";
import SourceHealthPanel from "@/components/sources/SourceHealthPanel";
import RecentAlertsTable from "@/components/dashboard/RecentAlertsTable";
import { useSearchParams } from "next/navigation";

export default function Dashboard() {
  const searchParams = useSearchParams();
  
  // Convert URL search params to an object for the API
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const { data: alerts, isLoading: isLoadingAlerts, error: alertsError } = useActiveAlerts(params);
  const { data: sources, isLoading: isLoadingSources } = useSources();
  const metrics = useSummaryMetrics(alerts, sources);

  return (
    <div className="flex-1 flex flex-col">
      <AlertSummaryBanner metrics={metrics} />
      
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Active Alerts */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-[600px] bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800">Active Alerts</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingAlerts ? (
                <div className="p-4 space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-5 h-5 bg-slate-200 rounded-full shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : alertsError ? (
                <div className="p-4 text-center text-red-500">Failed to load alerts.</div>
              ) : (
                <ActiveAlertList alerts={alerts || []} />
              )}
            </div>
          </div>

          {/* Middle Column: Interactive Map */}
          <div className="lg:col-span-8 xl:col-span-6 h-[400px] lg:h-[600px]">
            {alerts && <InteractiveAlertMap alerts={alerts} />}
          </div>

          {/* Right Column: Filters & Sources */}
          <div className="lg:col-span-12 xl:col-span-3 flex flex-col gap-6">
            <AlertFilters />
            {sources && <SourceHealthPanel sources={sources} />}
          </div>
          
        </div>

        {/* Bottom Section: Recent Alerts Table */}
        {alerts && <RecentAlertsTable alerts={alerts} />}
      </div>
    </div>
  );
}
