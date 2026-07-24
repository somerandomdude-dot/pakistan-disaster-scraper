"use client";

import dynamic from "next/dynamic";
import { Alert } from "@/lib/api/schemas";

const MapWithNoSSR = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[450px] bg-slate-100 flex flex-col items-center justify-center border border-slate-200 rounded-md p-6">
      <div className="text-slate-500 animate-pulse font-medium text-sm">Loading Interactive Alert Map...</div>
      <span className="text-xs text-slate-400 mt-1">Initializing MapLibre GL vector engine</span>
    </div>
  ),
});

interface InteractiveAlertMapProps {
  alerts: Alert[];
  selectedCityCoords?: { lat: number; lng: number } | null;
  selectedCityZoom?: number;
  onSelectAlert?: (alert: Alert) => void;
}

export default function InteractiveAlertMap({
  alerts,
  selectedCityCoords,
  selectedCityZoom,
  onSelectAlert,
}: InteractiveAlertMapProps) {
  return (
    <MapWithNoSSR
      alerts={alerts}
      selectedCityCoords={selectedCityCoords}
      selectedCityZoom={selectedCityZoom}
      onSelectAlert={onSelectAlert}
    />
  );
}
