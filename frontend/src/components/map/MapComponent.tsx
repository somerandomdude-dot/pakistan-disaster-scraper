"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Alert } from "@/lib/api/schemas";
import { Badge } from "../shared/Badge";
import MapCityController from "./MapCityController";
import { AlertTriangle, Droplets, Wind, ThermometerSun, Activity, Mountain, RotateCcw, Maximize2 } from "lucide-react";

// Fix standard marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function HazardIcon({ type, className }: { type: string; className?: string }) {
  const props = { className: className || "h-4 w-4" };
  switch (type.toLowerCase()) {
    case "flood":
    case "flash_flood":
    case "heavy_rain":
      return <Droplets {...props} />;
    case "cyclone":
    case "storm":
      return <Wind {...props} />;
    case "heatwave":
      return <ThermometerSun {...props} />;
    case "earthquake":
      return <Activity {...props} />;
    case "landslide":
      return <Mountain {...props} />;
    default:
      return <AlertTriangle {...props} />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical": return "#dc2626";
    case "high": return "#ea580c";
    case "medium": return "#d97706";
    case "low": return "#2563eb";
    default: return "#64748b";
  }
}

// Controller to reset view to center of Pakistan
function MapResetController({ onResetHandled }: { onResetHandled: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.setView([30.3753, 69.3451], 5, { animate: true, duration: 1.0 });
    onResetHandled();
  }, [map, onResetHandled]);
  return null;
}

interface MapComponentProps {
  alerts: Alert[];
  selectedCityCoords?: { lat: number; lng: number } | null;
  onSelectAlert?: (alert: Alert) => void;
}

export default function MapComponent({
  alerts,
  selectedCityCoords,
  onSelectAlert,
}: MapComponentProps) {
  const [shouldResetView, setShouldResetView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract markers with valid coordinates
  const markers = useMemo(() => {
    return alerts.flatMap((alert) => {
      return alert.locations
        .filter((loc) => loc.latitude && loc.longitude)
        .map((loc) => ({
          alert,
          position: [loc.latitude!, loc.longitude!] as [number, number],
          locationName: loc.city || loc.district || loc.province || loc.raw_location || "Location",
        }));
    });
  }, [alerts]);

  return (
    <div className={`w-full h-full relative rounded-md overflow-hidden border border-slate-200 bg-slate-100 ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "min-h-[450px]"}`}>
      
      {/* Map Control Buttons */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 bg-white p-1 rounded-md shadow-md border border-slate-200">
        <button
          type="button"
          onClick={() => setShouldResetView(true)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
          title="Reset Map View"
          aria-label="Reset map view to Pakistan"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          aria-label="Toggle map fullscreen mode"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Severity Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-md shadow-md border border-slate-200 text-xs flex flex-wrap items-center gap-3">
        <span className="font-semibold text-slate-700">Severity:</span>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span><span className="text-slate-600">Critical</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span><span className="text-slate-600">High</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span><span className="text-slate-600">Medium</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span><span className="text-slate-600">Low</span></div>
      </div>

      <MapContainer
        center={[30.3753, 69.3451]} // Center of Pakistan
        zoom={5}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dynamic City Fly-To Controller */}
        {selectedCityCoords && (
          <MapCityController
            latitude={selectedCityCoords.lat}
            longitude={selectedCityCoords.lng}
            zoom={12}
          />
        )}

        {/* View Reset Controller */}
        {shouldResetView && (
          <MapResetController onResetHandled={() => setShouldResetView(false)} />
        )}

        {/* Alert Markers */}
        {markers.map((marker, idx) => {
          const color = getSeverityColor(marker.alert.normalized_severity);

          const iconHtml = `
            <div style="background-color: white; border: 3px solid ${color}; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; items-center; justify-content: center;">
              <div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%;"></div>
            </div>
          `;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: "custom-leaflet-icon",
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          return (
            <Marker key={`${marker.alert.id}-${idx}`} position={marker.position} icon={customIcon}>
              <Popup className="min-w-[260px]">
                <div className="flex flex-col gap-2 p-1">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <HazardIcon type={marker.alert.hazard_type} className="text-slate-700 h-5 w-5 shrink-0" />
                    <strong className="font-semibold text-slate-900 leading-tight text-xs">
                      {marker.alert.title}
                    </strong>
                  </div>
                  
                  <div className="text-xs text-slate-600 line-clamp-2">
                    {marker.alert.description || "Not provided by source."}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <Badge variant={marker.alert.normalized_severity as any} className="text-[10px]">
                      {marker.alert.normalized_severity.toUpperCase()}
                    </Badge>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {marker.locationName}
                    </span>
                  </div>

                  {onSelectAlert && (
                    <button
                      type="button"
                      onClick={() => onSelectAlert(marker.alert)}
                      className="mt-2 w-full py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors"
                    >
                      View Full Alert Details
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
