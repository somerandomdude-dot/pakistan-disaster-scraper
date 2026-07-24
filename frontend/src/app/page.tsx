"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveAlerts, useSources, useSummaryMetrics } from "@/lib/hooks/queries";
import { Alert } from "@/lib/api/schemas";

import AlertSummaryBanner from "@/components/dashboard/AlertSummaryBanner";
import ActiveAlertList from "@/components/alerts/ActiveAlertList";
import InteractiveAlertMap from "@/components/map/InteractiveAlertMap";
import AlertFilters from "@/components/alerts/AlertFilters";
import SourceHealthPanel from "@/components/sources/SourceHealthPanel";
import RecentAlertsTable from "@/components/dashboard/RecentAlertsTable";
import SituationMetrics from "@/components/dashboard/SituationMetrics";
import AlertDetailsDrawer from "@/components/alerts/AlertDetailsDrawer";
import { findPakistanCity } from "@/lib/data/pakistanLocations";

function DashboardContent() {
  const searchParams = useSearchParams();

  // Convert URL search params for React Query API client
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const { data: alerts, isLoading: isLoadingAlerts, error: alertsError } = useActiveAlerts(params);
  const { data: sources, isLoading: isLoadingSources } = useSources();
  const metrics = useSummaryMetrics(alerts, sources);
  const selectedCity = findPakistanCity(
    searchParams.get("city"),
    searchParams.get("district"),
    searchParams.get("province"),
  );

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  return (
    <div className="flex-1 flex flex-col">
      
      {/* Top Banner */}
      <AlertSummaryBanner metrics={metrics} />

      <div className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-7 lg:py-9 space-y-7">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">National overview</p>
            <h1 className="page-title">Current situation</h1>
            <p className="page-description">
              Verified public advisories, affected areas, and source status in one operational view.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="status-dot status-dot--live" />
            Live monitoring enabled
          </div>
        </section>
        
        {/* Main Three-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Column 1: Active Alerts Vertical List */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-[650px] bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,.04)] overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Active advisories</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Newest reports first</p>
              </div>
              {alerts && (
                <span className="text-xs text-slate-500 font-mono font-medium bg-slate-200/60 px-2 py-0.5 rounded">
                  {alerts.length} active
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingAlerts ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
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
                <div className="p-6 text-center text-red-600 text-xs">
                  Failed to load active advisories. Please check backend status.
                </div>
              ) : (
                <ActiveAlertList
                  alerts={alerts || []}
                  onSelectAlert={(alert) => setSelectedAlert(alert)}
                />
              )}
            </div>
          </div>

          {/* Column 2: Interactive Alert Map */}
          <div className="lg:col-span-8 xl:col-span-6 h-[480px] lg:h-[650px]">
            {isLoadingAlerts ? (
              <div className="w-full h-full bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center text-slate-400 text-xs animate-pulse">
                Initializing Alert Map...
              </div>
            ) : (
              <InteractiveAlertMap
                alerts={alerts || []}
                selectedCityCoords={
                  selectedCity
                    ? { lat: selectedCity.latitude, lng: selectedCity.longitude }
                    : null
                }
                onSelectAlert={(alert) => setSelectedAlert(alert)}
              />
            )}
          </div>

          {/* Column 3: Filters & Source Health Panel */}
          <div className="lg:col-span-12 xl:col-span-3 flex flex-col gap-6">
            <AlertFilters />
            {sources && <SourceHealthPanel sources={sources} />}
          </div>

        </div>

        {/* Lower Dashboard Section: Recent Alerts Table */}
        <RecentAlertsTable
          alerts={alerts || []}
          onSelectAlert={(alert) => setSelectedAlert(alert)}
        />

        {/* Calculated Situation Metrics */}
        <SituationMetrics metrics={metrics} />

      </div>

      {/* Slide-Over Alert Details Drawer */}
      {selectedAlert && (
        <AlertDetailsDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500 animate-pulse text-sm font-medium">
          Loading Pakistan Disaster Alert Dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
