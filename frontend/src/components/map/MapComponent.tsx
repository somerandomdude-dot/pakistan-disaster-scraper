"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Alert } from "@/lib/api/schemas";
import { Badge } from "../shared/Badge";
import { AlertTriangle, Droplets, Wind, ThermometerSun, Activity, Mountain, HelpCircle } from "lucide-react";

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
  switch (severity) {
    case "critical": return "#b91c1c";
    case "high": return "#ea580c";
    case "medium": return "#d97706";
    case "low": return "#60a5fa";
    default: return "#64748b";
  }
}

// Custom hook to fit bounds if alerts change
function MapBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
  }, [bounds, map]);
  return null;
}

export default function MapComponent({ alerts }: { alerts: Alert[] }) {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  // Filter alerts with valid coordinates
  const markers = alerts.flatMap((alert) => {
    return alert.locations
      .filter((loc) => loc.latitude && loc.longitude)
      .map((loc) => ({
        alert,
        position: [loc.latitude!, loc.longitude!] as [number, number],
        locationName: loc.city || loc.district || loc.province || loc.raw_location,
      }));
  });

  useEffect(() => {
    if (markers.length > 0) {
      const newBounds = L.latLngBounds(markers.map((m) => m.position));
      setBounds(newBounds);
    }
  }, [alerts]);

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-md overflow-hidden border border-slate-200">
      <MapContainer
        center={[30.3753, 69.3451]} // Center of Pakistan
        zoom={5}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {bounds && <MapBounds bounds={bounds} />}

        {markers.map((marker, idx) => {
          const color = getSeverityColor(marker.alert.normalized_severity);
          
          // Simple custom div icon to represent severity and hazard
          const iconHtml = `
            <div style="background-color: white; border: 3px solid ${color}; width: 24px; height: 24px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></div>
          `;
          
          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-leaflet-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          return (
            <Marker key={`${marker.alert.id}-${idx}`} position={marker.position} icon={customIcon}>
              <Popup className="min-w-[250px]">
                <div className="flex flex-col gap-2 p-1">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <HazardIcon type={marker.alert.hazard_type} className="text-slate-600 h-5 w-5" />
                    <strong className="font-semibold text-slate-900 leading-tight">
                      {marker.alert.title}
                    </strong>
                  </div>
                  <div className="text-sm text-slate-600 mt-1 line-clamp-2">
                    {marker.alert.description || "No description provided."}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <Badge variant={marker.alert.normalized_severity as any}>
                      {marker.alert.normalized_severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">
                      {marker.locationName}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
