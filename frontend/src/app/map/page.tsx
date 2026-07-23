"use client";

import { Suspense } from "react";
import { useActiveAlerts } from "@/lib/hooks/queries";
import InteractiveAlertMap from "@/components/map/InteractiveAlertMap";
import { useSearchParams } from "next/navigation";
import AlertFilters from "@/components/alerts/AlertFilters";

function MapContent() {
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => { params[key] = value; });

  const { data: alerts, isLoading } = useActiveAlerts(params);

  return (
    <div className="flex-1 flex flex-col relative h-[calc(100vh-4rem)]">
      {/* Filters overlay on desktop, normal block on mobile */}
      <div className="absolute top-4 right-4 z-20 w-80 shadow-lg hidden lg:block">
        <AlertFilters />
      </div>
      
      <div className="flex-1 w-full relative z-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 animate-pulse">
            Loading Map...
          </div>
        ) : (
          <InteractiveAlertMap alerts={alerts || []} />
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse">Loading map view...</div>}>
      <MapContent />
    </Suspense>
  );
}
