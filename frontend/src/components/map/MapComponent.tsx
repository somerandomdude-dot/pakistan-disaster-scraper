"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import { Alert } from "@/lib/api/schemas";
import { Badge } from "../shared/Badge";
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
  switch (type?.toLowerCase()) {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract markers with valid coordinates
  const markers = useMemo(() => {
    return (alerts || []).flatMap((alert) => {
      return (alert.locations || [])
        .filter((loc) => loc.latitude && loc.longitude)
        .map((loc) => ({
          alert,
          position: [loc.latitude!, loc.longitude!] as [number, number],
          locationName: loc.city || loc.district || loc.province || loc.raw_location || "Location",
        }));
    });
  }, [alerts]);

  // Safely initialize Leaflet Map instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean lingering Leaflet container ID from previous mounts / Fast Refresh
    if ((containerRef.current as any)._leaflet_id) {
      delete (containerRef.current as any)._leaflet_id;
    }

    const map = L.map(containerRef.current, {
      center: [30.3753, 69.3451], // Center of Pakistan
      zoom: 5,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (containerRef.current) {
        delete (containerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Handle selectedCityCoords Fly-To
  useEffect(() => {
    if (!mapRef.current || !selectedCityCoords) return;
    mapRef.current.flyTo([selectedCityCoords.lat, selectedCityCoords.lng], 12, {
      animate: true,
      duration: 1.5,
    });
  }, [selectedCityCoords]);

  // Handle Markers update
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const boundsLatLngs: [number, number][] = [];

    markers.forEach(({ alert, position, locationName }) => {
      boundsLatLngs.push(position);
      const color = getSeverityColor(alert.normalized_severity);

      const iconHtml = `
        <div style="background-color: white; border: 3px solid ${color}; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-leaflet-icon",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const popupDiv = document.createElement("div");
      popupDiv.className = "flex flex-col gap-2 p-1 font-sans";

      popupDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong style="font-weight: 600; color: #0f172a; font-size: 12px; line-height: 1.3;">
            ${alert.title}
          </strong>
        </div>
        <div style="font-size: 12px; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${alert.description || "Not provided by source."}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
          <span style="background-color: ${color}20; color: ${color}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
            ${alert.normalized_severity}
          </span>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">
            ${locationName}
          </span>
        </div>
      `;

      if (onSelectAlert) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mt-2 w-full py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors cursor-pointer";
        btn.innerText = "View Full Alert Details";
        btn.onclick = () => onSelectAlert(alert);
        popupDiv.appendChild(btn);
      }

      const marker = L.marker(position, { icon: customIcon }).bindPopup(popupDiv, { minWidth: 260 });
      layerGroup.addLayer(marker);
    });

    if (boundsLatLngs.length > 0 && !selectedCityCoords) {
      const bounds = L.latLngBounds(boundsLatLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
  }, [markers, onSelectAlert, selectedCityCoords]);

  const handleResetView = () => {
    if (!mapRef.current) return;
    mapRef.current.setView([30.3753, 69.3451], 5, { animate: true, duration: 1.0 });
  };

  return (
    <div className={`w-full h-full relative rounded-md overflow-hidden border border-slate-200 bg-slate-100 ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "min-h-[450px]"}`}>
      
      {/* Map Control Buttons */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 bg-white p-1 rounded-md shadow-md border border-slate-200">
        <button
          type="button"
          onClick={handleResetView}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Reset Map View"
          aria-label="Reset map view to Pakistan"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            setTimeout(() => {
              mapRef.current?.invalidateSize();
            }, 100);
          }}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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

      <div ref={containerRef} className="w-full h-full min-h-[450px] z-0" />
    </div>
  );
}
