"use client";

import { useState, Suspense } from "react";
import { useActiveAlerts } from "@/lib/hooks/queries";
import InteractiveAlertMap from "@/components/map/InteractiveAlertMap";
import { useSearchParams } from "next/navigation";
import AlertFilters from "@/components/alerts/AlertFilters";
import AlertDetailsDrawer from "@/components/alerts/AlertDetailsDrawer";
import { Alert } from "@/lib/api/schemas";
import { SlidersHorizontal, MapPin } from "lucide-react";

function MapContent() {
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const { data: alerts, isLoading } = useActiveAlerts(params);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedCityCoords, setSelectedCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative h-[calc(100vh-4rem)] overflow-hidden">
      
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden p-3 bg-white border-b border-slate-200 flex justify-between items-center z-20">
        <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
          <MapPin className="h-4 w-4 text-blue-900" /> Full-Screen Alert Map
        </div>
        <button
          onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {showFiltersMobile ? "Hide Filters" : "Filter Map"}
        </button>
      </div>

      {/* Mobile Filter Sheet */}
      {showFiltersMobile && (
        <div className="lg:hidden p-4 bg-white border-b border-slate-200 z-30 shadow-md max-h-[50vh] overflow-y-auto">
          <AlertFilters onSelectCityCoords={setSelectedCityCoords} />
        </div>
      )}

      {/* Desktop Filters Overlay Panel */}
      <div className="hidden lg:block absolute top-4 right-4 z-20 w-80 shadow-xl rounded-md overflow-hidden">
        <AlertFilters onSelectCityCoords={setSelectedCityCoords} />
      </div>

      {/* Interactive Map Component */}
      <div className="flex-1 w-full relative z-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 animate-pulse text-xs font-medium">
            Initializing Interactive Map...
          </div>
        ) : (
          <InteractiveAlertMap
            alerts={alerts || []}
            selectedCityCoords={selectedCityCoords}
            onSelectAlert={(alert) => setSelectedAlert(alert)}
          />
        )}
      </div>

      {/* Slide-over Alert Details Drawer */}
      {selectedAlert && (
        <AlertDetailsDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse text-sm font-medium">Loading interactive map...</div>}>
      <MapContent />
    </Suspense>
  );
}
